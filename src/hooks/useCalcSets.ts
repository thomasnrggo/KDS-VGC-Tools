"use client";

import { useEffect, useState } from "react";
import { deleteCalcSet, getCalcSets, saveCalcSet, syncCalcSetsWithCloud } from "@/lib/storage/db";
import { deletePublicSet, getPublicSets, savePublicSet } from "@/lib/firebase";
import { isAdminUid } from "@/lib/admin";
import { generateId } from "@/lib/id";
import { findSameNameSet } from "@/lib/calcSets";
import { useAuth } from "./useAuth";
import type { CalcSet, ParsedPokemon } from "@/types";

/** "custom" — the signed-in (or local) user's own sets; "public" — the admin's sets everyone sees. */
export type CalcSetKind = "custom" | "public";

/** Which saved set a calc entry was loaded from (or last saved as) — so "Save set" can offer to overwrite it. */
export interface SavedSetRef {
  kind: CalcSetKind;
  id: string;
}

/** Thrown by renameSet when that species already has a set with the new name. */
export class SetNameTakenError extends Error {}

function sortByName(sets: CalcSet[]): CalcSet[] {
  return [...sets].sort((a, b) => a.name.localeCompare(b.name));
}

// Kept across page navigations, same reasoning as useTournaments' cache.
let cachedCustom: CalcSet[] | null = null;
let cachedPublic: CalcSet[] | null = null;

/**
 * The Damage Calculator's saved sets: the user's own (local-first, synced
 * when signed in — see saveCalcSet) and the admin's public ones (a public
 * Firestore read, no sign-in needed). Public writes throw on failure so the
 * caller can report it; custom writes never fail visibly (local save first).
 */
export function useCalcSets() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canEditPublic = isAdminUid(user?.uid);
  const [customSets, setCustomSets] = useState<CalcSet[]>(() => cachedCustom ?? []);
  const [publicSets, setPublicSets] = useState<CalcSet[]>(() => cachedPublic ?? []);

  useEffect(() => {
    // Wait until we know whether someone is signed in: loading the local copy
    // first and the cloud sync after showed the list, then replaced it.
    if (isAuthLoading) return;
    let cancelled = false;
    const load = user
      ? () =>
          syncCalcSetsWithCloud(user.uid).catch((error) => {
            console.error("[cloud sync] pull calc sets failed:", error);
            return getCalcSets();
          })
      : getCalcSets;
    load().then((loaded) => {
      if (cancelled) return;
      cachedCustom = sortByName(loaded);
      setCustomSets(cachedCustom);
    });
    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  useEffect(() => {
    let cancelled = false;
    getPublicSets()
      .catch((error) => {
        console.error("[public sets] load failed:", error);
        return cachedPublic ?? [];
      })
      .then((loaded) => {
        if (cancelled) return;
        cachedPublic = sortByName(loaded);
        setPublicSets(cachedPublic);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setsOf(kind: CalcSetKind) {
    return kind === "custom" ? customSets : publicSets;
  }

  /** Functional update — writes are awaited first, so another may have landed in between. */
  function apply(kind: CalcSetKind, updater: (sets: CalcSet[]) => CalcSet[]) {
    const setSets = kind === "custom" ? setCustomSets : setPublicSets;
    setSets((prev) => {
      const next = sortByName(updater(prev));
      if (kind === "custom") cachedCustom = next;
      else cachedPublic = next;
      return next;
    });
  }

  async function write(kind: CalcSetKind, set: CalcSet) {
    if (kind === "custom") await saveCalcSet(set);
    else await savePublicSet(set);
    apply(kind, (sets) => [...sets.filter((existing) => existing.id !== set.id), set]);
  }

  /** Saves `pokemon` as a set named `name`, replacing a same-species set of that name if there is one. */
  async function saveSet(
    kind: CalcSetKind,
    pokemon: ParsedPokemon,
    name: string,
  ): Promise<CalcSet> {
    const existing = findSameNameSet(setsOf(kind), pokemon, name);
    const set: CalcSet = {
      id: existing?.id ?? generateId(),
      name: name.trim(),
      pokemon: { ...pokemon, moves: [...(pokemon.moves ?? [])] },
      updatedAt: new Date().toISOString(),
    };
    await write(kind, set);
    return set;
  }

  function findSet(ref: SavedSetRef | undefined): CalcSet | undefined {
    return ref ? setsOf(ref.kind).find((set) => set.id === ref.id) : undefined;
  }

  async function renameSet(kind: CalcSetKind, id: string, name: string): Promise<void> {
    const set = setsOf(kind).find((existing) => existing.id === id);
    if (!set || !name.trim()) return;
    const others = setsOf(kind).filter((existing) => existing.id !== id);
    if (findSameNameSet(others, set.pokemon, name)) throw new SetNameTakenError();
    await write(kind, { ...set, name: name.trim(), updatedAt: new Date().toISOString() });
  }

  async function deleteSet(kind: CalcSetKind, id: string): Promise<void> {
    if (kind === "custom") await deleteCalcSet(id);
    else await deletePublicSet(id);
    apply(kind, (sets) => sets.filter((set) => set.id !== id));
  }

  return { customSets, publicSets, canEditPublic, findSet, saveSet, renameSet, deleteSet };
}

export type CalcSetsApi = ReturnType<typeof useCalcSets>;
