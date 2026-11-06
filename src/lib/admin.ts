/**
 * Who can do what. Everyone is a regular "user" unless Firestore's
 * `roles/{uid}` gives them a staff role (set at /admin/users):
 *
 * - "moderator": keeps the shared data up to date — meta sets, public
 *   Damage Calculator sets, seasons, learnset overrides — and sees preview
 *   sections that are switched off for everyone else.
 * - "admin": all of that, plus feature flags and everyone's roles.
 *
 * No one is special-cased: the first admin's doc is created outside the
 * app (`npm run set-role`, or the Firebase console), and no admin can
 * change their own role, so there's always one left. These checks only
 * decide what the app shows; firestore.rules' isStaff()/isAdmin() are what
 * actually allow a write.
 */
export type Role = "admin" | "moderator" | "user";

/** The roles a `roles/{uid}` doc can hold — "user" is the absence of one. */
export type StaffRole = Exclude<Role, "user">;

export const STAFF_ROLES: readonly StaffRole[] = ["moderator", "admin"];

/** Keeps the shared data (meta sets, calc sets, seasons, learnsets) and sees previews. */
export function isStaffRole(role: Role): boolean {
  return role === "admin" || role === "moderator";
}

/** Manages feature flags and roles. */
export function isAdminRole(role: Role): boolean {
  return role === "admin";
}

/** A role doc's value, or "user" for anything else (a missing doc, a typo by hand in the console). */
export function parseRole(value: unknown): Role {
  return value === "admin" || value === "moderator" ? value : "user";
}
