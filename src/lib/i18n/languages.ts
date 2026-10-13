/**
 * The two language settings (see docs/localization.md): the app's own text,
 * and the official game terms — Pokémon, moves, items, abilities, types,
 * natures. They're independent, e.g. an English UI with Spanish game terms.
 */
export const APP_LANGUAGES = ["en", "es"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const POKEMON_LANGUAGES = ["en", "es", "es-419"] as const;
export type PokemonLanguage = (typeof POKEMON_LANGUAGES)[number];

export const DEFAULT_APP_LANGUAGE: AppLanguage = "en";
export const DEFAULT_POKEMON_LANGUAGE: PokemonLanguage = "en";

/** Each language's name in itself — the picker lists them this way so they're findable whatever the current language. */
export const APP_LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: "English",
  es: "Español",
};

export const POKEMON_LANGUAGE_NAMES: Record<PokemonLanguage, string> = {
  en: "English",
  es: "Español (España)",
  "es-419": "Español (Latinoamérica)",
};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return APP_LANGUAGES.includes(value as AppLanguage);
}

export function isPokemonLanguage(value: unknown): value is PokemonLanguage {
  return POKEMON_LANGUAGES.includes(value as PokemonLanguage);
}
