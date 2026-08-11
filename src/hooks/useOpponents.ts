"use client";

import { useCallback, useEffect, useState } from "react";
import { clearOpponents, deleteOpponent, getOpponents, saveOpponent } from "@/lib/storage/db";
import { createOpponent, getPlanForTeam } from "@/lib/opponent";
import { createTeam, validateTeamSize } from "@/lib/team";
import type { BulkImportResult, MatchupPlan, Opponent, TeamFolderEntry } from "@/types";

function sortByUpdatedAtDesc(opponents: Opponent[]): Opponent[] {
  return [...opponents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function useOpponents() {
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getOpponents().then((loaded) => {
      if (!cancelled) {
        setOpponents(sortByUpdatedAtDesc(loaded));
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Returns the created Opponent on success, or an error message string on failure. */
  const addOpponent = useCallback(
    (label: string, rawPaste: string, pokepasteUrl?: string): Opponent | string => {
      const trimmedLabel = label.trim();
      const trimmedPaste = rawPaste.trim();

      if (!trimmedLabel) {
        return "Give this opponent a name.";
      }
      if (!trimmedPaste) {
        return "Paste the opponent's Showdown export.";
      }

      const opponent = createOpponent(trimmedLabel, trimmedPaste, pokepasteUrl || undefined);

      const sizeError = validateTeamSize(opponent.team.pokemon);
      if (sizeError) {
        return sizeError;
      }

      setOpponents((prev) => sortByUpdatedAtDesc([opponent, ...prev]));
      void saveOpponent(opponent);
      return opponent;
    },
    [],
  );

  /**
   * Creates one opponent per entry (e.g. from a pasted Showdown team-folder export).
   * Entries that don't parse into a valid 1-6 Pokémon team are skipped, not blocking,
   * so a mostly-good paste still imports everything that's valid.
   */
  const addOpponentsFromFolder = useCallback((entries: TeamFolderEntry[]): BulkImportResult => {
    const created: Opponent[] = [];
    const skipped: string[] = [];

    for (const entry of entries) {
      const label = entry.label.trim() || "Unnamed team";
      const opponent = createOpponent(label, entry.rawPaste);
      const sizeError = validateTeamSize(opponent.team.pokemon);
      if (sizeError) {
        skipped.push(`${label}: ${sizeError}`);
        continue;
      }
      created.push(opponent);
    }

    if (created.length > 0) {
      setOpponents((prev) => sortByUpdatedAtDesc([...created, ...prev]));
      created.forEach((opponent) => void saveOpponent(opponent));
    }

    return { importedCount: created.length, skipped };
  }, []);

  const removeOpponent = useCallback((id: string) => {
    setOpponents((prev) => prev.filter((opponent) => opponent.id !== id));
    void deleteOpponent(id);
  }, []);

  const removeAllOpponents = useCallback(() => {
    setOpponents([]);
    void clearOpponents();
  }, []);

  /** Applies `updater` to the opponent with `id`, persisting the result. No-op if not found. */
  const updateOpponent = useCallback((id: string, updater: (opponent: Opponent) => Opponent) => {
    setOpponents((prev) => {
      let updated: Opponent | undefined;
      const next = prev.map((opponent) => {
        if (opponent.id !== id) {
          return opponent;
        }
        updated = { ...updater(opponent), updatedAt: new Date().toISOString() };
        return updated;
      });
      if (updated) {
        void saveOpponent(updated);
      }
      return next;
    });
  }, []);

  /** Re-parses `rawPaste` and replaces the opponent's label/team/link. Returns an error message on failure. */
  const editOpponentTeam = useCallback(
    (id: string, label: string, rawPaste: string, pokepasteUrl?: string): string | null => {
      const trimmedLabel = label.trim();
      const trimmedPaste = rawPaste.trim();

      if (!trimmedLabel) {
        return "Give this opponent a name.";
      }
      if (!trimmedPaste) {
        return "Paste the opponent's Showdown export.";
      }

      const team = createTeam(trimmedPaste, trimmedLabel);
      const sizeError = validateTeamSize(team.pokemon);
      if (sizeError) {
        return sizeError;
      }

      updateOpponent(id, (opponent) => ({
        ...opponent,
        label: trimmedLabel,
        team,
        pokepasteUrl: pokepasteUrl || undefined,
      }));
      return null;
    },
    [updateOpponent],
  );

  /** Applies `updater` to the matchup plan opponent `id` has for team `teamId`, persisting the result. */
  const updateOpponentPlan = useCallback(
    (id: string, teamId: string, updater: (plan: MatchupPlan) => MatchupPlan) => {
      updateOpponent(id, (opponent) => ({
        ...opponent,
        plansByTeamId: {
          ...opponent.plansByTeamId,
          [teamId]: updater(getPlanForTeam(opponent, teamId)),
        },
      }));
    },
    [updateOpponent],
  );

  return {
    opponents,
    isLoading,
    addOpponent,
    addOpponentsFromFolder,
    removeOpponent,
    removeAllOpponents,
    updateOpponent,
    updateOpponentPlan,
    editOpponentTeam,
  };
}
