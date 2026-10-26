"use client";

import { useEffect, useState } from "react";
import {
  deleteOpponent,
  deleteOpponents,
  getOpponents,
  saveOpponent,
  syncOpponentsWithCloud,
} from "@/lib/storage/db";
import { useAuth } from "./useAuth";
import { sortByListOrder, useOpponentActions, type OpponentStore } from "./useOpponentActions";
import type { Opponent } from "@/types";

/** The personal list saves locally (IndexedDB), with cloud sync on top — see storage/db.ts. */
const PERSONAL_STORE: OpponentStore = {
  save: (changes) => changes.forEach(({ after }) => void saveOpponent(after)),
  remove: (ids) => void (ids.length === 1 ? deleteOpponent(ids[0]) : deleteOpponents(ids)),
};

/**
 * The last loaded opponents, kept across page navigations so a page's first
 * render shows them right away instead of an empty "loading" state — each
 * page mounts its own hook, and the header's team sprites used to blink on
 * every navigation. The hook still reloads in the background on mount.
 */
let cached: Opponent[] | null = null;

export function useOpponents() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [opponents, setOpponents] = useState<Opponent[]>(() => cached ?? []);
  const [isLoading, setIsLoading] = useState(() => cached === null);

  useEffect(() => {
    if (!isLoading) cached = opponents;
  }, [opponents, isLoading]);

  useEffect(() => {
    // Wait until we know whether someone is signed in: loading the local copy
    // first and the cloud sync after showed the list, then replaced it.
    if (isAuthLoading) return;
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
  }, [user, isAuthLoading]);

  const actions = useOpponentActions(opponents, setOpponents, PERSONAL_STORE);

  return {
    // Sorted on every render (not just on load) so a move — which only patches
    // sortOrder values, not array position — shows up immediately.
    opponents: sortByListOrder(opponents),
    isLoading,
    ...actions,
  };
}
