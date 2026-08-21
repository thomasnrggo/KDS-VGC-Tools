import type { DamageCalcOptions } from "@/types";

/** Abilities that set their own weather on switch-in — used to auto-set the damage calc's Field weather when a Pokémon with one of these is selected. */
export const WEATHER_SETTING_ABILITIES: Record<string, NonNullable<DamageCalcOptions["weather"]>> = {
  Drought: "Sun",
  Drizzle: "Rain",
  "Sand Stream": "Sand",
  "Snow Warning": "Snow",
};
