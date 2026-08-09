import { normalizeSpeciesKey } from "./normalize";
import { MEGA_STONE_SUFFIX_BY_ITEM } from "@/constants";

/**
 * Given a Showdown species (+ optional held item, for Mega Stones), returns the
 * candidate normalized form key(s) to look up in species.json / baseStats.json,
 * most specific first (e.g. the Mega form implied by a held Mega Stone before the
 * base form). Callers should try each in order — falling back through
 * SPECIES_ALIASES too, since not everything from Showdown maps 1:1 onto the
 * PokeAPI-derived slugs — and use the first that resolves in their dataset.
 * Shared by resolveSpeciesImage and calculateFinalStats so a Pokémon's sprite and
 * its computed stats always agree on which form is being shown.
 */
export function candidateFormKeys(species: string, item?: string): string[] {
  const key = normalizeSpeciesKey(species);
  const keys: string[] = [];

  if (item) {
    const megaSuffix = MEGA_STONE_SUFFIX_BY_ITEM[normalizeSpeciesKey(item)];
    if (megaSuffix) {
      keys.push(`${key}-${normalizeSpeciesKey(megaSuffix)}`);
    }
  }

  keys.push(key);
  return keys;
}
