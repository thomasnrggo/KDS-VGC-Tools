import type { DamageCalcOptions } from "@/types";

type Weather = NonNullable<DamageCalcOptions["weather"]>;

/**
 * Abilities that double Speed in their matching weather — a small,
 * hand-curated starting set (grows over time, same spirit as
 * abilityDamageModifiers.ts). Unburden is in ACTIVATED_SPEED_DOUBLING_ABILITIES
 * below; Quick Feet isn't modeled.
 */
export const WEATHER_SPEED_DOUBLING_ABILITIES: Partial<Record<Weather, string>> = {
  Rain: "Swift Swim",
  Sun: "Chlorophyll",
  Sand: "Sand Rush",
  Snow: "Slush Rush",
};

/**
 * Abilities that double Speed once something happens the calculator can't
 * see — Unburden after its user loses its item — so the damage calculator's
 * Pokémon panel shows an "active" toggle for them.
 */
export const ACTIVATED_SPEED_DOUBLING_ABILITIES: readonly string[] = ["Unburden"];
