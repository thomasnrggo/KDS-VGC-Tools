import type { ParsedPokemon } from "@/types";
import type { PokemonText } from "@/lib/i18n/pokemonNames";

/** Lowercase with accents removed, so "panuelo" finds "Pañuelo Elección" and "Pokemon" finds "Pokémon". */
export function foldForSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Case- and accent-insensitive substring match against a Pokémon's species
 * or held item — powers the Opponents and My Teams search boxes. With the
 * Pokémon-language translator, the translated names match too (see
 * docs/localization.md), so "carchacrok" or "pañuelo" work alongside the
 * English names everyone shares.
 */
export function pokemonMatchesQuery(
  mon: ParsedPokemon,
  normalizedQuery: string,
  text?: PokemonText,
): boolean {
  const query = foldForSearch(normalizedQuery);
  const names = [mon.species, mon.item ?? ""];
  if (text && text.language !== "en") {
    names.push(text.species(mon.species), mon.item ? text.item(mon.item) : "");
  }
  return names.some((name) => name && foldForSearch(name).includes(query));
}

/** Splits a search box value into individual folded terms, e.g. "Charizard Scarf" -> ["charizard", "scarf"]. */
export function parseSearchTerms(query: string): string[] {
  return foldForSearch(query.trim()).split(/\s+/).filter(Boolean);
}

/**
 * True if `name` (or its translation, when given) contains ANY of `terms` as
 * a substring — "match any", not "match all" (contrast parseSearchTerms'
 * other typical use, where a team's whole roster must satisfy every term).
 * Powers Speed Tiers' search: since each row is a single Pokémon,
 * "charizard garchomp" should return every row for either one, not require
 * both names on the same row.
 */
export function matchesAnySearchTerm(name: string, terms: string[], translatedName?: string): boolean {
  const names = [foldForSearch(name), translatedName ? foldForSearch(translatedName) : ""];
  return terms.some((term) => names.some((candidate) => candidate && candidate.includes(term)));
}
