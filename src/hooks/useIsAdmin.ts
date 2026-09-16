"use client";

import { useAuth } from "./useAuth";
import { isAdminUid } from "@/lib/admin";

/** Whether the signed-in user is the site admin — see src/lib/admin.ts for what that actually checks. `isLoading` mirrors useAuth's own loading state, since "is this the admin" isn't knowable until auth state resolves. */
export function useIsAdmin() {
  const { user, isLoading } = useAuth();
  return { isAdmin: isAdminUid(user?.uid), isLoading };
}
