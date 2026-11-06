"use client";

import { useEffect, useState } from "react";
import { getRole } from "@/lib/firebase";
import { isAdminRole, isStaffRole, type Role } from "@/lib/admin";
import { useAuth } from "./useAuth";

/** Each signed-in user's role, kept across page navigations so admin UI doesn't blink. */
const knownRoles = new Map<string, Role>();

/**
 * The signed-in user's role — see src/lib/admin.ts for what each may do.
 * `isStaff` (moderator or admin) keeps the shared data and sees previews;
 * `isAdmin` also manages feature flags and roles. Both are false while
 * loading, so nothing extra shows before the role is known.
 */
export function useIsAdmin() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const uid = user?.uid ?? null;
  const [loaded, setLoaded] = useState<{ uid: string; role: Role } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getRole(uid)
      .then((role) => {
        knownRoles.set(uid, role);
        if (!cancelled) setLoaded({ uid, role });
      })
      .catch((error) => {
        // No access (rules not yet published) or offline: a regular user.
        console.error("[roles] read failed:", error);
        if (!cancelled) setLoaded({ uid, role: "user" });
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Derived from state, not only the module cache: the React Compiler
  // memoizes on props and state, so a cache-only read would go stale.
  const isLoaded = !!uid && loaded?.uid === uid;
  const role: Role = !uid
    ? "user"
    : loaded?.uid === uid
      ? loaded.role
      : (knownRoles.get(uid) ?? "user");
  const isLoading = isAuthLoading || (!!uid && !isLoaded && !knownRoles.has(uid));

  return { role, isAdmin: isAdminRole(role), isStaff: isStaffRole(role), isLoading };
}
