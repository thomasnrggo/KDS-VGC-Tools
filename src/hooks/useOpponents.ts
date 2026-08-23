"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteOpponent,
  deleteOpponents,
  getOpponents,
  saveOpponent,
  syncOpponentsWithCloud,
} from "@/lib/storage/db";
import { createOpponent, getPlanForTeam } from "@/lib/opponent";
import { createTeam, validateTeamSize } from "@/lib/team";
import { useAuth } from "./useAuth";
import type { BulkImportResult, MatchupPlan, Opponent, TeamFolderEntry } from "@/types";

function sortByUpdatedAtDesc(opponents: Opponent[]): Opponent[] {
  return [...opponents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * A duplicate is the same regulation + byte-identical raw paste — e.g.
 * clicking "Load default set" for the same season twice (once per device,
 * or just by habit) creates fresh `crypto.randomUUID()` ids each time with
 * otherwise-identical content, and cloud sync's merge-by-id has no way to
 * know two different ids are "the same" opponent, so both survive and both
 * show up. Catching it here — before an id even exists to merge — is
 * simpler and more reliable than trying to detect it during sync.
 */
function findDuplicate(
  opponents: Opponent[],
  regulationId: string,
  rawPaste: string,
): Opponent | undefined {
  return opponents.find(
    (opponent) => opponent.regulationId === regulationId && opponent.team.rawPaste === rawPaste,
  );
}

export function useOpponents() {
  const { user } = useAuth();
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = user
      ? () =>
          syncOpponentsWithCloud(user.uid).catch((error) => {
            console.error("[cloud sync] pull opponents failed:", error);
            return getOpponents();
          })
      : getOpponents;
    load().then((loaded) => {
      if (!cancelled) {
        setOpponents(sortByUpdatedAtDesc(loaded));
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Returns the created Opponent on success, or an error message string on failure. */
  const addOpponent = useCallback(
    (
      label: string,
      rawPaste: string,
      regulationId: string,
      pokepasteUrl?: string,
    ): Opponent | string => {
      const trimmedLabel = label.trim();
      const trimmedPaste = rawPaste.trim();

      if (!trimmedLabel) {
        return "Give this opponent a name.";
      }
      if (!trimmedPaste) {
        return "Paste the opponent's Showdown export.";
      }

      const opponent = createOpponent(trimmedLabel, trimmedPaste, regulationId, pokepasteUrl || undefined);

      const sizeError = validateTeamSize(opponent.team.pokemon);
      if (sizeError) {
        return sizeError;
      }

      const duplicate = findDuplicate(opponents, regulationId, opponent.team.rawPaste);
      if (duplicate) {
        return `"${duplicate.label}" already has this exact team under this regulation.`;
      }

      setOpponents((prev) => sortByUpdatedAtDesc([opponent, ...prev]));
      void saveOpponent(opponent);
      return opponent;
    },
    [opponents],
  );

  /**
   * Creates one opponent per entry (e.g. from a pasted Showdown team-folder export).
   * Entries that don't parse into a valid 1-6 Pokémon team are skipped, not blocking,
   * so a mostly-good paste still imports everything that's valid.
   */
  const addOpponentsFromFolder = useCallback(
    (entries: TeamFolderEntry[], regulationId: string): BulkImportResult => {
      const created: Opponent[] = [];
      const skipped: string[] = [];
      // Guards against both "this exact team is already an opponent" and
      // "the pasted folder itself lists the same team twice" — the latter
      // wouldn't be caught by checking only against `opponents`.
      const seenRawPastes = new Set(
        opponents
          .filter((opponent) => opponent.regulationId === regulationId)
          .map((opponent) => opponent.team.rawPaste),
      );

      for (const entry of entries) {
        const label = entry.label.trim() || "Unnamed team";
        const opponent = createOpponent(label, entry.rawPaste, regulationId);
        const sizeError = validateTeamSize(opponent.team.pokemon);
        if (sizeError) {
          skipped.push(`${label}: ${sizeError}`);
          continue;
        }
        if (seenRawPastes.has(opponent.team.rawPaste)) {
          skipped.push(`${label}: already exists under this regulation`);
          continue;
        }
        seenRawPastes.add(opponent.team.rawPaste);
        created.push(opponent);
      }

      if (created.length > 0) {
        setOpponents((prev) => sortByUpdatedAtDesc([...created, ...prev]));
        created.forEach((opponent) => void saveOpponent(opponent));
      }

      return { importedCount: created.length, skipped };
    },
    [opponents],
  );

  const removeOpponent = useCallback((id: string) => {
    setOpponents((prev) => prev.filter((opponent) => opponent.id !== id));
    void deleteOpponent(id);
  }, []);

  /** Removes exactly the given opponent ids — the caller decides scope (e.g. "every opponent under the currently-viewed regulation"), not this hook. */
  const removeOpponents = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setOpponents((prev) => prev.filter((opponent) => !idSet.has(opponent.id)));
    void deleteOpponents(ids);
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
    removeOpponents,
    updateOpponent,
    updateOpponentPlan,
    editOpponentTeam,
  };
}
