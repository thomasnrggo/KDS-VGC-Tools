import abilitiesData from "@/data/abilities.json";
import { calculateFinalStats, resolveBaseStats } from "./calculateFinalStats";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import {
  WEATHER_SPEED_DOUBLING_ABILITIES,
  MEGA_FORM_ABILITY_BY_FORM_KEY,
  SPECIES_ALIASES,
} from "@/constants";
import type { SpeciesAbility } from "@/types";

const ABILITIES_DATA = abilitiesData as unknown as Record<string, SpeciesAbility[]>;

/**
 * Any Speed-boosting/lowering nature works identically for this table —
 * Jolly/Timid/Hasty/Naive all give the same ×1.1 Speed multiplier (they only
 * differ in which stat they lower, irrelevant here since we only read .spe),
 * and the same logic holds for the four Speed-lowering natures at ×0.9.
 * Jolly/Brave are just the arbitrary representatives; Hardy is the arbitrary
 * neutral representative (all 5 neutral natures are equivalent — see
 * NATURE_MODIFIERS).
 */
const POSITIVE_SPEED_NATURE = "Jolly";
const NEUTRAL_NATURE = "Hardy";
const NEGATIVE_SPEED_NATURE = "Brave";
const CHOICE_SCARF = "Choice Scarf";
const MAX_STAT_POINTS = 32;

const UNBURDEN_ABILITY = "Unburden";

export interface SpecialSpeedCondition {
  /** Short label, e.g. "Rain", "Unburden". */
  label: string;
  /** Full phrase to show next to the value, e.g. "in Rain", "once Unburden activates". */
  descriptor: string;
}

/**
 * Ability name -> the condition that doubles its holder's Speed, covering
 * both the existing weather-doubling abilities (Swift Swim/Chlorophyll/Sand
 * Rush/Slush Rush — see speedModifiers.ts, previously only wired into the
 * Damage Calculator's single-Pokémon battle state) and Unburden (losing/
 * consuming a held item), which nothing in this app modeled before. Built
 * once at module scope, not per-row.
 */
const SPECIAL_CONDITIONS_BY_ABILITY: Record<string, SpecialSpeedCondition> = (() => {
  const map: Record<string, SpecialSpeedCondition> = {};
  for (const [weather, ability] of Object.entries(WEATHER_SPEED_DOUBLING_ABILITIES)) {
    if (!ability) continue;
    map[ability] = { label: weather, descriptor: `in ${weather}` };
  }
  map[UNBURDEN_ABILITY] = { label: "Unburden", descriptor: "once Unburden activates" };
  return map;
})();

export interface SpeedTierRow {
  /** Unique per row — a plain species key, or `${speciesKey}-${item}` for a Mega row. */
  id: string;
  /** src/data/species.json key of the base (non-Mega) species — same for every Mega row of one species. */
  speciesKey: string;
  /** Base species' Showdown display name — what PokemonSprite needs (with `item`) to resolve a Mega row's sprite. */
  speciesName: string;
  /** Held Mega Stone display name, only set on Mega rows. */
  item?: string;
  /** What the Pokémon column shows — the plain species name, or "Mega {Name}[ X/Y]" for a Mega row. */
  name: string;
  isMega: boolean;
  baseSpe: number;
  maxSpeed: number;
  neutral32: number;
  neutral0: number;
  /** The true floor: 0 Stat Points + a Speed-lowering nature (×0.9). */
  minSpeed: number;
  /** null on Mega rows — a held Mega Stone and Choice Scarf can't occupy the same item slot. */
  maxScarf: number | null;
  neutral32Scarf: number | null;
  /**
   * Set when this species/form has legal access to a Speed-doubling ability
   * (a weather ability it matches, or Unburden) — `value` is Max Speed
   * doubled (32 Stat Points + a Speed-boosting nature, no item, since the
   * doubling ability itself is doing the work a Choice Scarf normally
   * would). null when no such ability is available to this row.
   */
  special: (SpecialSpeedCondition & { value: number }) | null;
}

function speedFor(species: string, nature: string, statPoints: number, item?: string): number {
  const evs = statPoints > 0 ? `${statPoints} Spe` : undefined;
  return calculateFinalStats({ species, nature, evs, item })?.spe ?? 0;
}

