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
