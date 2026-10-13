"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteOpponent,
  deleteOpponents,
  getOpponents,
  saveOpponent,
  syncOpponentsWithCloud,
} from "@/lib/storage/db";
import {
  compareOpponentOrder,
  getPlanForTeam,
  moveOpponent as moveOpponentInList,
  topSortOrder,
} from "@/lib/opponent";
import {
  analyzeImport,
  buildImport,
  type ImportDecision,
  type ImportEntry,
  type ImportRow,
} from "@/lib/opponentImport";
import {
  asVariantOf,
  clearCopiedPlanFlag,
  detachVariant as detachVariantFromGroup,
  groupOpponents,
  promoteVariant,
} from "@/lib/opponentVariants";
import { createTeam, validateTeamSize } from "@/lib/team";
import { parseTeam } from "@/lib/parseTeam";
import { useAuth } from "./useAuth";
import type { BulkImportResult, MatchupPlan, Opponent } from "@/types";
import { getMessages } from "@/lib/i18n/settings";

function sortByListOrder(opponents: Opponent[]): Opponent[] {
  return [...opponents].sort(compareOpponentOrder);
}

function opponentsInRegulation(opponents: Opponent[], regulationId: string): Opponent[] {
  return opponents.filter((opponent) => opponent.regulationId === regulationId);
}

/**
 * The last loaded opponents, kept across page navigations so a page's first
 * render shows them right away instead of an empty "loading" state — each
 * page mounts its own hook, and the header's team sprites used to blink on
 * every navigation. The hook still reloads in the background on mount.
 */
let cached: Opponent[] | null = null;

