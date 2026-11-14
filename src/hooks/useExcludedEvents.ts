"use client";

import { useEffect, useState } from "react";
import { getExcludedEvents, setEventExcluded } from "@/lib/firebase";
import type { ExcludedEvent, ExcludedEvents } from "@/lib/meta/excludedEvents";

/**
 * The events left out of the metagame (src/lib/meta/excludedEvents.ts), for
 * /admin/meta-events. `setExcluded` (staff only, per firestore.rules)
 * persists first, then updates what's shown; it throws on failure.
 */
export function useExcludedEvents() {
  const [excluded, setExcludedState] = useState<ExcludedEvents | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExcludedEvents()
      .catch((error) => {
        console.error("[metaExcludedEvents] loading failed:", error);
        return {};
      })
      .then((loaded) => {
        if (!cancelled) setExcludedState(loaded);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function setExcluded(id: string, event: ExcludedEvent | null) {
    await setEventExcluded(id, event);
    setExcludedState((current) => {
      const next = { ...current };
      if (event) next[id] = event;
      else delete next[id];
      return next;
    });
  }

  return { excluded: excluded ?? {}, isLoading: excluded === null, setExcluded };
}
