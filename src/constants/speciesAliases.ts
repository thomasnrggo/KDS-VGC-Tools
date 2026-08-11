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
  // Meowstic's Mega forms are gendered ("Female-Mega"/"Male-Mega" formSuffix,
  // not "Mega-Female"/"Mega-Male") — candidateFormKeys always appends the mega
  // suffix after the species key, so these two combined keys need their own
  // aliases; the ungendered bare "Meowstic" defaults to the male form, same as
  // its base (non-mega) sprite already does.
  "meowstic-mega": "meowstic-male-mega",
  "meowstic-f-mega": "meowstic-female-mega",
  "oinkologne-f": "oinkologne-female",
  "basculegion-f": "basculegion-female",
  "necrozma-dusk-mane": "necrozma-dusk",
  "necrozma-dawn-wings": "necrozma-dawn",
  "calyrex-ice-rider": "calyrex-ice",
  "calyrex-shadow-rider": "calyrex-shadow",
  "darmanitan-galar": "darmanitan-galar-standard",
  "maushold-four": "maushold",
  "florges-blue": "florges",
  "florges-orange": "florges",
  "florges-white": "florges",
  "florges-yellow": "florges",
  // Only Eternal Flower Floette can Mega Evolve, so species.json's single
  // "floette-mega" entry unambiguously is that Mega form — but Showdown
  // writes the base species as "Floette-Eternal", and candidateFormKeys
  // appends the mega suffix onto that full key, producing "floette-eternal-
  // mega" rather than "floette-mega".
  "floette-eternal-mega": "floette-mega",
};