/** "Charizardite X" -> "Mega Charizard X"; "Gengarite" -> "Mega Gengar" — matches how these forms are actually named in-game. */
function megaDisplayName(speciesName: string, stoneName: string): string {
  const suffixMatch = stoneName.match(/ (X|Y)$/);
  return suffixMatch ? `Mega ${speciesName} ${suffixMatch[1]}` : `Mega ${speciesName}`;
}

/**
 * Every ability this row could legally have. A Mega row uses its fixed
 * Mega-form ability when one is curated (Mega Evolution replaces the base
 * ability entirely — e.g. Mega Swampert's Swift Swim has nothing to do with
 * base Swampert's Torrent/Damp, same reasoning as resolveEffectiveAbility.ts)
 * and otherwise falls back to the base form's full legal-ability list, same
 * as a plain (non-Mega) row — there's no per-row "chosen ability" here, this
 * is a species-wide reference table, not one build.
 */
function candidateAbilities(
  speciesKey: string,
  speciesName: string,
  item: string | undefined,
): string[] {
  if (item) {
    for (const key of candidateFormKeys(speciesName, item)) {
      const override =
        MEGA_FORM_ABILITY_BY_FORM_KEY[key] ?? MEGA_FORM_ABILITY_BY_FORM_KEY[SPECIES_ALIASES[key]];
      if (override) return [override];
    }
  }
  return (ABILITIES_DATA[speciesKey] ?? []).map((ability) => ability.name);
}

function findSpecialCondition(
  speciesKey: string,
  speciesName: string,
  item: string | undefined,
): SpecialSpeedCondition | undefined {
  for (const ability of candidateAbilities(speciesKey, speciesName, item)) {
    const condition = SPECIAL_CONDITIONS_BY_ABILITY[ability];
    if (condition) return condition;
  }
  return undefined;
}

function buildRow(speciesKey: string, speciesName: string, item: string | undefined): SpeedTierRow {
  const isMega = item !== undefined;
  const maxSpeed = speedFor(speciesName, POSITIVE_SPEED_NATURE, MAX_STAT_POINTS, item);
  const specialCondition = findSpecialCondition(speciesKey, speciesName, item);

  return {
    id: item ? `${speciesKey}-${item.toLowerCase().replace(/\s+/g, "-")}` : speciesKey,
    speciesKey,
    speciesName,
    item,
    name: isMega ? megaDisplayName(speciesName, item) : speciesName,
    isMega,
    baseSpe: resolveBaseStats(speciesName, item)?.spe ?? 0,
    maxSpeed,
    neutral32: speedFor(speciesName, NEUTRAL_NATURE, MAX_STAT_POINTS, item),
    neutral0: speedFor(speciesName, NEUTRAL_NATURE, 0, item),
    minSpeed: speedFor(speciesName, NEGATIVE_SPEED_NATURE, 0, item),
    maxScarf: isMega
      ? null
      : speedFor(speciesName, POSITIVE_SPEED_NATURE, MAX_STAT_POINTS, CHOICE_SCARF),
    neutral32Scarf: isMega
      ? null
      : speedFor(speciesName, NEUTRAL_NATURE, MAX_STAT_POINTS, CHOICE_SCARF),
    special: specialCondition ? { ...specialCondition, value: maxSpeed * 2 } : null,
  };
}

/**
 * Builds one Speed Tiers row per species key (pikalytics-style reference
 * table, scoped to a regulation's legal species — see REGULATIONS), plus one
 * extra row per legal Mega Stone a species can hold. Mega rows leave both
 * Scarf columns null — a held Mega Stone and Choice Scarf can't occupy the
 * same item slot, so "Max Scarf" is meaningless for a Mega'd Pokémon.
 */
export function computeSpeedTierRows(
  speciesKeys: string[],
  megaStoneItemsForSpecies: (speciesKey: string) => string[],
): SpeedTierRow[] {
  const rows: SpeedTierRow[] = [];
  for (const speciesKey of speciesKeys) {
    const speciesName = formatSpeciesDisplayName(speciesKey);
    rows.push(buildRow(speciesKey, speciesName, undefined));
    for (const stoneName of megaStoneItemsForSpecies(speciesKey)) {
      rows.push(buildRow(speciesKey, speciesName, stoneName));
    }
  }
  return rows;
}
