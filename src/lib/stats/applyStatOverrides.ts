import { calculateStatBreakdown } from "./calculateFinalStats";
import type { BaseStats, ParsedPokemon, StatKey } from "@/types";

export interface StatOverrides {
  nature?: string;
  sp?: Partial<Record<StatKey, number>>;
}

const EVS_LABEL: Record<StatKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};
const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const ZERO_SP: BaseStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/**
 * Applies user-edited Stat Points/nature on top of a Pokémon's pasted build,
 * for damage-calc theorycrafting — never mutates the saved team. Each stat's
 * SP is independently clamped to 0-32 by the UI before it ever reaches here,
 * but the total across all six is deliberately NOT capped at 66 — exploring
 * a build beyond what a legal team could have is exactly the point of an
 * editable calculator, so this only re-serializes whatever the caller passes.
 */
export function applyStatOverrides(
  pokemon: ParsedPokemon,
  overrides: StatOverrides | undefined,
): ParsedPokemon {
  if (!overrides || (overrides.nature === undefined && overrides.sp === undefined)) {
    return pokemon;
  }

  const baseline = calculateStatBreakdown(pokemon);
  const baseSp = baseline?.statPoints ?? ZERO_SP;
  const mergedSp = { ...baseSp, ...overrides.sp };
  const evs = STAT_ORDER.map((stat) => `${mergedSp[stat]} ${EVS_LABEL[stat]}`).join(" / ");

  return { ...pokemon, nature: overrides.nature ?? pokemon.nature, evs };
}
