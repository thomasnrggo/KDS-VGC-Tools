import { normalizeSpeciesKey } from "@/lib/species/normalize";
import type { CalcSet, ParsedPokemon } from "@/types";

/** Two sets of the same species can't share a name (ignoring case and surrounding spaces) within one kind — saving under an existing name replaces that set, which is how a set gets edited. */
export function findSameNameSet(
  sets: CalcSet[],
  pokemon: ParsedPokemon,
  name: string,
): CalcSet | undefined {
  const speciesKey = normalizeSpeciesKey(pokemon.species);
  const folded = name.trim().toLowerCase();
  return sets.find(
    (set) =>
      normalizeSpeciesKey(set.pokemon.species) === speciesKey &&
      set.name.trim().toLowerCase() === folded,
  );
}
