/**
 * pokedata.ovh's event list (`standings2/`, HTML — it has no JSON index):
 * each event is a title, a date line ("October 24-25, 2026") and a form
 * carrying its id. Self-contained (no imports) so the meta job can run it
 * with Node's own TypeScript support — see scripts/update-meta.mjs.
 */

export interface IndexedEvent {
  id: string;
  title: string;
  /** ISO dates (YYYY-MM-DD). */
  startDate: string;
  endDate: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isoDate(year: number, month: string, day: number): string | null {
  const index = MONTHS.indexOf(month);
  if (index === -1 || day < 1 || day > 31) return null;
  return `${year}-${String(index + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * "October 24-25, 2026", "October 31-November 1, 2026", "November 7, 2026"
 * → start and end ISO dates; null for anything else.
 */
export function parseEventDates(text: string): { startDate: string; endDate: string } | null {
  const match = /^([A-Z][a-z]+) (\d{1,2})(?:\s*-\s*(?:([A-Z][a-z]+) )?(\d{1,2}))?,\s*(\d{4})$/.exec(
    text.trim(),
  );
  if (!match) return null;
  const [, startMonth, startDay, endMonth, endDay, year] = match;
  const startDate = isoDate(Number(year), startMonth, Number(startDay));
  const endDate = isoDate(Number(year), endMonth ?? startMonth, Number(endDay ?? startDay));
  return startDate && endDate ? { startDate, endDate } : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&eacute;/g, "é")
    .trim();
}

/**
 * Every event in the index, in page order: each id takes the title and date
 * that came before it. Events whose date doesn't parse are left out.
 */
export function parseEventIndex(html: string): IndexedEvent[] {
  const tokens = html.matchAll(
    /class="title">([^<]*)<|class="date">([^<]*)<|name="id" value="(\d+)"/g,
  );
  const events: IndexedEvent[] = [];
  const seen = new Set<string>();
  let title: string | null = null;
  let date: string | null = null;
  for (const [, titleText, dateText, id] of tokens) {
    if (titleText !== undefined) title = decodeEntities(titleText);
    else if (dateText !== undefined) date = decodeEntities(dateText);
    else if (id && title && date && !seen.has(id)) {
      const dates = parseEventDates(date);
      if (dates) {
        events.push({ id, title, ...dates });
        seen.add(id);
      }
    }
  }
  return events;
}

/** A VGC event (the index lists the TCG's too). */
export function isVgcEvent(event: IndexedEvent): boolean {
  return /\bVGC\b/.test(event.title);
}

/** Over, with a day's margin for results still being finalized. */
export function isFinished(event: IndexedEvent, today: string): boolean {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  return event.endDate < cutoff.toISOString().slice(0, 10);
}

/**
 * When each regulation was in play — the app's registry (src/data/regulations)
 * doesn't carry dates. Newest first; `end` is exclusive, null while current.
 */
export const REGULATION_PERIODS: { id: string; start: string; end: string | null }[] = [
  { id: "regulation-m-c", start: "2026-09-09", end: null },
  { id: "regulation-m-b", start: "2026-06-17", end: "2026-09-09" },
  { id: "regulation-m-a", start: "2026-04-08", end: "2026-06-17" },
];

/** The regulation an event on this (start) date was played under, or null. */
export function regulationForDate(date: string): string | null {
  return (
    REGULATION_PERIODS.find(
      (period) => period.start <= date && (period.end === null || date < period.end),
    )?.id ?? null
  );
}
