import type { DamageCalcOptions } from "@/types";

type Weather = NonNullable<DamageCalcOptions["weather"]>;

/**
 * Abilities that double Speed in their matching weather — a small,
 * hand-curated starting set (grows over time, same spirit as
 * abilityDamageModifiers.ts). Not modeling other Speed-doubling effects
 * (Quick Feet while statused, Unburden after losing an item, Tailwind) since
 * those aren't battle conditions this calculator tracks.
 */
export const WEATHER_SPEED_DOUBLING_ABILITIES: Partial<Record<Weather, string>> = {
  Rain: "Swift Swim",
  Sun: "Chlorophyll",
  Sand: "Sand Rush",
  Snow: "Slush Rush",
};
