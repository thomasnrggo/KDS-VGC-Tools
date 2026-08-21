import baseStatsData from "@/data/baseStats.json";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { SPECIES_ALIASES, NATURE_MODIFIERS } from "@/constants";
import type { BaseStats, FinalStats, ParsedPokemon, StatKey } from "@/types";

const BASE_STATS_DATA = baseStatsData as unknown as Record<string, BaseStats>;

/** VGC ("Pokémon Champions") play is always Level 50. */
const LEVEL = 50;

/** Pokémon Champions removed IVs entirely — every Pokémon is always 31 in every stat. */
const IV = 31;

/**
 * Pokémon Champions replaced EVs with Stat Points (0-32 per stat, 66 total) —
 * the paste's "EVs:" line still uses that label, but the numbers in it are SP,
 * not classic 0-252 EVs. 1 SP = 8 (classic-EV-equivalent) points, which is what
 * the stat formula below actually expects.
 */
const STAT_POINTS_TO_EV = 8;

const STAT_ABBREVIATIONS: Record<string, StatKey> = {
  hp: "hp",
  atk: "atk",
  def: "def",
  spa: "spa",
  spd: "spd",
  spe: "spe",
};

function lookupBaseStats(key: string): BaseStats | undefined {
  return BASE_STATS_DATA[key] ?? BASE_STATS_DATA[SPECIES_ALIASES[key]];
}

/** Same species+item resolution as resolveSpeciesImage, so stats and sprite always agree on the form. */
function resolveBaseStats(species: string, item?: string): BaseStats | undefined {
  for (const key of candidateFormKeys(species, item)) {
    const entry = lookupBaseStats(key);
    if (entry) return entry;
  }
  return undefined;
}

/**
 * Parses a raw "32 HP / 20 Def / 14 SpD" style Stat Points line (as captured
 * by parseTeam's `evs` field) into the raw 0-32 SP value per stat, defaulting
 * any stat not mentioned to 0 — matching Showdown's own convention of only
 * listing non-default values.
 */
function parseStatPoints(text: string | undefined): BaseStats {
  const spread: BaseStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (!text) return spread;

  for (const part of text.split("/")) {
    const match = part.trim().match(/^(\d+)\s+(\w+)$/);
    if (!match) continue;
    const statKey = STAT_ABBREVIATIONS[match[2].toLowerCase()];
    if (statKey) {
      spread[statKey] = Number(match[1]);
    }
  }
  return spread;
}

function statPointsToEvs(statPoints: BaseStats): BaseStats {
  return {
    hp: statPoints.hp * STAT_POINTS_TO_EV,
    atk: statPoints.atk * STAT_POINTS_TO_EV,
    def: statPoints.def * STAT_POINTS_TO_EV,
    spa: statPoints.spa * STAT_POINTS_TO_EV,
    spd: statPoints.spd * STAT_POINTS_TO_EV,
    spe: statPoints.spe * STAT_POINTS_TO_EV,
  };
}

/** Choice Scarf multiplies effective Speed by ×1.5, applied after nature — same slot as an in-battle item modifier, not part of the "stat screen" base. */
const CHOICE_SCARF_SPEED_MULTIPLIER = 1.5;

function hasChoiceScarf(item: string | undefined): boolean {
  return item !== undefined && normalizeSpeciesKey(item) === "choice-scarf";
}

function calculateHp(base: number, ev: number): number {
  return Math.floor(((2 * base + IV + Math.floor(ev / 4)) * LEVEL) / 100) + LEVEL + 10;
}

function calculateOtherStat(base: number, ev: number, natureMultiplier: number): number {
  const preNature = Math.floor(((2 * base + IV + Math.floor(ev / 4)) * LEVEL) / 100) + 5;
  return Math.floor(preNature * natureMultiplier);
}

/**
 * Computes a Pokémon's actual Level 50 stats from its base stats + parsed
 * Stat Points/nature (display-only fields on ParsedPokemon — see PLANNING.md
 * §2). IVs are always 31 — Pokémon Champions doesn't have them. Returns null
 * when the species/form isn't in the static base-stats table (mirrors
 * resolveSpeciesImage's null-on-unknown contract).
 */
export function calculateFinalStats(pokemon: ParsedPokemon): FinalStats | null {
  const baseStats = resolveBaseStats(pokemon.species, pokemon.item);
  if (!baseStats) return null;

  const evs = statPointsToEvs(parseStatPoints(pokemon.evs));
  const natureModifier = pokemon.nature ? NATURE_MODIFIERS[pokemon.nature.toLowerCase()] : undefined;

  function multiplierFor(stat: StatKey): number {
    if (stat === natureModifier?.increased) return 1.1;
    if (stat === natureModifier?.decreased) return 0.9;
    return 1;
  }

  const scarfed = hasChoiceScarf(pokemon.item);
  const speedBeforeScarf = calculateOtherStat(baseStats.spe, evs.spe, multiplierFor("spe"));

  return {
    hp: calculateHp(baseStats.hp, evs.hp),
    atk: calculateOtherStat(baseStats.atk, evs.atk, multiplierFor("atk")),
    def: calculateOtherStat(baseStats.def, evs.def, multiplierFor("def")),
    spa: calculateOtherStat(baseStats.spa, evs.spa, multiplierFor("spa")),
    spd: calculateOtherStat(baseStats.spd, evs.spd, multiplierFor("spd")),
    spe: scarfed ? Math.floor(speedBeforeScarf * CHOICE_SCARF_SPEED_MULTIPLIER) : speedBeforeScarf,
    increasedStat: natureModifier?.increased,
    decreasedStat: natureModifier?.decreased,
    speedBoostedByChoiceScarf: scarfed,
  };
}

export interface StatBreakdown {
  base: BaseStats;
  /** Raw 0-32 Stat Points per stat, as pasted — not the ×8 EV-equivalent calculateFinalStats uses internally. */
  statPoints: BaseStats;
  final: FinalStats;
}

/**
 * Base/Stat Points/Final breakdown for the per-Pokémon stat table (Base | SP
 * | Final columns) — reuses calculateFinalStats for the Final column rather
 * than duplicating the stat formula.
 */
export function calculateStatBreakdown(pokemon: ParsedPokemon): StatBreakdown | null {
  const base = resolveBaseStats(pokemon.species, pokemon.item);
  const final = calculateFinalStats(pokemon);
  if (!base || !final) return null;

  return { base, statPoints: parseStatPoints(pokemon.evs), final };
}
