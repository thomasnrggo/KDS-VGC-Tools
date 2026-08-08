"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteOpponent, getOpponents, saveOpponent } from "@/lib/storage/db";
import { createOpponent, type Opponent } from "@/lib/opponent";
import { createTeam, validateTeamSize } from "@/lib/team";

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

  const removeOpponent = useCallback((id: string) => {
    setOpponents((prev) => prev.filter((opponent) => opponent.id !== id));
    void deleteOpponent(id);
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

      const team = createTeam(trimmedPaste);
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

  return { opponents, isLoading, addOpponent, removeOpponent, updateOpponent, editOpponentTeam };
}
