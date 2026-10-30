"use client";

import { useCallback, useEffect, useState } from "react";
import { getFeatureFlags, saveFeatureFlags } from "@/lib/firebase";
import { DEFAULT_FEATURE_FLAGS } from "@/types";
import type { FeatureFlags } from "@/types";
import { useIsAdmin } from "./useIsAdmin";

// Module-level cache — each of the 4 gated sections has its own layout.tsx
// (see FeatureGate), and MyTeamHeader calls this hook too, so it remounts
// on every navigation between sections, not just on first load. Without a
// shared cache that meant a fresh Firestore read on every nav; with it, the
// real network read happens once per browser session (or once per
// concurrent burst — two components mounting around the same time share
// the one in-flight fetch instead of racing separate reads) and every
// later mount reuses the resolved value.
let cachedFlags: FeatureFlags | null = null;
let inFlightFetch: Promise<FeatureFlags> | null = null;

function loadFeatureFlags(): Promise<FeatureFlags> {
  if (cachedFlags) return Promise.resolve(cachedFlags);
  if (!inFlightFetch) {
    inFlightFetch = getFeatureFlags()
      .catch((error) => {
        console.error("[feature flags] load failed, defaulting to all enabled:", error);
        return DEFAULT_FEATURE_FLAGS;
      })
      .then((loaded) => {
        cachedFlags = loaded;
        inFlightFetch = null;
        return loaded;
      });
  }
  return inFlightFetch;
}

/**
 * Loads the shared, admin-editable feature-flag doc (see /admin/features) —
 * public Firestore read, no sign-in required. Falls back to every section
 * enabled if the read fails, same "fail open" reasoning as useSeasons: a
 * transient network error must never look like every section got disabled.
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(cachedFlags ?? DEFAULT_FEATURE_FLAGS);
  const [isLoading, setIsLoading] = useState(cachedFlags === null);

  useEffect(() => {
    if (cachedFlags) return;
    let cancelled = false;
    loadFeatureFlags().then((loaded) => {
      if (cancelled) return;
      setFlags(loaded);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persists first, then updates local state and the module cache (so later mounts this session see the fresh value without a new fetch) — same order admin/seasons' handleSubmit uses, so a failed write never leaves the UI showing a change that didn't actually save. Throws on failure; the admin toggle page catches it to toast. */
  const updateFlags = useCallback(async (next: FeatureFlags) => {
    await saveFeatureFlags(next);
    cachedFlags = next;
    setFlags(next);
  }, []);

  return { flags, isLoading, updateFlags };
}

/** Whether a section is usable here — its flag is on, or the visitor is the admin (same rule as FeatureGate) — for links into a gated section from elsewhere. */
export function useFeatureEnabled(flagKey: keyof FeatureFlags): boolean {
  const { flags } = useFeatureFlags();
  const { isAdmin } = useIsAdmin();
  return flags[flagKey] || isAdmin;
}
