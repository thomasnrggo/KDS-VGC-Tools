"use client";

import type { ReactNode } from "react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { SectionDisabledNotice } from "../SectionDisabledNotice";
import type { FeatureFlags } from "@/types";

interface FeatureGateProps {
  /** Which flag in FeatureFlags this section's route tree is gated by. */
  flagKey: keyof FeatureFlags;
  children: ReactNode;
}

/**
 * Wraps a whole section's route tree (see the layout.tsx in each of
 * matchup-planner/teams/tournaments/speed-tiers) — renders `children`
 * normally when the section's flag is on, or when the current visitor is
 * the admin (who can always reach a disabled section, so there's no way to
 * toggle yourself out of being able to turn it back on), and
 * SectionDisabledNotice otherwise. /admin/* routes are never wrapped by
 * this, for the same "can't lock yourself out" reason.
 *
 * Deliberately doesn't wait on useFeatureFlags/useIsAdmin's isLoading —
 * each section has its own layout.tsx, so this remounts (and its hooks
 * re-fetch) on every navigation between sections, not just on first load;
 * blocking render until both resolve turned every nav into a real network
 * round trip's worth of blank screen, hiding the header along with it (it's
 * rendered by the page, a child of this gate). Both hooks already default
 * to a safe value before they've loaded — useFeatureFlags starts at
 * DEFAULT_FEATURE_FLAGS (every section enabled), useIsAdmin starts at
 * `false` — so evaluating the gate immediately is correct for the
 * overwhelmingly common "enabled" case, and only risks a brief
 * flash-then-hide for the rare case where a section actually is disabled
 * and the fetch hasn't resolved yet.
 */
export function FeatureGate({ flagKey, children }: FeatureGateProps) {
  const { flags } = useFeatureFlags();
  const { isAdmin } = useIsAdmin();

  if (flags[flagKey] || isAdmin) {
    return <>{children}</>;
  }

  return <SectionDisabledNotice />;
}
