import type { OfficialEvent, OfficialPlayer } from "./officialTournament";

/**
 * An official event added by hand at /admin/meta-events: the admin drops the
 * two pokedata.ovh files (roster and Masters standings), the browser parses
 * them with parseOfficialEvent — names never leave it, only anonymous
 * players — and the result waits in `metaImports/{id}` (staff only) until the
 * metagame job (scripts/update-meta.mjs) saves it like a fetched event and
 * rebuilds the regulation's summary.
 */
export interface MetaImport {
  /** The pokedata.ovh event id when it has one (so the job never fetches it again), else "manual-…". */
  id: string;
  title: string;
  regulationId: string;
  /** ISO dates. */
  startDate: string;
  endDate: string;
  division: string;
  players: OfficialPlayer[];
  join: OfficialEvent["join"];
  uploadedAt: string;
  uploadedBy: string;
}

/** The share of standings players that must match a team sheet — the job's own bar. */
export const MIN_JOIN = 0.9;

/** Whether the files joined well enough to count, as the job requires of a fetched event. */
export function joinIsGood(join: OfficialEvent["join"]): boolean {
  return join.matched > 0 && join.matched >= MIN_JOIN * Math.min(join.sheets, join.standings);
}

/** The id an upload is saved under: the pokedata.ovh id if given, else one from the title and date. */
export function metaImportId(pokedataId: string, title: string, startDate: string): string {
  const id = pokedataId.trim();
  if (id) return id;
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `manual-${slug}-${startDate}`;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * The standings file's date line as ISO dates: "October 24-25, 2026",
 * "October 31 - November 1, 2026" or "June 7, 2026". Null when it reads
 * otherwise (the admin types the dates then).
 */
export function parseStandingsDate(text: string): { startDate: string; endDate: string } | null {
  const match = text
    .trim()
    .toLowerCase()
    .match(/^([a-z]+)\s+(\d{1,2})(?:\s*[-–]\s*(?:([a-z]+)\s+)?(\d{1,2}))?,?\s+(\d{4})$/);
  if (!match) return null;
  const [, startMonthName, startDay, endMonthName, endDay, yearText] = match;
  const startMonth = MONTHS.indexOf(startMonthName);
  const endMonth = endMonthName ? MONTHS.indexOf(endMonthName) : startMonth;
  if (startMonth < 0 || endMonth < 0) return null;
  const year = Number(yearText);
  // "December 31 - January 1, 2027": the start is the year before.
  const startYear = endMonth < startMonth ? year - 1 : year;
  return {
    startDate: iso(startYear, startMonth, Number(startDay)),
    endDate: iso(year, endMonth, Number(endDay ?? startDay)),
  };
}
