import { stripMegaSuffix } from "@/lib/species/megaForm";
import type { MetaPokemon } from "@/lib/meta/aggregateMeta";
import type { ParsedPokemon } from "@/types";
import { estimateSpread } from "./estimateSpread";

/** One way a metagame Pokémon is built — its sets with one item (Scarf Garchomp, Life Orb Garchomp). */
export interface MetaThreatSet {
  /** Unique per set, e.g. "Garchomp|Choice Scarf". */
  id: string;
  /** The metagame entry's name — a Mega its own ("Garchomp-Mega-Z"). */
  species: string;
  /** The set to calc with: base species, item, the common moves, ability and nature, an estimated spread. */
  pokemon: ParsedPokemon;
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
}

/**
 * The metagame's common sets, one per common item of each of the most-used
 * Pokémon — an item changes what a set threatens (a Choice Scarf outspeeds,
 * a Life Orb hits harder, a Sitrus Berry stays around). Its moves, ability
 * and nature are those of the most common full set with that item, else the
 * Pokémon's most common ones; the spread is estimated (team sheets have none).
 */
export function metaThreatSets(
  pokemon: MetaPokemon[],
  { limit = 40, minShare = 0.15, perPokemon = 3 }: MetaSetOptions = {},
): MetaThreatSet[] {
  return pokemon.slice(0, limit).flatMap((entry) =>
    entry.items
      .filter((item) => item.share >= minShare)
      .slice(0, perPokemon)
      .map((item): MetaThreatSet => {
        const set = entry.sets.find((candidate) => candidate.item === item.name);
        const parsed: ParsedPokemon = {
          species: stripMegaSuffix(entry.species),
          item: item.name,
          ability: set?.ability ?? entry.abilities[0]?.name,
          nature: set?.nature ?? entry.natures[0]?.name,
          moves: set?.moves ?? entry.moves.slice(0, 4).map((move) => move.name),
        };
        return {
          id: `${entry.species}|${item.name}`,
          species: entry.species,
          pokemon: { ...parsed, evs: estimateSpread(parsed) },
          share: item.share,
          usage: entry.usage * item.share,
          winRate: entry.winRate,
        };
      }),
  );
}
