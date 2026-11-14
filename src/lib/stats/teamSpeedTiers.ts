import { calculateFinalStats, resolveBaseStats } from "./calculateFinalStats";
import type { SpeedTierRow } from "./computeSpeedTiers";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import type { MetaPokemon } from "@/lib/meta/aggregateMeta";
import type { ParsedPokemon } from "@/types";

/**
 * Speed Tiers' "My team" view (docs/team-speed-tiers.md): a team as a turn
 * order by base Speed (a Mega as its Mega) — simpler for a beginner than
 * actual Speeds. Between and around your Pokémon, the others in each gap.
 */

/** The form a Pokémon is on the field as — its Mega when it holds its stone ("gardevoir-mega"). */
export function fieldFormKey(species: string, item?: string): string {
  return candidateFormKeys(species, item)[0];
}

export interface TeamSpeedMember {
  /** Its place in the team. */
  index: number;
  pokemon: ParsedPokemon;
  /** Its base Speed — where it sits. */
  baseSpe: number;
  /** Its actual Speed (Stat Points, nature, Choice Scarf / Iron Ball) — its badge. */
  speed: number | null;
}

export interface TeamSpeedOther {
  row: SpeedTierRow;
  /** Its base Speed — where it sits. */
  baseSpe: number;
  /** Share of the regulation's teams carrying this form (0 when unknown). */
  usage: number;
  pinned: boolean;
}

/** The metagame's entry for each row (by the form on the field: it lists Megas as their own). */
export function metaByRow(rows: SpeedTierRow[], meta: MetaPokemon[]): Map<string, MetaPokemon> {
  const byForm = new Map(meta.map((mon) => [normalizeSpeciesKey(mon.species), mon]));
  const result = new Map<string, MetaPokemon>();
  for (const row of rows) {
    const mon = byForm.get(fieldFormKey(row.speciesName, row.item));
    if (mon && mon.usage > 0) result.set(row.id, mon);
  }
  return result;
}

/** A row of the table: a base Speed band (BAND wide), your Pokémon and the others in it. */
export interface TeamSpeedBand {
  /** Its fastest base Speed (e.g. 120) and slowest (111). */
  top: number;
  bottom: number;
  members: TeamSpeedMember[];
  /** Fastest first. */
  others: TeamSpeedOther[];
}

/**
 * Base Speed at or below which a Pokémon is a Trick Room one (Ursaluna 50,
 * Amoonguss 30, Torkoal and Mega Camerupt 20…): those always get the last row of their
 * own, so they never lose their spots to faster ones beside them.
 */
export const TRICK_ROOM_TOP = 50;

/** How wide a row is, in base Speed. */
export const BAND = 10;

/** The band a base Speed falls in: 120 → 120–111, 101 → 110–101, 100 → 100–91. */
export function bandOf(baseSpe: number): { top: number; bottom: number } {
  const top = Math.max(BAND, Math.ceil(baseSpe / BAND) * BAND);
  return { top, bottom: top - BAND + 1 };
}

/**
 * The table, fastest first: each base Speed band with your Pokémon in it
 * (everything faster or slower than your team's bands merged into one row each)
 * (at the Mega's base Speed when it holds its stone) and every other
 * legal Pokémon in it — which of those show is visibleOthers' call.
 */
