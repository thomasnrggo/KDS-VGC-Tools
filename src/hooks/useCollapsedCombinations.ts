"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "combinationsCollapsed";
const NONE: string[] = [];

const listeners = new Set<() => void>();

/** The current value once read or changed — also keeps collapsing working for this page load when localStorage is unavailable. */
let cached: string[] | null = null;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): string[] {
  if (cached === null) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      cached = Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string")
        : NONE;
    } catch {
      cached = NONE;
    }
  }
  return cached ?? NONE;
}

function getServerSnapshot(): string[] {
  return NONE;
}

function save(next: string[]) {
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — it applies for this page load via `cached`, it just isn't remembered.
  }
  listeners.forEach((listener) => listener());
}

/** Collapses or expands these combinations (by id) — one, or all of a team's at once. */
function setCollapsed(ids: string[], collapse: boolean) {
  const current = getSnapshot().filter((id) => !ids.includes(id));
  save(collapse ? [...current, ...ids] : current);
}

/**
 * Which of the Strategy tab's common combinations are collapsed (by id) —
 * notes hidden, picks in one row. A per-browser viewing preference, hence
 * localStorage, read through useSyncExternalStore for the same
 * hydration-safety reason as useOpponentListReversed.
 */
export function useCollapsedCombinations() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { collapsed, setCollapsed };
}
