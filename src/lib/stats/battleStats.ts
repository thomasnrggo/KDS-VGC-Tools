import { ABILITY_DAMAGE_MODIFIERS, type AbilityDamageModifierSide } from "@/constants/abilityDamageModifiers";
import { ITEM_DAMAGE_MODIFIERS } from "@/constants/itemDamageModifiers";
import { ACTIVATED_SPEED_DOUBLING_ABILITIES, WEATHER_SPEED_DOUBLING_ABILITIES } from "@/constants";
import { FIXED_POINT, applyStatStage, chainMods, pokeRound } from "@/lib/damage/calculateDamage";
import type { DamageCalcOptions, FinalStats, StatKey } from "@/types";

type BattleStatKey = Exclude<StatKey, "hp">;

/** Why a battle stat differs from the stat screen — translated by the caller. */
export type BattleStatSource =
  | { kind: "stage"; stage: number }
  | { kind: "item"; name: string }
  | { kind: "ability"; name: string }
  | { kind: "weather"; weather: NonNullable<DamageCalcOptions["weather"]> }
  | { kind: "tailwind" }
  | { kind: "paralysis" };

export interface BattleStat {
  value: number;
  sources: BattleStatSource[];
}

export interface BattleStatContext {
  stats: FinalStats;
  stages: Partial<Record<BattleStatKey, number>>;
  item?: string;
  /** The ability in effect (Mega-aware). */
  ability?: string;
  types: string[];
  statused: boolean;
  paralyzed: boolean;
  weather?: DamageCalcOptions["weather"];
  terrain?: DamageCalcOptions["terrain"];
  tailwind?: boolean;
  /** The ability's activation toggle is on (Unburden after losing its item). */
  abilityActive?: boolean;
}

/** Which modifier-table entries boost a stat outright: an attack-stat ("at") or defense-stat ("df") modifier tied to one category, with no move-dependent condition. */
const STAT_FOR_MODIFIER: Record<"at" | "df", Record<"Physical" | "Special", BattleStatKey>> = {
  at: { Physical: "atk", Special: "spa" },
  df: { Physical: "def", Special: "spd" },
};

function statModifiers(
  entry: AbilityDamageModifierSide | AbilityDamageModifierSide[] | undefined,
  stage: "at" | "df",
  stat: BattleStatKey,
  ctx: BattleStatContext,
): number[] {
  if (!entry) return [];
  const sides = Array.isArray(entry) ? entry : [entry];
  return sides
    .filter(
      (side) =>
        side.stage === stage &&
        side.categories?.length === 1 &&
        STAT_FOR_MODIFIER[stage][side.categories[0]] === stat &&
        !side.types &&
        !side.flag &&
        !side.onlySuperEffective &&
        side.maxBasePower === undefined &&
        !side.onlyCritical &&
        !side.defenderAtFullHp &&
        (!side.weathers || (!!ctx.weather && side.weathers.includes(ctx.weather))) &&
        (!side.terrain || side.terrain === ctx.terrain),
    )
    .map((side) => side.multiplier4096);
}

/**
 * A stat as it stands in battle: the stat-screen value with its stage, item,
 * ability, weather, Tailwind and paralysis applied — what the damage
 * calculator's "Battle" column shows. Uses the same modifier tables and
 * rounding as the engine. Damage-only effects that depend on the move
 * (Thick Fat, Steelworker, …) aren't stat changes and aren't included.
 */
export function computeBattleStat(stat: BattleStatKey, ctx: BattleStatContext): BattleStat {
  const sources: BattleStatSource[] = [];
  const stage = ctx.stages[stat] ?? 0;
  if (stage !== 0) sources.push({ kind: "stage", stage });

  if (stat === "spe") {
    const mods: number[] = [];
    if (ctx.item === "Choice Scarf") {
      mods.push(0x1800);
      sources.push({ kind: "item", name: ctx.item });
    } else if (ctx.item === "Iron Ball") {
      mods.push(0x800);
      sources.push({ kind: "item", name: ctx.item });
    }
    const activatedDoubling =
      !!ctx.abilityActive && !!ctx.ability && ACTIVATED_SPEED_DOUBLING_ABILITIES.includes(ctx.ability);
    const weatherDoubling =
      !!ctx.ability && !!ctx.weather && WEATHER_SPEED_DOUBLING_ABILITIES[ctx.weather] === ctx.ability;
    if (ctx.ability && (activatedDoubling || weatherDoubling)) {
      mods.push(0x2000);
      sources.push({ kind: "ability", name: ctx.ability });
    }
    if (ctx.tailwind) {
      mods.push(0x2000);
      sources.push({ kind: "tailwind" });
    }
    const base = ctx.stats.speedBeforeItem ?? ctx.stats.spe;
    let value = pokeRound((applyStatStage(base, stage) * chainMods(mods)) / FIXED_POINT);
    if (ctx.paralyzed) {
      value = Math.floor(value / 2);
      sources.push({ kind: "paralysis" });
    }
    return { value, sources };
  }

  const modifierStage = stat === "atk" || stat === "spa" ? "at" : "df";
  const side = modifierStage === "at" ? "attacker" : "defender";
  const mods: number[] = [];
  const itemMods = ctx.item ? statModifiers(ITEM_DAMAGE_MODIFIERS[ctx.item]?.[side], modifierStage, stat, ctx) : [];
  if (itemMods.length > 0 && ctx.item) {
    mods.push(...itemMods);
    sources.push({ kind: "item", name: ctx.item });
  }
  const abilityMods = ctx.ability
    ? statModifiers(ABILITY_DAMAGE_MODIFIERS[ctx.ability]?.[side], modifierStage, stat, ctx)
    : [];
  // Guts: Attack ×1.5 while statused (the engine applies it the same way).
  if (ctx.ability === "Guts" && ctx.statused && stat === "atk") abilityMods.push(0x1800);
  if (abilityMods.length > 0 && ctx.ability) {
    mods.push(...abilityMods);
    sources.push({ kind: "ability", name: ctx.ability });
  }

  let value = applyStatStage(ctx.stats[stat], stage);
  // Sand raises Rock types' Sp. Def and Snow raises Ice types' Defense ×1.5.
  if (
    (ctx.weather === "Sand" && stat === "spd" && ctx.types.includes("Rock")) ||
    (ctx.weather === "Snow" && stat === "def" && ctx.types.includes("Ice"))
  ) {
    value = pokeRound((value * 3) / 2);
    sources.push({ kind: "weather", weather: ctx.weather });
  }
  value = pokeRound((value * chainMods(mods)) / FIXED_POINT);
  return { value, sources };
}
