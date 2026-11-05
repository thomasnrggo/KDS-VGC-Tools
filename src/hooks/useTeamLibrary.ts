"use client";

import { useEffect, useState } from "react";
import type { TeamLibraryResponse } from "@/lib/teamLibrary/parseTeamLibrary";

// One request per regulation per session — the server refreshes it daily.
const loaded = new Map<string, TeamLibraryResponse | null>();
const pending = new Map<string, Promise<TeamLibraryResponse | null>>();

function load(regulationId: string): Promise<TeamLibraryResponse | null> {
  let request = pending.get(regulationId);
  if (!request) {
    request = fetch(`/api/team-library/${regulationId}`)
      .then((response) => {
        // 404: VGCPastes has no tab for this regulation.
        if (response.status === 404) return { regulationId, updatedAt: "", teams: [] };
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<TeamLibraryResponse>;
      })
      .catch((error) => {
        console.error("[team-library] load failed:", error);
        pending.delete(regulationId); // a later visit retries
        return null;
      })
      .then((library) => {
        if (library) loaded.set(regulationId, library);
        return library;
      });
    pending.set(regulationId, request);
  }
  return request;
}

/**
 * A regulation's Team Library (see src/lib/teamLibrary). `library` is null
 * while loading and when the load failed (`failed`). State comes only from
 * the async result — the module cache alone wouldn't re-render (the React
 * Compiler memoizes on props and state).
 */
export function useTeamLibrary(regulationId: string) {
  const [entry, setEntry] = useState<{
    regulationId: string;
    library: TeamLibraryResponse | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(regulationId).then((library) => {
      if (!cancelled) setEntry({ regulationId, library });
    });
    return () => {
      cancelled = true;
    };
  }, [regulationId]);

  const isCurrent = entry?.regulationId === regulationId;
  const library = isCurrent ? entry.library : (loaded.get(regulationId) ?? null);
  return { library, isLoading: !isCurrent && !library, failed: isCurrent && !library };
}