export function useOpponents() {
  const { user } = useAuth();
  const [opponents, setOpponents] = useState<Opponent[]>(() => cached ?? []);
  const [isLoading, setIsLoading] = useState(() => cached === null);

  useEffect(() => {
    if (!isLoading) cached = opponents;
  }, [opponents, isLoading]);

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
        setOpponents(loaded);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Optimistically merges `changed` into state and persists each. */
  const applyChanges = useCallback((changed: Opponent[]) => {
    if (changed.length === 0) return;
    const changedById = new Map(changed.map((opponent) => [opponent.id, opponent]));
    setOpponents((prev) => {
      const known = new Set(prev.map((opponent) => opponent.id));
      return [
        ...prev.map((opponent) => changedById.get(opponent.id) ?? opponent),
        ...changed.filter((opponent) => !known.has(opponent.id)),
      ];
    });
    changed.forEach((opponent) => void saveOpponent(opponent));
  }, []);

  /**
   * Step one of adding opponents (single add, mass import, or a default
   * set): sorts each incoming team into can't-import / exact duplicate /
   * importable-with-variant-candidates — see analyzeImport. Catching
   * duplicates here, before an id even exists, matters: e.g. loading the
   * same default set twice (once per device, or just by habit) would
   * otherwise create fresh ids with identical content, and cloud sync's
   * merge-by-id can't tell they're "the same" opponent.
   */
  const analyzeOpponentImport = useCallback(
    (entries: ImportEntry[], regulationId: string): ImportRow[] =>
      analyzeImport(entries, sortByListOrder(opponentsInRegulation(opponents, regulationId))),
    [opponents],
  );

  /** Step two: saves the analyzed rows per the (possibly user-reviewed) decisions. */
  const importOpponents = useCallback(
    (rows: ImportRow[], decisions: ImportDecision[], regulationId: string): BulkImportResult => {
      const { created, result } = buildImport(
        rows,
        decisions,
        opponentsInRegulation(opponents, regulationId),
        regulationId,
      );
      applyChanges(created);
      return result;
    },
    [opponents, applyChanges],
  );

  /** One regulation's opponents as groups (mains in list order, each with its variants). */
  const groupsIn = useCallback(
    (regulationId: string) =>
      groupOpponents(sortByListOrder(opponentsInRegulation(opponents, regulationId))),
    [opponents],
  );

  /** Removing a main that has variants promotes its first variant rather than orphaning the group. */
  const removeOpponent = useCallback(
    (id: string) => {
      const target = opponents.find((opponent) => opponent.id === id);
      const group = target && groupsIn(target.regulationId).find((g) => g.main.id === id);
      if (group && group.variants.length > 0) {
        const now = new Date().toISOString();
        applyChanges(
          promoteVariant(group, group.variants[0].id, now).filter((opponent) => opponent.id !== id),
        );
      }
      setOpponents((prev) => prev.filter((opponent) => opponent.id !== id));
      void deleteOpponent(id);
    },
    [opponents, groupsIn, applyChanges],
  );

  /** Removes exactly the given opponent ids — the caller decides scope (e.g. "every opponent under the currently-viewed regulation"), not this hook. */
  const removeOpponents = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setOpponents((prev) => prev.filter((opponent) => !idSet.has(opponent.id)));
    void deleteOpponents(ids);
  }, []);

  /** Makes variant `newMainId` the main of the group `mainId` currently heads. */
  const setGroupMain = useCallback(
    (mainId: string, newMainId: string) => {
      const main = opponents.find((opponent) => opponent.id === mainId);
      const group = main && groupsIn(main.regulationId).find((g) => g.main.id === mainId);
      if (group) applyChanges(promoteVariant(group, newMainId, new Date().toISOString()));
    },
    [opponents, groupsIn, applyChanges],
  );

  /**
   * Files opponent `id` — and any variants of its own, keeping groups one
   * level deep — under the group `mainId` heads, at the top of its variants
   * (newest on top, like the main list). Plans the main has that they don't
   * are copied over (see asVariantOf).
   */
  const makeVariant = useCallback(
    (id: string, mainId: string) => {
      const target = opponents.find((opponent) => opponent.id === id);
      const main = opponents.find((opponent) => opponent.id === mainId);
      if (!target || !main || id === mainId) return;
      const groups = groupsIn(target.regulationId);
      const ownGroup = groups.find((g) => g.main.id === id);
      const joining = [target, ...(ownGroup?.variants ?? [])];
      const top = topSortOrder(groups.find((g) => g.main.id === mainId)?.variants ?? []);
      const now = new Date().toISOString();
      applyChanges(
        joining.map((opponent, index) => ({
          ...asVariantOf(opponent, main, now),
          sortOrder: top + joining.length - 1 - index,
        })),
      );
    },
    [opponents, groupsIn, applyChanges],
  );

  /** Takes variant `id` out of its group, placing it in the list right below its old main. */
  const detachVariant = useCallback(
    (id: string) => {
      const variant = opponents.find((opponent) => opponent.id === id);
      if (!variant?.variantOf) return;
      const now = new Date().toISOString();
      const detached = detachVariantFromGroup(variant, now);
      const mains = groupsIn(variant.regulationId).map((group) => group.main);
      const mainIndex = mains.findIndex((main) => main.id === variant.variantOf);
      // Position it among the mains via moveOpponent's midpoint logic: append
      // it, then move it to just below its main.
      const moved = moveOpponentInList([...mains, detached], id, mainIndex + 1);
      const placed = moved.find((opponent) => opponent.id === id) ?? {
        ...detached,
        // moveOpponent returns nothing when it's already in place — i.e. its
        // main is the last one; just go below it.
        sortOrder: (mains[mainIndex]?.sortOrder ?? detached.sortOrder) - 1,
      };
      applyChanges([...moved.filter((opponent) => opponent.id !== id), placed]);
    },
    [opponents, groupsIn, applyChanges],
  );

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

  /**
   * Moves `movedId` to `toIndex` within `orderedIds` — one regulation's main
   * opponents in their current list order (not a reversed view; the caller
   * translates). Persists only the opponents whose sortOrder changed, which
   * is normally just the moved one (see moveOpponent in src/lib/opponent.ts).
   */
  const moveOpponent = useCallback(
    (orderedIds: string[], movedId: string, toIndex: number) => {
      const byId = new Map(opponents.map((opponent) => [opponent.id, opponent]));
      const ordered = orderedIds.flatMap((id) => byId.get(id) ?? []);
      applyChanges(moveOpponentInList(ordered, movedId, toIndex));
    },
    [opponents, applyChanges],
  );

  /** Re-parses `rawPaste` and replaces the opponent's label/team/link. Returns an error message on failure. */
  const editOpponentTeam = useCallback(
    (id: string, label: string, rawPaste: string, pokepasteUrl?: string): string | null => {
      const trimmedLabel = label.trim();
      const trimmedPaste = rawPaste.trim();

      if (!trimmedLabel) {
        return getMessages().errors.opponentNameRequired;
      }
      if (!trimmedPaste) {
        return getMessages().errors.opponentPasteRequired;
      }

      const sizeError = validateTeamSize(parseTeam(trimmedPaste));
      if (sizeError) {
        return sizeError;
      }

      updateOpponent(id, (opponent) => ({
        ...opponent,
        label: trimmedLabel,
        team: createTeam(trimmedPaste, trimmedLabel, opponent.regulationId),
        pokepasteUrl: pokepasteUrl || undefined,
      }));
      return null;
    },
    [updateOpponent],
  );

  const setOpponentTags = useCallback(
    (id: string, tags: string[]) => {
      updateOpponent(id, (opponent) => ({ ...opponent, tags }));
    },
    [updateOpponent],
  );

  /**
   * Applies `updater` to the matchup plan opponent `id` has for team
   * `teamId`, persisting the result. Editing a plan that was copied from the
   * group's main makes it this variant's own, so the "Copied from …" badge
   * goes away.
   */
  const updateOpponentPlan = useCallback(
    (id: string, teamId: string, updater: (plan: MatchupPlan) => MatchupPlan) => {
      updateOpponent(id, (opponent) =>
        clearCopiedPlanFlag(
          {
            ...opponent,
            plansByTeamId: {
              ...opponent.plansByTeamId,
              [teamId]: updater(getPlanForTeam(opponent, teamId)),
            },
          },
          teamId,
        ),
      );
    },
    [updateOpponent],
  );

  return {
    // Sorted on every render (not just on load) so a move — which only patches
    // sortOrder values, not array position — shows up immediately.
    opponents: sortByListOrder(opponents),
    isLoading,
    analyzeOpponentImport,
    importOpponents,
    removeOpponent,
    removeOpponents,
    moveOpponent,
    setGroupMain,
    makeVariant,
    detachVariant,
    updateOpponent,
    updateOpponentPlan,
    setOpponentTags,
    editOpponentTeam,
  };
}
