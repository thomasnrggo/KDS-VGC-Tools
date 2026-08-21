import { calculateStatBreakdown } from "./stats/calculateFinalStats";
import type { ParsedPokemon, StatKey } from "@/types";

const EVS_LABEL: Record<StatKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};
const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];

/**
 * Serializes a single Pokémon back into Showdown export text — the inverse
 * of parseTeam.ts's parsePokemonBlock, for the Damage Calculator's
 * Export button. Reflects whatever the calculator's current state actually
 * is (item/ability/nature/Stat Points/moves, including any in-calculator
 * edits already folded into `pokemon` via applyStatOverrides), not
 * necessarily the originally-pasted text.
 *
 * Always includes "Level: 50" (this app's only supported level, so it's
 * always true and worth being explicit about for a paste re-imported
 * elsewhere) but omits Shiny/Tera Type/IVs — this app doesn't track any of
 * those, so there's nothing accurate to write. Stat Points at exactly 0 are
 * left out of the EVs line, matching the conventional Showdown-export
 * style (only non-zero stats listed) rather than always listing all 6 the
 * way `applyStatOverrides`'s own internal `evs` string does.
 */
export function formatPokemonPaste(pokemon: ParsedPokemon): string {
  const lines: string[] = [
    pokemon.item ? `${pokemon.species} @ ${pokemon.item}` : pokemon.species,
  ];

  if (pokemon.ability) lines.push(`Ability: ${pokemon.ability}`);
  lines.push("Level: 50");

  const breakdown = calculateStatBreakdown(pokemon);
  const nonZeroSp = breakdown
    ? STAT_ORDER.filter((stat) => breakdown.statPoints[stat] > 0).map(
        (stat) => `${breakdown.statPoints[stat]} ${EVS_LABEL[stat]}`,
      )
    : [];
  if (nonZeroSp.length > 0) lines.push(`EVs: ${nonZeroSp.join(" / ")}`);

  lines.push(`${pokemon.nature ?? "Hardy"} Nature`);

  for (const move of pokemon.moves ?? []) {
    lines.push(`- ${move}`);
  }

  return lines.join("\n");
}

/**
 * Serializes multiple Pokémon into one Showdown team export — each
 * `formatPokemonPaste` block separated by a blank line, the same
 * separator `parseTeam`'s `splitIntoBlocks` expects, so this round-trips
 * through Import's team-paste path.
 */
export function formatTeamPaste(pokemon: ParsedPokemon[]): string {
  return pokemon.map(formatPokemonPaste).join("\n\n");
}
