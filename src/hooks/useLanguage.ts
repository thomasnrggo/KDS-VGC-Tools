"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { PokemonLanguage } from "@/lib/i18n/languages";
import {
  createPokemonText,
  ENGLISH_POKEMON_TEXT,
  loadPokemonNames,
  type PokemonText,
} from "@/lib/i18n/pokemonNames";
import { MESSAGES, type Messages } from "@/lib/i18n/messages";
import {
  DEFAULT_LANGUAGE_SETTINGS,
  getLanguageSettings,
  notifyLanguageListeners,
  setAppLanguage,
  setPokemonLanguage,
  subscribeLanguage,
} from "@/lib/i18n/settings";

/** Loaded Pokémon-name translators, by language (English needs none). */
const pokemonTexts = new Map<PokemonLanguage, PokemonText>([["en", ENGLISH_POKEMON_TEXT]]);
const pendingLoads = new Set<PokemonLanguage>();

/**
 * The two language settings (see docs/localization.md). The server can't see
 * the browser's choice, so it renders the defaults and React re-renders with
 * the real settings right after hydration (same approach as useTheme).
 */
export function useLanguageSettings() {
  const settings = useSyncExternalStore(
    subscribeLanguage,
    getLanguageSettings,
    () => DEFAULT_LANGUAGE_SETTINGS,
  );
  return { ...settings, setAppLanguage, setPokemonLanguage };
}

/** The app's text in the current app language. */
export function useMessages(): Messages {
  return MESSAGES[useLanguageSettings().appLanguage];
}

/**
 * Translates game terms into the Pokémon language. Names show in English
 * until that language's file (~100 KB) has loaded, then every user
 * re-renders.
 */
export function usePokemonText(): PokemonText {
  const { pokemonLanguage } = useLanguageSettings();
  const text = useSyncExternalStore(
    subscribeLanguage,
    () => pokemonTexts.get(pokemonLanguage) ?? ENGLISH_POKEMON_TEXT,
    () => ENGLISH_POKEMON_TEXT,
  );

  useEffect(() => {
    if (pokemonLanguage === "en") return;
    if (pokemonTexts.has(pokemonLanguage) || pendingLoads.has(pokemonLanguage)) return;
    pendingLoads.add(pokemonLanguage);
    loadPokemonNames(pokemonLanguage)
      .then((names) => {
        pokemonTexts.set(pokemonLanguage, createPokemonText(pokemonLanguage, names));
        notifyLanguageListeners();
      })
      .catch(() => {
        // Offline or the chunk failed — keep showing English names.
      })
      .finally(() => pendingLoads.delete(pokemonLanguage));
  }, [pokemonLanguage]);

  return text;
}
