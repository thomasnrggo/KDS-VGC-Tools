import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { stripMegaSuffix } from "@/lib/species/megaForm";
import type { ParsedPokemon } from "@/types";

// Forms a paste can name that are the same Pokémon for matching purposes.
// Floettite's base is plain "floette" in the regulation data, but Champions
// pastes export the Eternal Flower form.
const SPECIES_IDENTITY_ALIASES: Record<string, string> = {
  "floette-eternal": "floette",
};

/**
 * The key two Pokémon share when they're "the same Pokémon" for duplicate
 * and variant matching — normalized, with a Mega suffix dropped
 * ("Floette-Mega" @ Floettite ≡ "Floette-Eternal" @ Floettite). Other forms
 * stay distinct: Arcanine-Hisui is not Arcanine. See
 * docs/opponent-organization.md.
 */
export function speciesIdentity(species: string): string {
  const key = normalizeSpeciesKey(stripMegaSuffix(species));
  return SPECIES_IDENTITY_ALIASES[key] ?? key;
}

function pokemonFingerprint(mon: ParsedPokemon): string {
  const item = mon.item ? normalizeSpeciesKey(mon.item) : "";
  const moves = (mon.moves ?? []).map((move) => normalizeSpeciesKey(move)).sort();
  return [speciesIdentity(mon.species), item, moves.join(",")].join("|");
}

/**
 * A string that's equal for two teams exactly when they're the same team:
 * same Pokémon, each with the same item and the same moves. Slot order,
 * move order, nicknames, whitespace, and the paste's other lines (ability,
 * nature, Stat Points) don't count — a scouted team re-pasted from another
 * source shouldn't import twice just because its EV line differs.
 */
export function teamFingerprint(pokemon: ParsedPokemon[]): string {
  return pokemon.map(pokemonFingerprint).sort().join("\n");
}
