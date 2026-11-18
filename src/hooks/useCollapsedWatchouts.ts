"use client";

import { useSyncExternalStore } from "react";
import type { WatchoutGroup } from "@/lib/teamWatchouts";

const STORAGE_KEY = "watchoutsCollapsed";
const GROUPS: WatchoutGroup[] = ["threats", "matchups", "typing", "sets"];
const NONE: WatchoutGroup[] = [];

const listeners = new Set<() => void>();

/** The current value once read or toggled — also keeps toggling working for this page load when localStorage is unavailable. */
let cached: WatchoutGroup[] | null = null;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): WatchoutGroup[] {
  if (cached === null) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      cached = Array.isArray(saved) ? saved.filter((group) => GROUPS.includes(group)) : NONE;
    } catch {
      cached = NONE;
    }
  }
  return cached ?? NONE;
}

function getServerSnapshot(): WatchoutGroup[] {
  return NONE;
}

function toggleCollapsed(group: WatchoutGroup) {
  const current = getSnapshot();
  cached = current.includes(group)
    ? current.filter((entry) => entry !== group)
    : [...current, group];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Storage unavailable — it applies for this page load via `cached`, it just isn't remembered.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Which of the Strategy tab's Auto-detected groups (Be careful with, Prep
 * for, Typing, Sets) are collapsed — a per-browser viewing preference,
 * hence localStorage, read through useSyncExternalStore for the same
 * hydration-safety reason as useOpponentListReversed.
 */
export function useCollapsedWatchouts() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { collapsed, toggleCollapsed };
}
