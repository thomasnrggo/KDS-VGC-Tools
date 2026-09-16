import type { ParsedPokemon } from "@/types";

/** Case-insensitive substring match against a Pokémon's species or held item — powers the Opponents search box. */
export function pokemonMatchesQuery(
  mon: ParsedPokemon,
  normalizedQuery: string,
): boolean {
  return (
    mon.species.toLowerCase().includes(normalizedQuery) ||
    Boolean(mon.item?.toLowerCase().includes(normalizedQuery))
  );
}

/** Splits a search box value into individual lowercase terms, e.g. "charizard scarf" -> ["charizard", "scarf"]. */
export function parseSearchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * True if `name` contains ANY of `terms` as a substring — "match any", not
 * "match all" (contrast parseSearchTerms' other typical use, where a team's
 * whole roster must satisfy every term). Powers Speed Tiers' search: since
 * each row is a single Pokémon, "charizard garchomp" should return every row
 * for either one, not require both names on the same row.
 */
export function matchesAnySearchTerm(name: string, terms: string[]): boolean {
  const normalized = name.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}
