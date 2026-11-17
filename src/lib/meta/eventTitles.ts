/**
 * Event titles renamed by an admin (/admin/meta-events) — a hand-uploaded
 * event's file may say just "Buenos Aires". One public doc,
 * `appConfig/metaEventTitles`, keyed by event id. The saved event keeps its
 * original title; the metagame job (scripts/update-meta.mjs) publishes the
 * new one in every summary it writes, and rebuilds a summary whose titles
 * are out of step — with nothing new to fetch.
 */
export interface EventTitle {
  title: string;
  /** The event's own title when it was renamed, to show what it was. */
  original?: string;
  /** ISO timestamp, and who (display name). */
  renamedAt: string;
  renamedBy: string;
}

export type EventTitles = Record<string, EventTitle>;

/** The title an event is published under: the admin's, else its own. */
export function eventTitle(event: { id: string; title: string }, titles: EventTitles): string {
  return titles[event.id]?.title.trim() || event.title;
}

/**
 * Whether a summary's titles are out of step with the renames: one of its
 * events is published under another title than it should be. `saved` holds
 * each saved event's original title, by id.
 */
export function titlesNeedRebuild(
  summary: { id: string; title: string }[],
  saved: Map<string, string>,
  titles: EventTitles,
): boolean {
  return summary.some((event) => {
    const original = saved.get(event.id);
    return (
      original !== undefined &&
      event.title !== eventTitle({ id: event.id, title: original }, titles)
    );
  });
}
