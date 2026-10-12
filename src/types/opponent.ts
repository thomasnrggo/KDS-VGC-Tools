import type { Team } from "./team";

/** An index into a My Team's pokemon, or null for "not picked yet" — each slot is independent. */
export type PokemonSlot = number | null;

export interface MatchupPlan {
  leadPair: [PokemonSlot, PokemonSlot];
  backPair: [PokemonSlot, PokemonSlot];
  /** Whether each Lead/Back slot's Mega-capable pick should render in its Mega form — defaults to true via EMPTY_PLAN, so plans saved before this field existed still show Mega by default (matching the old, always-Mega behavior). */
  leadMega: [boolean, boolean];
  backMega: [boolean, boolean];
  notes: string;
}

export interface Opponent {
  id: string;
  label: string;
  team: Team;
  pokepasteUrl?: string;
  /** Regulation.id (see src/data/regulations) this opponent was prepped under — lets the Matchup Planner filter the list by regulation instead of showing every opponent you've ever added forever. Opponents saved before this field existed are backfilled to the current regulation by normalizeOpponent. */
  regulationId: string;
  /** Lead/back picks + notes, keyed by which of your (possibly several) teams is planning against this opponent. */
  plansByTeamId: Record<string, MatchupPlan>;
  /** Manual list position, highest first (same convention as Team.sortOrder) — set by drag/Move up/down, see docs/opponent-organization.md. Opponents saved before this field existed are backfilled from createdAt by normalizeOpponent. */
  sortOrder: number;
  /** Strategy tags (rain, sun, perish, …), normalized via normalizeTag in src/lib/opponentTags.ts — searchable alongside Pokémon/items. Backfilled to [] by normalizeOpponent. */
  tags: string[];
  /** Set on a variant: the id of its group's main opponent. Absent on a main. One level deep — a main is never itself a variant. See docs/opponent-organization.md. */
  variantOf?: string;
  /** Your team id → the opponent id a plan was copied from when this became a variant. Drives the "Copied from …" badge; an entry is dropped once that plan is edited. */
  copiedPlanFrom?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
