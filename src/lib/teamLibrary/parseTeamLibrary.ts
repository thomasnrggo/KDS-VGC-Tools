/**
 * The Team Library — the VGCPastes Repository's shared teams (a public
 * Google Sheet, one tab per regulation; see ./sources.ts), shown as they
 * are: no paste is fetched or parsed, the library links to it. Read on the
 * server by src/app/api/team-library/[regulationId]/route.ts. See
 * PLANNING.md's "Team Library".
 */
export interface LibraryTeam {
  /** VGCPastes' id, e.g. "MC780". */
  id: string;
  /** E.g. "javivarela56's Gdańsk Regional 2027 Champion Team". */
  description: string;
  /** Who built it (the sheet's "Full Name"). */
  creator: string;
  /** Whose post or paste it is (the sheet's "Owner"). */
  owner?: string;
  /** Where the paste came from (the sheet's "Extracted paste?"): the owner's own, or extracted by VGCPastes. */
  pasteSource?: "owner" | "extracted";
  /** Showdown names, in the sheet's order ("Staraptor-Mega"). */
  pokemon: string[];
  /** One per Pokémon, same order — "" when the sheet has none. */
  items: string[];
  pokepaste?: string;
  /** Whether the paste lists Stat Points (the sheet's "EVs"). */
  hasStatPoints: boolean;
  /** The in-game rental code, when VGCPastes marks it available. */
  replicaCode?: string;
  /** ISO date (YYYY-MM-DD) it was shared. */
  date?: string;
  event?: string;
  /** "Champion", "Top 8", "102nd"… */
  rank?: string;
  /** Where it was shared (usually a post on X). */
  source?: string;
  /** A report or video about it. */
  report?: string;
}

/** What /api/team-library/{regulationId} serves. */
export interface TeamLibraryResponse {
  regulationId: string;
  /** ISO timestamp of the read ("" when none could be made). */
  updatedAt: string;
  /** Newest first. */
  teams: LibraryTeam[];
}

/** RFC 4180 CSV: quoted fields may hold commas, newlines and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "2 Nov 2026" → "2026-11-02"; anything else → undefined. */
export function parseSheetDate(text: string): string | undefined {
  const match = text.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})$/);
  if (!match) return undefined;
  const month = MONTHS.indexOf(match[2].toLowerCase());
  if (month < 0) return undefined;
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

/** The sheet's "nothing here" marks. */
function value(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed && trimmed !== "-" && trimmed !== "N/A" ? trimmed : undefined;
}

function link(text: string | undefined): string | undefined {
  const url = value(text);
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

/**
 * The teams in one tab's CSV export, newest first as the sheet keeps them.
 * Columns are found by their header (the row starting "Team ID"), so a
 * moved column doesn't break it; a missing one throws — better no update
 * than a wrong one. Each Pokémon slot's header ("1"…"6") spans three
 * columns, sprite images then the item, so the item is two to the right.
 */
export function parseTeamLibrary(csv: string): LibraryTeam[] {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex((row) => row[0]?.trim() === "Team ID");
  if (headerIndex < 0) throw new Error("Team Library: no header row");
  const header = rows[headerIndex].map((name) => name.trim());
  const column = (name: string) => {
    const index = header.findIndex((cell) => cell === name || cell.startsWith(`${name}\n`));
    if (index < 0) throw new Error(`Team Library: no "${name}" column`);
    return index;
  };
  const col = {
    id: column("Team ID"),
    description: column("Team Description"),
    creator: column("Full Name"),
    slots: ["1", "2", "3", "4", "5", "6"].map(column),
    pokepaste: column("Pokepaste"),
    evs: column("EVs"),
    extracted: column("Extracted paste?"),
    replicaStatus: column("Replica Status"),
    replicaCode: column("Replica Code"),
    date: column("Date Shared"),
    event: column("Tournament / Event"),
    rank: column("Rank"),
    source: column("Link to Source"),
    report: column("Report / Video"),
    owner: column("Owner"),
    pokemon: column("Pokemon Text for Copypasta"),
  };

  return rows.slice(headerIndex + 1).flatMap((row): LibraryTeam[] => {
    const id = value(row[col.id]);
    const pokemon = [0, 1, 2, 3, 4, 5]
      .map((offset) => value(row[col.pokemon + offset]))
      .filter((name): name is string => !!name);
    if (!id || pokemon.length === 0) return [];
    const creator = value(row[col.creator]) ?? value(row[col.owner]) ?? "";
    const extracted = row[col.extracted]?.trim().toLowerCase() ?? "";
    const replicaCode = value(row[col.replicaCode]);
    const team: LibraryTeam = {
      id,
      description: value(row[col.description]) ?? "",
      creator,
      pokemon,
      items: col.slots.slice(0, pokemon.length).map((slot) => value(row[slot + 2]) ?? ""),
      hasStatPoints: row[col.evs]?.trim().toLowerCase() === "yes",
    };
    const optional: Partial<LibraryTeam> = {
      owner: value(row[col.owner]),
      pasteSource: extracted.startsWith("owner")
        ? "owner"
        : extracted.startsWith("extracted")
          ? "extracted"
          : undefined,
      pokepaste: link(row[col.pokepaste]),
      replicaCode: replicaCode && row[col.replicaStatus]?.trim() === "✔" ? replicaCode : undefined,
      date: parseSheetDate(row[col.date] ?? ""),
      event: value(row[col.event]),
      rank: value(row[col.rank]),
      source: link(row[col.source]),
      report: link(row[col.report]),
    };
    // Only the fields it has — the response stays small.
    for (const [key, field] of Object.entries(optional)) {
      if (field !== undefined) (team as unknown as Record<string, unknown>)[key] = field;
    }
    return [team];
  });
}
