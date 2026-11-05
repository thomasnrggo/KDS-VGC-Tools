"use client";

import { useEffect, useState } from "react";
import { getLibraryFavorites, setLibraryFavorites, syncLibraryFavorites } from "@/lib/storage/db";
import { useAuth } from "./useAuth";

/**
 * The Team Library teams starred on this device — and, signed in, on the
 * account (see syncLibraryFavorites). Keyed by the sheet's team id ("MC780").
 */
export function useLibraryFavorites() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;
    (user ? syncLibraryFavorites(user.uid) : getLibraryFavorites())
      .then((loaded) => {
        if (!cancelled) setIds(loaded);
      })
      .catch((error) => console.error("[team-library] favorites failed to load:", error));
    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  function toggle(id: string) {
    const next = ids.includes(id) ? ids.filter((other) => other !== id) : [id, ...ids];
    setIds(next);
    void setLibraryFavorites(next).catch((error) =>
      console.error("[team-library] favorite failed to save:", error),
    );
  }

  return { favorites: ids, isFavorite: (id: string) => ids.includes(id), toggle };
}
