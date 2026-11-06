/**
 * Who can do what. Everyone is a regular "user" unless Firestore's
 * `roles/{uid}` gives them a staff role (set at /admin/users):
 *
 * - "moderator": keeps the shared data up to date — meta sets, public
 *   Damage Calculator sets, seasons, learnset overrides — and sees preview
 *   sections that are switched off for everyone else.
 * - "admin": all of that, plus feature flags and everyone's roles.
 *
 * The owner (`NEXT_PUBLIC_ADMIN_UID`, also hard-coded in firestore.rules)
 * is always an admin, with or without a role doc, so nobody can lock the
 * site out of its admin pages. These checks only decide what the app
 * shows; firestore.rules' isStaff()/isAdmin() are what actually allow a
 * write.
 */
export type Role = "admin" | "moderator" | "user";

/** The roles a `roles/{uid}` doc can hold — "user" is the absence of one. */
export type StaffRole = Exclude<Role, "user">;

export const STAFF_ROLES: readonly StaffRole[] = ["moderator", "admin"];

/**
 * Whether `uid` is the site's owner. Reads the env var inside the function
 * (not cached at module scope) so it's stubbable per-test — Next.js inlines
 * `process.env.NEXT_PUBLIC_*` at build time wherever the reference sits.
 */
export function isOwnerUid(uid: string | null | undefined): boolean {
  const ownerUid = process.env.NEXT_PUBLIC_ADMIN_UID;
  return Boolean(uid) && Boolean(ownerUid) && uid === ownerUid;
}

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
