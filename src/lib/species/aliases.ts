/**
 * Hand-maintained overrides for the (small number of) species names where
 * Pokémon Showdown's naming genuinely diverges from the PokeAPI-derived slugs
 * in src/data/species.json — rather than just differing in casing, which
 * normalizeSpeciesKey already handles.
 *
 * Add an entry here (verified against a real paste) whenever resolveSpeciesImage
 * falls back to the placeholder for a species that should have resolved.
 */
export const SPECIES_ALIASES: Record<string, string> = {
  "indeedee-f": "indeedee-female",
  "meowstic-f": "meowstic-female",
  "oinkologne-f": "oinkologne-female",
  "basculegion-f": "basculegion-female",
  "necrozma-dusk-mane": "necrozma-dusk",
  "necrozma-dawn-wings": "necrozma-dawn",
  "calyrex-ice-rider": "calyrex-ice",
  "calyrex-shadow-rider": "calyrex-shadow",
  "darmanitan-galar": "darmanitan-galar-standard",
  "florges-blue": "florges",
  "florges-orange": "florges",
  "florges-white": "florges",
  "florges-yellow": "florges",
};
