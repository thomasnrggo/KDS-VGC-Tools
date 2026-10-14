"use client";

import { useSyncExternalStore } from "react";

/** "personal" for your own opponent list, or a prep group's id. */
export type PlannerSource = "personal" | (string & {});

const STORAGE_KEY = "plannerSource";
const listeners = new Set<() => void>();
let cached: PlannerSource | null = null;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): PlannerSource {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(STORAGE_KEY) || "personal";
    } catch {
      cached = "personal";
    }
  }
  return cached;
}

/** Which opponent list the Matchup Planner shows — remembered per browser, like the theme. */
export function setPlannerSource(source: PlannerSource) {
  cached = source;
  try {
    window.localStorage.setItem(STORAGE_KEY, source);
  } catch {
    // Storage unavailable — still applies for this page load.
  }
  listeners.forEach((listener) => listener());
}

export function usePlannerSource(): PlannerSource {
  return useSyncExternalStore(subscribe, getSnapshot, () => "personal");
}
