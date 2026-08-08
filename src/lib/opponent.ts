import { createTeam, type Team } from "./team";

/** An index into MyTeam.pokemon, or null for "not picked yet" — each slot is independent. */
export type PokemonSlot = number | null;

export interface Opponent {
  id: string;
  label: string;
  team: Team;
  pokepasteUrl?: string;
  leadPair: [PokemonSlot, PokemonSlot];
  backPair: [PokemonSlot, PokemonSlot];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export function createOpponent(label: string, rawPaste: string, pokepasteUrl?: string): Opponent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    label,
    team: createTeam(rawPaste),
    pokepasteUrl,
    leadPair: [null, null],
    backPair: [null, null],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Backfills fields for opponents saved by an older version of the schema (e.g. before
 * leadPair/backPair/notes lived directly on Opponent instead of under a gamePlans array).
 * Storage should always read through this rather than trusting IndexedDB's stored shape.
 */
export function normalizeOpponent(opponent: Opponent): Opponent {
  return {
    ...opponent,
    leadPair: opponent.leadPair ?? [null, null],
    backPair: opponent.backPair ?? [null, null],
    notes: opponent.notes ?? "",
  };
}
