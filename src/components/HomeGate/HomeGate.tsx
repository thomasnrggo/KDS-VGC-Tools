"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * The home page is the Metagame — while that section is switched off
 * (see FeatureGate), everyone but staff goes to the Matchup Planner, the
 * home page before it.
 */
export function HomeGate({ children }: { children: ReactNode }) {
  const { flags, isLoading } = useFeatureFlags();
  const { isStaff, isLoading: roleLoading } = useIsAdmin();
  const router = useRouter();
  const closed = !isLoading && !roleLoading && !flags.metagame && !isStaff;

  useEffect(() => {
    if (closed) router.replace("/matchup-planner");
  }, [closed, router]);

  return closed ? null : <>{children}</>;
}