export function teamSpeedBands({
  team,
  rows,
  meta,
  pinned,
}: {
  team: ParsedPokemon[];
  /** Every legal form (computeSpeedTierRows). */
  rows: SpeedTierRow[];
  /** metaByRow — empty when there's no metagame data. */
  meta: Map<string, MetaPokemon>;
  /** Row ids added by hand. */
  pinned: string[];
}): TeamSpeedBand[] {
  const members: TeamSpeedMember[] = team.flatMap((pokemon, index) => {
    const baseSpe = resolveBaseStats(pokemon.species, pokemon.item)?.spe;
    if (baseSpe === undefined) return [];
    return [{ index, pokemon, baseSpe, speed: calculateFinalStats(pokemon)?.spe ?? null }];
  });
  if (members.length === 0) return [];

  // The team's own forms aren't listed again.
  const teamForms = new Set(team.map((mon) => fieldFormKey(mon.species, mon.item)));
  const pinnedIds = new Set(pinned);
  const others: TeamSpeedOther[] = rows
    .filter((row) => !teamForms.has(fieldFormKey(row.speciesName, row.item)))
    .map((row) => ({
      row,
      baseSpe: row.baseSpe,
      usage: meta.get(row.id)?.usage ?? 0,
      pinned: pinnedIds.has(row.id),
    }))
    .sort(
      (a, b) => b.baseSpe - a.baseSpe || b.usage - a.usage || a.row.name.localeCompare(b.row.name),
    );

  const bands = new Map<number, TeamSpeedBand>();
  const bandFor = (baseSpe: number) => {
    const { top, bottom } = bandOf(baseSpe);
    let band = bands.get(top);
    if (!band) {
      band = { top, bottom, members: [], others: [] };
      bands.set(top, band);
    }
    return band;
  };
  for (const member of [...members].sort((a, b) => b.baseSpe - a.baseSpe)) {
    bandFor(member.baseSpe).members.push(member);
  }
  for (const other of others) bandFor(other.baseSpe).others.push(other);
  const sorted = [...bands.values()].sort((a, b) => b.top - a.top);

  // Bands of 10 only where your Pokémon are: everything faster than your
  // fastest one's band is a single row, labeled up to the fastest base Speed
  // there is (151–121 above a 120 Sneasler), and everything slower than your
  // slowest one's band another, down to the slowest there is.
  const fastestTop = bandOf(Math.max(...members.map((member) => member.baseSpe))).top;
  const slowestBottom = bandOf(Math.min(...members.map((member) => member.baseSpe))).bottom;
  const merge = (
    far: TeamSpeedBand[],
    top: (others: TeamSpeedOther[]) => number,
    bottom: (others: TeamSpeedOther[]) => number,
  ): TeamSpeedBand[] => {
    const farOthers = far.flatMap((band) => band.others);
    return farOthers.length === 0
      ? []
      : [{ top: top(farOthers), bottom: bottom(farOthers), members: [], others: farOthers }];
  };
  // Slower than your team, split at TRICK_ROOM_TOP (bands of one base Speed
  // each here, so the split falls exactly at 50).
  const slower = [...new Set(others.map((other) => other.baseSpe))]
    .filter((baseSpe) => baseSpe < slowestBottom)
    .map((baseSpe) => ({
      top: baseSpe,
      bottom: baseSpe,
      members: [],
      others: others.filter((other) => other.baseSpe === baseSpe),
    }));
  return [
    ...merge(
      sorted.filter((band) => band.top > fastestTop),
      (far) => Math.max(...far.map((other) => other.baseSpe)),
      () => fastestTop + 1,
    ),
    ...sorted.filter((band) => band.top <= fastestTop && band.bottom >= slowestBottom),
    ...merge(
      slower.filter((band) => band.top > TRICK_ROOM_TOP),
      () => slowestBottom - 1,
      (far) => Math.min(...far.map((other) => other.baseSpe)),
    ),
    // Always last: the Trick Room Pokémon (50 and slower), with their own spots.
    ...merge(
      slower.filter((band) => band.top <= TRICK_ROOM_TOP),
      (far) => Math.max(...far.map((other) => other.baseSpe)),
      (far) => Math.min(...far.map((other) => other.baseSpe)),
    ),
  ];
}

/** How many of a row's others show before "+N": the most used (and anything pinned). */
export const SHOWN_PER_ROW = 12;

/**
 * The others a row shows until it's expanded: anything pinned, then the most
 * used — only Pokémon seen in tournaments (or, with no data at all, the
 * fastest) — still fastest first.
 */
export function visibleOthers(others: TeamSpeedOther[], hasMeta: boolean): TeamSpeedOther[] {
  const candidates = hasMeta ? others.filter((other) => other.pinned || other.usage > 0) : others;
  const pinnedCount = candidates.filter((other) => other.pinned).length;
  const keep = new Set(
    [...candidates]
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.usage - a.usage)
      .slice(0, Math.max(SHOWN_PER_ROW, pinnedCount))
      .map((other) => other.row.id),
  );
  return others.filter((other) => keep.has(other.row.id));
}
