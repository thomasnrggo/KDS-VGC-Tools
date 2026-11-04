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
  metagame: boolean;
  /**
   * Not a section: the team page's Threats tab, a preview still being
   * designed (see PLANNING.md's "Team analysis from the metagame").
   */
  teamThreats: boolean;
}

/**
 * Every section defaults to on — a missing/not-yet-created Firestore doc
 * must never look like "everything's disabled". A preview defaults to off
 * the other way round: a missing key (or a failed read) mustn't show it to
 * everyone before it's ready.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  matchupPlanner: true,
  teams: true,
  tournaments: true,
  speedTiers: true,
  metagame: true,
  teamThreats: false,
};
