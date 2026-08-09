import type { TeamFolderEntry } from "@/types";

// Showdown's team-folder export separates teams with a header line like
// `=== [gen9vgc2024regh] Folder/Team Name ===`. The bracketed format tag is optional
// to match against (some exports omit it), but the === delimiters are always present.
const FOLDER_HEADER = /^===\s*(?:\[[^\]]*\]\s*)?(.+?)\s*===$/;

/** The last "/"-segment of a Showdown folder title is the team's own name. */
function shortLabel(title: string): string {
  const slashIndex = title.lastIndexOf("/");
  return slashIndex === -1 ? title : title.slice(slashIndex + 1).trim();
}

/**
 * Splits a Showdown "team folder" export — multiple teams, each preceded by a
 * `=== [format] Title ===` header — into one entry per team. Anything before the
 * first header (e.g. page chrome accidentally included in a copy-paste) is
 * ignored. Each entry's `rawPaste` still has its own header line included, since
 * parseTeam already knows to skip that line.
 */
export function parseTeamFolder(raw: string): TeamFolderEntry[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const entries: TeamFolderEntry[] = [];
  let currentLabel: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    if (currentLabel === null) return;
    // currentLines[0] is the header line itself — a team needs content beyond that.
    const hasBody = currentLines.slice(1).join("\n").trim().length > 0;
    if (hasBody) {
      entries.push({ label: shortLabel(currentLabel), rawPaste: currentLines.join("\n").trim() });
    }
  }

  for (const line of lines) {
    const headerMatch = line.trim().match(FOLDER_HEADER);
    if (headerMatch) {
      flush();
      currentLabel = headerMatch[1];
      currentLines = [line];
    } else if (currentLabel !== null) {
      currentLines.push(line);
    }
  }
  flush();

  return entries;
}
