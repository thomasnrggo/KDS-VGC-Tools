/**
 * A dated snapshot within a Regulation (see src/data/regulations) — e.g.
 * Regulation M-B's "M-5" season, Aug 5–Sep 9 2026. Legality (species/items)
 * doesn't vary by season, only by regulation, so a Season carries just the
 * "meta" default-team-set data (what "Load default set" imports) plus
 * enough to know which regulation it belongs to and when it's current.
 * Loaded from Firestore's public `seasons` collection (see
 * src/lib/firebase/seasons.ts) — admin-editable via /admin/seasons, since
 * unlike Regulation's legality data this changes roughly monthly and
 * shouldn't require a code change + redeploy each time.
 */
export interface Season {
  id: string;
  /** Regulation.id this season belongs to — see src/data/regulations. */
  regulationId: string;
  /** Shown in the season switcher, e.g. "M-5". */
  label: string;
  /** ISO date (YYYY-MM-DD) — this season is "current" when today falls within [startDate, endDate]. */
  startDate: string;
  endDate: string;
  /** Showdown team-folder export text, fed into parseTeamFolder the same way a pasted bulk import is. */
  rawPaste: string;
}
