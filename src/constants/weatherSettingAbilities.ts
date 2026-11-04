import type { DamageCalcOptions } from "@/types";

/** Abilities that set their own weather on switch-in — used to auto-set the damage calc's Field weather when a Pokémon with one of these is selected. */
export const WEATHER_SETTING_ABILITIES: Record<
  string,
  NonNullable<DamageCalcOptions["weather"]>
> = {
  Drought: "Sun",
  Drizzle: "Rain",
  "Sand Stream": "Sand",
  "Snow Warning": "Snow",
};

/** Abilities that set their own terrain on switch-in (Mega Raichu X's Electric Surge too, via resolveEffectiveAbility). */
export const TERRAIN_SETTING_ABILITIES: Record<
  string,
  NonNullable<DamageCalcOptions["terrain"]>
> = {
  "Electric Surge": "Electric",
  "Grassy Surge": "Grassy",
  "Psychic Surge": "Psychic",
  "Misty Surge": "Misty",
};
