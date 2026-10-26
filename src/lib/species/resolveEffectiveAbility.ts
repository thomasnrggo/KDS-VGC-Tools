import { candidateFormKeys } from "./candidateFormKeys";
import { MEGA_FORM_ABILITY_BY_FORM_KEY, SPECIES_ALIASES } from "@/constants";

/**
 * Resolves the ability a Pokémon actually has in battle, accounting for
 * Mega Evolution replacing it with a fixed one of its own (see
 * megaFormAbilities.ts) — a pasted export's `Ability:` line only ever
 * reflects the base form's ability, since Showdown's teambuilder has no
 * separate slot for "ability after Mega Evolving" (the game fixes that
 * itself). Falls back to `pastedAbility` when the held item isn't a
 * recognized Mega Stone, or when it is but that specific Mega form isn't
 * (yet) in the curated override table.
 */
export function resolveEffectiveAbility(
  species: string,
  item: string | undefined,
  pastedAbility: string | undefined,
): string | undefined {
  for (const key of candidateFormKeys(species, item)) {
    // The alias too, like resolveSpeciesImage: "Floette-Eternal" + Floettite
    // builds "floette-eternal-mega", which the table knows as "floette-mega".
    const override =
      MEGA_FORM_ABILITY_BY_FORM_KEY[key] ?? MEGA_FORM_ABILITY_BY_FORM_KEY[SPECIES_ALIASES[key]];
    if (override) return override;
  }
  return pastedAbility;
}
