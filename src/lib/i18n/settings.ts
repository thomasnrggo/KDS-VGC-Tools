import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_POKEMON_LANGUAGE,
  isAppLanguage,
  isPokemonLanguage,
  type AppLanguage,
  type PokemonLanguage,
} from "./languages";
import { MESSAGES, type Messages } from "./messages";

/**
 * The two language settings (see docs/localization.md) — a per-browser
 * preference in localStorage, held here so both React (useLanguage, through
 * useSyncExternalStore) and plain library code (getMessages, for error
 * messages built at the moment of a user action) read the same value.
 */
export interface LanguageSettings {
  appLanguage: AppLanguage;
  pokemonLanguage: PokemonLanguage;
}

const STORAGE_KEYS: Record<keyof LanguageSettings, string> = {
  appLanguage: "appLanguage",
  pokemonLanguage: "pokemonLanguage",
};

export const DEFAULT_LANGUAGE_SETTINGS: LanguageSettings = {
  appLanguage: DEFAULT_APP_LANGUAGE,
  pokemonLanguage: DEFAULT_POKEMON_LANGUAGE,
};

const listeners = new Set<() => void>();

/** Read once, then kept here — also keeps a choice working for this page load when localStorage is unavailable. */
let cached: LanguageSettings | null = null;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function subscribeLanguage(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function notifyLanguageListeners() {
  listeners.forEach((listener) => listener());
}

export function getLanguageSettings(): LanguageSettings {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE_SETTINGS;
  if (!cached) {
    const app = readStorage(STORAGE_KEYS.appLanguage);
    const pokemon = readStorage(STORAGE_KEYS.pokemonLanguage);
    cached = {
      appLanguage: isAppLanguage(app) ? app : DEFAULT_APP_LANGUAGE,
      pokemonLanguage: isPokemonLanguage(pokemon) ? pokemon : DEFAULT_POKEMON_LANGUAGE,
    };
  }
  return cached;
}

function update<K extends keyof LanguageSettings>(key: K, value: LanguageSettings[K]) {
  cached = { ...getLanguageSettings(), [key]: value };
  try {
    window.localStorage.setItem(STORAGE_KEYS[key], value);
  } catch {
    // Storage unavailable (private browsing etc.) — applies for this page
    // load via `cached`, it just isn't remembered.
  }
  if (key === "appLanguage") document.documentElement.lang = value;
  notifyLanguageListeners();
}

export function setAppLanguage(language: AppLanguage) {
  update("appLanguage", language);
}

export function setPokemonLanguage(language: PokemonLanguage) {
  update("pokemonLanguage", language);
}

/** The app's text in the current app language, outside React — for messages built during a user action (validation errors, toasts). Components use useMessages. */
export function getMessages(): Messages {
  return MESSAGES[getLanguageSettings().appLanguage];
}
