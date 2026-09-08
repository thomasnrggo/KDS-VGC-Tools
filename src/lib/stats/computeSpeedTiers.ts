import { calculateFinalStats, resolveBaseStats } from "./calculateFinalStats";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";

/**
 * Any Speed-boosting nature works identically for this table — Jolly/Timid/
 * Hasty/Naive all give the same ×1.1 Speed multiplier, they only differ in
 * which stat they lower (irrelevant here, we only read .spe). Jolly is just
 * the arbitrary representative; Hardy is the arbitrary neutral representative
 * (all 5 neutral natures are equivalent — see NATURE_MODIFIERS).
 */
const POSITIVE_SPEED_NATURE = "Jolly";
const NEUTRAL_NATURE = "Hardy";
const CHOICE_SCARF = "Choice Scarf";
const MAX_STAT_POINTS = 32;

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
  /** null on Mega rows — a held Mega Stone and Choice Scarf can't occupy the same item slot. */
  maxScarf: number | null;
  neutral32Scarf: number | null;
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

function buildRow(
  speciesKey: string,
  speciesName: string,
  item: string | undefined,
): SpeedTierRow {
  const isMega = item !== undefined;
  return {
    id: item ? `${speciesKey}-${item.toLowerCase().replace(/\s+/g, "-")}` : speciesKey,
    speciesKey,
    speciesName,
    item,
    name: isMega ? megaDisplayName(speciesName, item) : speciesName,
    isMega,
    baseSpe: resolveBaseStats(speciesName, item)?.spe ?? 0,
    maxSpeed: speedFor(speciesName, POSITIVE_SPEED_NATURE, MAX_STAT_POINTS, item),
    neutral32: speedFor(speciesName, NEUTRAL_NATURE, MAX_STAT_POINTS, item),
    neutral0: speedFor(speciesName, NEUTRAL_NATURE, 0, item),
    maxScarf: isMega ? null : speedFor(speciesName, POSITIVE_SPEED_NATURE, MAX_STAT_POINTS, CHOICE_SCARF),
    neutral32Scarf: isMega ? null : speedFor(speciesName, NEUTRAL_NATURE, MAX_STAT_POINTS, CHOICE_SCARF),
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
