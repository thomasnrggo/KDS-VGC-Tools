"use client";

import { useEffect, useState } from "react";
import { deleteArchetypeSample, getArchetypeSamples, saveArchetypeSample } from "@/lib/firebase";
import type { ArchetypeSample } from "@/lib/archetypes";

/**
 * The archetype sample teams (staff only — load only when `enabled`).
 * `add` and `remove` write first, then update what's shown; they throw on
 * failure.
 */
export function useArchetypeSamples(enabled: boolean) {
  const [samples, setSamples] = useState<ArchetypeSample[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getArchetypeSamples()
      .then((loaded) => {
        if (!cancelled) setSamples(loaded);
      })
      .catch((error) => console.error("[archetypeSamples] loading failed:", error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  async function add(sample: ArchetypeSample) {
    await saveArchetypeSample(sample);
    setSamples((current) => [...current, sample]);
  }

  async function remove(id: string) {
    await deleteArchetypeSample(id);
    setSamples((current) => current.filter((sample) => sample.id !== id));
  }

  return { samples, isLoading, add, remove };
}
