"use client";

import { useCallback, useEffect, useState } from "react";
import { getMetaSpreads, saveMetaSpread } from "@/lib/firebase";
import type { MetaSpread, MetaSpreads } from "@/lib/meta/metaSpreads";

// Module-level cache per regulation, like useLearnsetOverrides: one read per
// session, shared by the analysis and the admin page.
const cached = new Map<string, MetaSpreads>();
const inFlight = new Map<string, Promise<MetaSpreads>>();

function load(regulationId: string): Promise<MetaSpreads> {
  let request = inFlight.get(regulationId);
  if (!request) {
    request = getMetaSpreads(regulationId)
      .catch((error) => {
        // No spreads is a safe fallback: the estimates still apply.
        console.error("[metaSpreads] loading failed:", error);
        return {};
      })
      .then((loaded) => {
        cached.set(regulationId, loaded);
        return loaded;
      });
    inFlight.set(regulationId, request);
  }
  return request;
}

const NONE: MetaSpreads = {};

/**
 * The admin's common spreads for a regulation's metagame sets (see
 * src/lib/meta/metaSpreads.ts) — public read, no sign-in needed. `save`
 * (admin only, per firestore.rules) persists first, then updates what's
 * shown; it throws on failure.
 */
export function useMetaSpreads(regulationId: string | undefined) {
  const [loaded, setLoaded] = useState<{ regulationId?: string; spreads: MetaSpreads }>({
    spreads: NONE,
  });

  useEffect(() => {
    if (!regulationId) return;
    let cancelled = false;
    load(regulationId).then((spreads) => {
      if (!cancelled) setLoaded({ regulationId, spreads });
    });
    return () => {
      cancelled = true;
    };
  }, [regulationId]);

  // From state, not the module cache alone: the React Compiler memoizes on
  // props and state, so a read of `cached` by itself wouldn't see the load land.
  const isLoaded = loaded.regulationId === regulationId;
  const spreads = isLoaded
    ? loaded.spreads
    : ((regulationId ? cached.get(regulationId) : undefined) ?? NONE);
  const isLoading = !!regulationId && !isLoaded && !cached.has(regulationId);

  const save = useCallback(
    async (key: string, spread: MetaSpread | null) => {
      if (!regulationId) return;
      await saveMetaSpread(regulationId, key, spread);
      const next = { ...(cached.get(regulationId) ?? {}) };
      if (spread) next[key] = spread;
      else delete next[key];
      cached.set(regulationId, next);
      setLoaded({ regulationId, spreads: next });
    },
    [regulationId],
  );

  return { spreads, isLoading, save };
}
