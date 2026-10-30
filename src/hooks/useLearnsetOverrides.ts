"use client";

import { useCallback, useEffect, useState } from "react";
import { getLearnsetOverrides, saveLearnsetOverride } from "@/lib/firebase";
import type { LearnsetOverride, LearnsetOverrides } from "@/lib/learnsets";

// Module-level cache, like useFeatureFlags: one read per session, shared by
// every builder slot and the admin page.
let cachedOverrides: LearnsetOverrides | null = null;
let inFlightFetch: Promise<LearnsetOverrides> | null = null;

function loadOverrides(): Promise<LearnsetOverrides> {
  inFlightFetch ??= getLearnsetOverrides()
    .catch((error) => {
      // No corrections is a safe fallback: the generated learnsets still apply.
      console.error("[learnsets] loading overrides failed:", error);
      return {};
    })
    .then((loaded) => {
      cachedOverrides = loaded;
      return loaded;
    });
  return inFlightFetch;
}

/**
 * The admin's learnset corrections (see src/lib/learnsets.ts) — public
 * read, no sign-in needed. `saveSpecies` (admin only, per firestore.rules)
 * persists first, then updates what's shown; it throws on failure.
 */
export function useLearnsetOverrides() {
  const [overrides, setOverrides] = useState<LearnsetOverrides>(cachedOverrides ?? {});
  const [isLoading, setIsLoading] = useState(cachedOverrides === null);

  useEffect(() => {
    if (cachedOverrides) return;
    let cancelled = false;
    loadOverrides().then((loaded) => {
      if (cancelled) return;
      setOverrides(loaded);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSpecies = useCallback(async (speciesKey: string, override: LearnsetOverride | null) => {
    await saveLearnsetOverride(speciesKey, override);
    setOverrides((current) => {
      const next = { ...current };
      if (override) next[speciesKey] = override;
      else delete next[speciesKey];
      cachedOverrides = next;
      return next;
    });
  }, []);

  return { overrides, isLoading, saveSpecies };
}
