/**
 * Official events left out of the metagame by an admin (/admin/meta-events):
 * a bad import, a format that doesn't fit… The metagame job
 * (scripts/update-meta.mjs) keeps each event's anonymized copy either way —
 * excluding never re-fetches anything — but leaves excluded ones out of every
 * summary it writes. One public doc, `appConfig/metaExcludedEvents`, keyed by
 * event id; it keeps the event's details so the admin page can still list an
 * event once it's gone from the summary.
 */
export interface ExcludedEvent {
  id: string;
  title: string;
  regulationId: string;
  /** ISO dates. */
  startDate: string;
  endDate: string;
  teams: number;
  /** ISO timestamp, and who (display name). */
  excludedAt: string;
  excludedBy: string;
}

export type ExcludedEvents = Record<string, ExcludedEvent>;

/**
 * Whether a regulation's summary is out of step with its exclusions: it lists
 * an excluded event, or misses an included one. The job rebuilds it then,
 * even with no new event to fetch.
 */
export function summaryNeedsRebuild(summaryIds: string[], includedIds: string[]): boolean {
  const summary = new Set(summaryIds);
  return summary.size !== includedIds.length || includedIds.some((id) => !summary.has(id));
}
