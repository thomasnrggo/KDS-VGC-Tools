"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
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
import { getMessages } from "@/lib/i18n/settings";
import type { BulkImportResult, MatchupPlan, Opponent } from "@/types";

/**
 * Where an opponent list saves — the personal list (IndexedDB + cloud sync)
 * or a prep group (Firestore, shared part and private plan split; see
 * useGroupOpponents). `before` is the opponent as it was, absent for a new one.
 */
export interface OpponentStore {
  save: (changes: { before?: Opponent; after: Opponent }[]) => void;
  remove: (ids: string[]) => void;
}

export function sortByListOrder(opponents: Opponent[]): Opponent[] {
  return [...opponents].sort(compareOpponentOrder);
}

function opponentsInRegulation(opponents: Opponent[], regulationId: string): Opponent[] {
  return opponents.filter((opponent) => opponent.regulationId === regulationId);
}

/**
 * Everything you can do to an opponent list — add/import, remove, reorder,
 * variants, tags, edit, plans — on top of its state, saving through `store`.
 * Shared by useOpponents (personal) and useGroupOpponents (prep groups).
 */
export function useOpponentActions(
  opponents: Opponent[],
  setOpponents: Dispatch<SetStateAction<Opponent[]>>,
  store: OpponentStore,
) {
  // The latest list and store, for "what was it before" lookups inside
  // callbacks without re-creating them on every change.
  const latest = useRef(opponents);
  const storeRef = useRef(store);
  useEffect(() => {
    latest.current = opponents;
    storeRef.current = store;
  });

  /** Optimistically merges `changed` into state and persists each. */
  const applyChanges = useCallback(
    (changed: Opponent[]) => {
      if (changed.length === 0) return;
      const prev = latest.current;
      const beforeById = new Map(prev.map((opponent) => [opponent.id, opponent]));
      const changedById = new Map(changed.map((opponent) => [opponent.id, opponent]));
      const next = [
        ...prev.map((opponent) => changedById.get(opponent.id) ?? opponent),
        ...changed.filter((opponent) => !beforeById.has(opponent.id)),
      ];
      // Updated right away, not on the next render, so back-to-back changes
      // each see the previous one.
      latest.current = next;
      setOpponents(next);
      storeRef.current.save(
        changed.map((after) => ({ before: beforeById.get(after.id), after })),
      );
    },
    [setOpponents],
  );

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
      latest.current = latest.current.filter((opponent) => opponent.id !== id);
      setOpponents(latest.current);
      storeRef.current.remove([id]);
    },
    [opponents, groupsIn, applyChanges, setOpponents],
  );

  /** Removes exactly the given opponent ids — the caller decides scope (e.g. "every opponent under the currently-viewed regulation"), not this hook. */
  const removeOpponents = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      latest.current = latest.current.filter((opponent) => !idSet.has(opponent.id));
      setOpponents(latest.current);
      storeRef.current.remove(ids);
    },
    [setOpponents],
  );

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
  const updateOpponent = useCallback(
    (id: string, updater: (opponent: Opponent) => Opponent) => {
      const before = latest.current.find((opponent) => opponent.id === id);
      if (!before) return;
      applyChanges([{ ...updater(before), updatedAt: new Date().toISOString() }]);
    },
    [applyChanges],
  );

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
    /** Adds (or replaces) opponents as they are — e.g. a copy from another list. */
    addOpponents: applyChanges,
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
