import { stripMegaSuffix } from "@/lib/species/megaForm";
import type { MetaPokemon } from "@/lib/meta/aggregateMeta";
import type { ParsedPokemon } from "@/types";
import { withMetaSpread, type MetaSpreads } from "@/lib/meta/metaSpreads";

/** One way a metagame Pokémon is built — its sets with one item (Scarf Garchomp, Life Orb Garchomp). */
export interface MetaThreatSet {
  /** Unique per set, e.g. "Garchomp|Choice Scarf". */
  id: string;
  /** The metagame entry's name — a Mega its own ("Garchomp-Mega-Z"). */
  species: string;
  /** The set to calc with: base species, item, the common moves and ability, and the admin's spread and nature (else its common nature and an estimated spread). */
  pokemon: ParsedPokemon;
  /** Whether the spread is the admin's (see src/lib/meta/metaSpreads.ts) rather than estimated. */
  spreadFromAdmin: boolean;
  /** Share of this Pokémon's teams running the item. */
  share: number;
  /** Share of all teams carrying this set (the Pokémon's usage × share). */
  usage: number;
  /** The Pokémon's win rate (not the set's — the data doesn't split it). */
  winRate: number | null;
}

export interface MetaSetOptions {
  /** How many of the most-used Pokémon to take. */
  limit?: number;
  /** Skip an item on fewer of a Pokémon's teams than this. */
  minShare?: number;
  /** At most this many items (sets) per Pokémon. */
  perPokemon?: number;
  /** The admin's common spreads, which replace the estimated ones. */
  spreads?: MetaSpreads;
}

/** How many of the most-used Pokémon the analysis takes. */
export const META_THREAT_LIMIT = 40;
/** The analysis's minimum share of a Pokémon's teams for an item to be its own set. */
export const MIN_SET_SHARE = 0.15;
/** The analysis's most sets (items) per Pokémon. */
export const SETS_PER_POKEMON = 3;

/** A metagame Pokémon's set with an item, before its spread: the most common full set with the item, else its most common moves, ability and nature. */
export function metaBaseSet(entry: MetaPokemon, item: string | undefined): ParsedPokemon {
  const set = entry.sets.find((candidate) => candidate.item === item);
  return {
    species: stripMegaSuffix(entry.species),
    item,
    ability: set?.ability ?? entry.abilities[0]?.name,
    nature: set?.nature ?? entry.natures[0]?.name,
    moves: set?.moves ?? entry.moves.slice(0, 4).map((move) => move.name),
  };
}

/** The items that make up a metagame Pokémon's sets in the analysis. */
export function metaSetItems(
  entry: MetaPokemon,
  { minShare = MIN_SET_SHARE, perPokemon = SETS_PER_POKEMON } = {},
) {
  return entry.items.filter((item) => item.share >= minShare).slice(0, perPokemon);
}

/**
 * The metagame's common sets, one per common item of each of the most-used
 * Pokémon — an item changes what a set threatens (a Choice Scarf outspeeds,
 * a Life Orb hits harder, a Sitrus Berry stays around). Its moves, ability
 * and nature are those of the most common full set with that item, else the
 * Pokémon's most common ones; the spread is the admin's for it (with its
 * nature), else estimated (team sheets have none).
 */
export function metaThreatSets(
  pokemon: MetaPokemon[],
  {
    limit = META_THREAT_LIMIT,
    minShare = MIN_SET_SHARE,
    perPokemon = SETS_PER_POKEMON,
    spreads,
  }: MetaSetOptions = {},
): MetaThreatSet[] {
  return pokemon.slice(0, limit).flatMap((entry) =>
    metaSetItems(entry, { minShare, perPokemon }).map((item): MetaThreatSet => {
      const { pokemon, fromAdmin } = withMetaSpread(
        metaBaseSet(entry, item.name),
        entry.species,
        spreads,
      );
      return {
        id: `${entry.species}|${item.name}`,
        species: entry.species,
        pokemon,
        spreadFromAdmin: fromAdmin,
        share: item.share,
        usage: entry.usage * item.share,
        winRate: entry.winRate,
      };
    }),
  );
}
