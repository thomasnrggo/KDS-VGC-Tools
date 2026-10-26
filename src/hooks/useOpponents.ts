"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteOpponent,
  deleteOpponents,
  getOpponents,
  saveOpponent,
  syncOpponentsWithCloud,
} from "@/lib/storage/db";
import { useAuth } from "./useAuth";
import { sameRecords } from "@/lib/sameRecords";
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

  // Set once the sync (or, signed out, the local read) has landed, so a slow
  // local read can't overwrite it.
  const syncedRef = useRef(false);

  useEffect(() => {
    // This device's copy first, shown right away: no waiting for sign-in or
    // the network. An empty one (a fresh device) keeps the spinner until the
    // cloud's copy arrives.
    let cancelled = false;
    getOpponents().then((local) => {
      if (cancelled || syncedRef.current || local.length === 0) return;
      setOpponents((current) => (sameRecords(current, local) ? current : local));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Then the cloud sync once sign-in is known. Its result only replaces
    // what's shown when it actually differs, so an unchanged list doesn't
    // re-render or flicker.
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
      if (cancelled) return;
      syncedRef.current = true;
      setOpponents((current) => (sameRecords(current, loaded) ? current : loaded));
      setIsLoading(false);
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
