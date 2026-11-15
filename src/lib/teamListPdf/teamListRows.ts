import { calculateFinalStats } from "@/lib/stats/calculateFinalStats";
import type { PokemonText } from "@/lib/i18n/pokemonNames";
import type { ParsedPokemon } from "@/types";
import type { TeamListPokemon } from "./fillTeamList";

/**
 * A team's Pokémon as the team list prints them: in the chosen Pokémon
 * language (falling back to English, which every font can draw), the nature
 * capitalized, and stats as the summary screen shows them — so Speed without
 * a Choice Scarf or Iron Ball, which only apply in battle.
 */
export function teamListRows(pokemon: ParsedPokemon[], text: PokemonText): TeamListPokemon[] {
  return pokemon.slice(0, 6).map((mon) => {
    const stats = calculateFinalStats(mon);
    return {
      species: text.species(mon.species),
      nature: mon.nature ? text.nature(mon.nature) : "",
      ability: mon.ability ? text.ability(mon.ability) : "",
      item: mon.item ? text.item(mon.item) : "",
      moves: (mon.moves ?? []).filter(Boolean).map((move) => text.move(move)),
      stats: stats
        ? [stats.hp, stats.atk, stats.def, stats.spa, stats.spd, stats.speedBeforeItem ?? stats.spe]
        : null,
    };
  });
}
