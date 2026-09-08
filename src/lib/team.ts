import { parseTeam } from "./parseTeam";
import { generateId } from "./id";
import { REGULATIONS } from "@/data/regulations";
import type { ParsedPokemon, Team } from "@/types";

export function createTeam(rawPaste: string, name: string, regulationId: string): Team {
  return {
    id: generateId(),
    name,
    rawPaste,
    pokemon: parseTeam(rawPaste),
    regulationId,
    updatedAt: new Date().toISOString(),
  };
}

/** Backfills `regulationId` for teams saved before it existed — storage should always read through this rather than trusting IndexedDB's stored shape (same reasoning as normalizeOpponent). */
export function normalizeTeam(team: Team): Team {
  return team.regulationId ? team : { ...team, regulationId: REGULATIONS[0].id };
}

export function archiveTeam(team: Team): Team {
  return { ...team, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function unarchiveTeam(team: Team): Team {
  // `delete`, not `archivedAt: undefined` — Firestore's setDoc (see
  // teamsSync.push) rejects `undefined` field values outright, so the key
  // has to be removed entirely rather than nulled out.
  const updated = { ...team, updatedAt: new Date().toISOString() };
  delete updated.archivedAt;
  return updated;
}

export function isTeamArchived(team: Team): boolean {
  return !!team.archivedAt;
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
