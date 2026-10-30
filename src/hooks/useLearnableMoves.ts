"use client";

import { useEffect, useState } from "react";
import { useLearnsetOverrides } from "./useLearnsetOverrides";
import { loadLearnsets, speciesLearnableMoves, type LearnsetData } from "@/lib/learnsets";

/**
 * The moves (moves.json keys) a saved Pokémon learns, the admin's corrections
 * included — null while the data loads, or for a form nothing covers (then
 * callers list every move). Shared by the Team Builder and the Damage
 * Calculator's move fields.
 */
export function useLearnableMoves(species: string | undefined): Set<string> | null {
  const [data, setData] = useState<LearnsetData | null>(null);
  const { overrides } = useLearnsetOverrides();

  useEffect(() => {
    let cancelled = false;
    loadLearnsets().then((loaded) => {
      if (!cancelled) setData(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!species || !data) return null;
  return speciesLearnableMoves(data, overrides, species);
}
