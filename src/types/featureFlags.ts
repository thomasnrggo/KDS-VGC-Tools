/**
 * Admin-controlled on/off switch for each top-level app section — when a
 * section is off, only the admin account can still see/use it (everyone
 * else loses the nav link and gets redirected off the route). Loaded from
 * Firestore's public `appConfig/featureFlags` doc (see
 * src/lib/firebase/featureFlags.ts and /admin/features), same
 * shared-doc/admin-writes pattern as Season.
 */
export interface FeatureFlags {
  matchupPlanner: boolean;
  teams: boolean;
  tournaments: boolean;
  speedTiers: boolean;
  /** The Team Builder (see docs/team-builder.md) — not linked from the nav yet (see MyTeamHeader's NAV_LINKS), reachable only by direct URL while it's being built out, same as damage-calc was before it launched. */
  teamBuilder: boolean;
  /** The Damage Calculator — hidden since 2026-08-22 while it's checked against other calculators; off until an admin turns it on (the admin always sees it). */
  damageCalc: boolean;
}

/**
 * Every section defaults to on — a missing/not-yet-created Firestore doc
 * must never look like "everything's disabled" — EXCEPT `teamBuilder` and
 * `damageCalc`, which default off since it's new/still being built (see
 * docs/team-builder.md §6): until an admin flips it on in /admin/features,
 * only the admin account (via FeatureGate's `isAdmin` bypass) can reach it.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  matchupPlanner: true,
  teams: true,
  tournaments: true,
  speedTiers: true,
  teamBuilder: false,
  damageCalc: false,
};
