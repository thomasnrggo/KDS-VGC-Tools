const POKEPASTE_URL_PATTERN = /^https?:\/\/(?:www\.)?pokepast\.es\/([a-zA-Z0-9]+)\/?$/;

/**
 * True when `value` (trimmed) is nothing but a Poképaste URL — used to detect
 * "pasted a link instead of the export" in the team/opponent paste boxes,
 * rather than treating it as literal (invalid) Showdown export text.
 */
export function isPokepasteUrl(value: string): boolean {
  return POKEPASTE_URL_PATTERN.test(value.trim());
}

export interface PokepasteData {
  /** Raw Pokémon Showdown export text, ready for parseTeam. */
  paste: string;
  /** The paste's title on Poképaste, if any — used to prefill a name field left blank. */
  title: string;
}

/**
 * Resolves a Poképaste URL to its underlying Showdown export text via
 * pokepast.es's public JSON endpoint (`<url>/json`) — undocumented but
 * stable, and CORS-open (`access-control-allow-origin: *`), so this runs
 * client-side with no server proxy needed. Throws an already-user-facing
 * message on any failure, so callers can show it directly.
 */
export async function fetchPokepaste(url: string): Promise<PokepasteData> {
  const match = url.trim().match(POKEPASTE_URL_PATTERN);
  if (!match) {
    throw new Error("That doesn't look like a Poképaste link.");
  }
  const id = match[1];

  let response: Response;
  try {
    response = await fetch(`https://pokepast.es/${id}/json`);
  } catch {
    throw new Error("Couldn't reach Poképaste — check your connection and try again.");
  }
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "That Poképaste link doesn't exist — it may have been deleted."
        : "Couldn't load that Poképaste — try again.",
    );
  }

  const data = (await response.json()) as { paste?: unknown; title?: unknown };
  if (typeof data.paste !== "string" || !data.paste.trim()) {
    throw new Error("That Poképaste doesn't contain a team export.");
  }
  return {
    paste: data.paste,
    title: typeof data.title === "string" ? data.title : "",
  };
}
