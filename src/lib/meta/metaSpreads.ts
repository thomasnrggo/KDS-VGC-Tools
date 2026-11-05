import { estimateSpread } from "@/lib/threats/estimateSpread";
import type { ParsedPokemon } from "@/types";

/**
 * The admin's common spread for a metagame set — open team sheets list the
 * nature but never Stat Points, so without one the analysis estimates them
 * (see estimateSpread). Set at /admin/meta-sets, saved per regulation in
 * `appConfig/metaSpreads_{regulationId}` (see src/lib/firebase/metaSpreads.ts).
 */
export interface MetaSpread {
  nature: string;
  /** A paste's "EVs:" line in Stat Points, e.g. "32 Atk / 32 Spe / 2 HP". */
  evs: string;
  /** ISO timestamp of the last save. */
  updatedAt: string;
  /** The admin's public Damage Calculator set it's shared as (see src/lib/firebase/publicSets.ts), kept in step on each save. */
  publicSetId?: string;
}

/** Keyed by metaSpreadKey: a whole Pokémon ("Garchomp") or one of its item sets ("Garchomp|Choice Scarf"). */
export type MetaSpreads = Record<string, MetaSpread>;

/** The key for a metagame entry's species (a Mega its own, "Garchomp-Mega-Z") — and, for one item's set only, the item. */
export function metaSpreadKey(species: string, item?: string): string {
  return item ? `${species}|${item}` : species;
}

/** The spread a set uses: its item's own, else the Pokémon's, else none. */
export function findMetaSpread(
  spreads: MetaSpreads | undefined,
  species: string,
  item: string | undefined,
): MetaSpread | undefined {
  if (!spreads) return undefined;
  return (item ? spreads[metaSpreadKey(species, item)] : undefined) ?? spreads[species];
}

/**
 * A metagame set ready to calc: the admin's spread (and its nature) when one
 * is set for it, else an estimate from its own nature and item. `species` is
 * the metagame entry's name, which can differ from the set's (a Mega's set
 * is calced as its base species holding the stone).
 */
export function withMetaSpread(
  set: ParsedPokemon,
  species: string,
  spreads?: MetaSpreads,
): { pokemon: ParsedPokemon; fromAdmin: boolean } {
  const spread = findMetaSpread(spreads, species, set.item);
  if (spread)
    return { pokemon: { ...set, nature: spread.nature, evs: spread.evs }, fromAdmin: true };
  return { pokemon: { ...set, evs: estimateSpread(set) }, fromAdmin: false };
}
