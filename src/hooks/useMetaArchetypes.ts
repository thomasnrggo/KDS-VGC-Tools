"use client";

import { useEffect, useState } from "react";
import { getMetaArchetypes } from "@/lib/firebase";
import type { MetaArchetypes } from "@/lib/archetypes";

// One read per regulation per session (~150KB), shared by every team page.
const cached = new Map<string, MetaArchetypes | null>();
const inFlight = new Map<string, Promise<MetaArchetypes | null>>();

function load(regulationId: string): Promise<MetaArchetypes | null> {
  let request = inFlight.get(regulationId);
  if (!request) {
    request = getMetaArchetypes(regulationId)
      .catch((error) => {
        // No data is a safe fallback: the badge still shows the archetype.
        console.error("[metaArchetypes] loading failed:", error);
        inFlight.delete(regulationId);
        return null;
      })
      .then((loaded) => {
        cached.set(regulationId, loaded);
        return loaded;
      });
    inFlight.set(regulationId, request);
  }
  return request;
}

/**
 * The regulation's archetype summary from the metagame job
 * (meta/{regulationId}/archetypes/summary) — public, no sign-in needed. Null
 * while loading and when the job hasn't written one. Loads only when
 * `enabled` (the badge's panel is open), since the document is large.
 */
export function useMetaArchetypes(regulationId: string | undefined, enabled = true) {
  const [loaded, setLoaded] = useState<{ regulationId?: string; data: MetaArchetypes | null }>({
    data: null,
  });

  useEffect(() => {
    if (!regulationId || !enabled) return;
    let cancelled = false;
    load(regulationId).then((data) => {
      if (!cancelled) setLoaded({ regulationId, data });
    });
    return () => {
      cancelled = true;
    };
  }, [regulationId, enabled]);

  // From state, not the module cache alone (the React Compiler memoizes on props and state).
  const isLoaded = loaded.regulationId === regulationId;
  const data = isLoaded
    ? loaded.data
    : ((regulationId ? cached.get(regulationId) : undefined) ?? null);
  const isLoading = !!regulationId && enabled && !isLoaded && !cached.has(regulationId);
  return { data, isLoading };
}
