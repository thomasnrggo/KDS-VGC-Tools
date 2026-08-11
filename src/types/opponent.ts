import type { Team } from "./team";

/** An index into a My Team's pokemon, or null for "not picked yet" — each slot is independent. */
export type PokemonSlot = number | null;

export interface MatchupPlan {
  leadPair: [PokemonSlot, PokemonSlot];
  backPair: [PokemonSlot, PokemonSlot];
  notes: string;
}

export interface Opponent {
  id: string;
  label: string;
  team: Team;
  pokepasteUrl?: string;
  /** Lead/back picks + notes, keyed by which of your (possibly several) teams is planning against this opponent. */
  plansByTeamId: Record<string, MatchupPlan>;
  createdAt: string;
  updatedAt: string;
}
