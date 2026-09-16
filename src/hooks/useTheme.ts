"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/** Components re-render when applyTheme notifies these — see useTheme. */
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** The server has no access to the class the browser will set (that's the blocking script's job, see layout.tsx) — always "light" here so hydration has something deterministic to reconcile against. */
function getServerSnapshot(): Theme {
  return "light";
}

/**
 * Reads the <html> element's "dark" class — the actual source of truth for
 * which theme is active, already set before hydration by the blocking
 * inline script in layout.tsx (reading localStorage, falling back to
 * prefers-color-scheme) — via useSyncExternalStore, React's mechanism for
 * state that lives outside React without a manual effect-driven sync (which
 * risks a hydration mismatch / cascading-render lint error): React
 * reconciles getServerSnapshot's guess to the real getSnapshot value right
 * after hydration on its own.
 *
 * setTheme/toggleTheme mutate the class directly and persist the explicit
 * choice to localStorage, then notify every subscribed useTheme() instance
 * (there's normally just the one ThemeToggle, but this keeps multiple in
 * sync if that ever changes) so they all re-render with the new value.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const applyTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — theme still applies for this
      // page load, it just won't be remembered next visit.
    }
    listeners.forEach((listener) => listener());
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [theme, applyTheme]);

  return { theme, setTheme: applyTheme, toggleTheme };
}
