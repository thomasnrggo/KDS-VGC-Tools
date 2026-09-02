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

function sortByUpdatedAtDesc(tournaments: Tournament[]): Tournament[] {
  return [...tournaments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function useTournaments() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
  }, [user]);

  /** Creates a new tournament for `teamId`/`regulationId` and returns it. */
  const addTournament = useCallback((name: string, teamId: string, regulationId: string): Tournament => {
    const tournament = createTournament(name.trim() || "Untitled Tournament", teamId, regulationId);
    setTournaments((prev) => sortByUpdatedAtDesc([tournament, ...prev]));
    void saveTournament(tournament);
    return tournament;
  }, []);

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
