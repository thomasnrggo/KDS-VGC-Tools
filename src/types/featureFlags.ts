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
}

/** Every section defaults to on — a missing/not-yet-created Firestore doc must never look like "everything's disabled." */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  matchupPlanner: true,
  teams: true,
  tournaments: true,
  speedTiers: true,
};
