"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "opponentListReversed";

const listeners = new Set<() => void>();

/** The current value once read or toggled — also keeps the toggle working for this page load when localStorage is unavailable. */
let cached: boolean | null = null;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): boolean {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      cached = false;
    }
  }
  return cached;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether the opponent list is shown in reverse of its manual order — a
 * view-only flip (no opponent's sortOrder changes), so toggling back is free.
 * A per-browser viewing preference rather than synced data, hence
 * localStorage; read through useSyncExternalStore for the same
 * hydration-safety reason as useTheme.
 */
export function useOpponentListReversed() {
  const isReversed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleReversed = useCallback(() => {
    cached = !getSnapshot();
    try {
      window.localStorage.setItem(STORAGE_KEY, String(cached));
    } catch {
      // Storage unavailable (private browsing etc.) — the flip still applies
      // for this page load via `cached`, it just isn't remembered.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { isReversed, toggleReversed };
}
