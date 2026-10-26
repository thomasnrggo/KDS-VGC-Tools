"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteTournament,
  getTournaments,
  saveTournament,
  syncTournamentsWithCloud,
} from "@/lib/storage/db";
import { createTournament } from "@/lib/tournament";
import { useAuth } from "./useAuth";
import type { Tournament } from "@/types";
import { getMessages } from "@/lib/i18n/settings";

function sortByUpdatedAtDesc(tournaments: Tournament[]): Tournament[] {
  return [...tournaments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * The last loaded tournaments, kept across page navigations so a page's first
 * render shows them right away instead of an empty "loading" state — each
 * page mounts its own hook, and the header's team sprites used to blink on
 * every navigation. The hook still reloads in the background on mount.
 */
let cached: Tournament[] | null = null;

export function useTournaments() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>(() => cached ?? []);
  const [isLoading, setIsLoading] = useState(() => cached === null);

  useEffect(() => {
    if (!isLoading) cached = tournaments;
  }, [tournaments, isLoading]);

  useEffect(() => {
    // Wait until we know whether someone is signed in: loading the local copy
    // first and the cloud sync after showed the list, then replaced it.
    if (isAuthLoading) return;
    let cancelled = false;
    const load = user
      ? () =>
          syncTournamentsWithCloud(user.uid).catch((error) => {
            console.error("[cloud sync] pull tournaments failed:", error);
            return getTournaments();
          })
      : getTournaments;
    load().then((loaded) => {
      if (!cancelled) {
        setTournaments(sortByUpdatedAtDesc(loaded));
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  /** Creates a new tournament for `teamId`/`regulationId` and returns it. */
  const addTournament = useCallback(
    (name: string, teamId: string, regulationId: string): Tournament => {
      const tournament = createTournament(
        name.trim() || getMessages().errors.untitledTournament,
        teamId,
        regulationId,
      );
      setTournaments((prev) => sortByUpdatedAtDesc([tournament, ...prev]));
      void saveTournament(tournament);
      return tournament;
    },
    [],
  );

  /** Applies `updater` to the tournament with `id`, persisting the result. No-op if not found. */
  const updateTournament = useCallback(
    (id: string, updater: (tournament: Tournament) => Tournament) => {
      setTournaments((prev) => {
        let updated: Tournament | undefined;
        const next = prev.map((tournament) => {
          if (tournament.id !== id) return tournament;
          updated = { ...updater(tournament), updatedAt: new Date().toISOString() };
          return updated;
        });
        if (updated) {
          void saveTournament(updated);
        }
        return next;
      });
    },
    [],
  );

  const removeTournament = useCallback((id: string) => {
    setTournaments((prev) => prev.filter((tournament) => tournament.id !== id));
    void deleteTournament(id);
  }, []);

  return {
    tournaments,
    isLoading,
    addTournament,
    updateTournament,
    removeTournament,
  };
}
