/** One ability entry in src/data/abilities.json's per-species list. */
export interface SpeciesAbility {
  name: string;
  /** True for a species' Hidden Ability slot (at most one) — see generate-species-data.mjs. */
  isHidden: boolean;
}

/** One entry in src/data/abilityDescriptions.json, keyed by normalizeSpeciesKey(name). */
export interface AbilityData {
  name: string;
  /** Showdown's exact ability description text (from @pkmn/dex), e.g. "This Pokemon restores 1/3 of its maximum HP, rounded down, when it switches out." for Regenerator. */
  shortDesc: string;
}
