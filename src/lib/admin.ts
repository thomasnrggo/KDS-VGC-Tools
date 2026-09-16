/**
 * The whole app has exactly one admin, identified by a single UID compared
 * against `NEXT_PUBLIC_ADMIN_UID` — no Firestore role field, no custom
 * Auth claim. This is a client-side convenience check only (for hiding
 * admin UI from everyone else); the real enforcement is firestore.rules'
 * write:admin-uid-only rules, which reject the request regardless of what
 * this returns. Keep firestore.rules' hardcoded UID literals in sync with
 * this env var by hand — see PLANNING.md.
 *
 * Reads the env var inside the function (not cached at module scope) so
 * it's stubbable per-test — Next.js inlines `process.env.NEXT_PUBLIC_*`
 * textually at build time regardless of where the reference sits, so this
 * has no effect on the real app.
 */
export function isAdminUid(uid: string | null | undefined): boolean {
  const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;
  return Boolean(uid) && Boolean(adminUid) && uid === adminUid;
}
