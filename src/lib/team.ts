import { parseTeam } from "./parseTeam";
import type { ParsedPokemon, Team } from "@/types";

export function createTeam(rawPaste: string, name: string): Team {
  return {
    id: crypto.randomUUID(),
    name,
    rawPaste,
    pokemon: parseTeam(rawPaste),
    updatedAt: new Date().toISOString(),
  };
}

/** Returns an error message if the parsed roster isn't a valid VGC team, or null if it's fine. */
export function validateTeamSize(pokemon: ParsedPokemon[]): string | null {
  if (pokemon.length === 0) {
    return "Couldn't find any Pokémon in that paste.";
  }
  if (pokemon.length > 6) {
    return `Found ${pokemon.length} Pokémon — a team can only have 6. Paste just one team.`;
  }
  return null;
}
