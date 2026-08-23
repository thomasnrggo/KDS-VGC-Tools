"use client";

import { useEffect, useState } from "react";
import { getSeasons } from "@/lib/firebase";
import { FALLBACK_SEASONS } from "@/data/seasons";
import type { Season } from "@/types";

function sortByStartDateDesc(seasons: Season[]): Season[] {
  return [...seasons].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/** The season whose [startDate, endDate] covers today, or — if today falls in a gap between seasons — the most recent one that's already started. */
function resolveCurrentSeasonId(seasons: Season[]): string | null {
  if (seasons.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);

  const active = seasons.find((season) => season.startDate <= today && today <= season.endDate);
  if (active) return active.id;

  const started = sortByStartDateDesc(seasons.filter((season) => season.startDate <= today));
  return (started[0] ?? sortByStartDateDesc(seasons)[seasons.length - 1])?.id ?? null;
}

/**
 * Loads the shared, admin-editable season list (see /admin/seasons) —
 * public Firestore read, no sign-in required, falling back to a small
 * static seed if that read fails so "Load default set" never just
 * disappears. Exposes which season is "current" by date so callers can
 * default to it while still letting the user pick a different one.
 */
export function useSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSeasons()
      .catch((error) => {
        console.error("[seasons] load failed, using fallback:", error);
        return FALLBACK_SEASONS;
      })
      .then((loaded) => {
        if (cancelled) return;
        setSeasons(sortByStartDateDesc(loaded.length > 0 ? loaded : FALLBACK_SEASONS));
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentSeasonId = resolveCurrentSeasonId(seasons);

  return { seasons, currentSeasonId, isLoading };
}
