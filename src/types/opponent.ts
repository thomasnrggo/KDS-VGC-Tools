import type { Team } from "./team";

/** An index into a My Team's pokemon, or null for "not picked yet" — each slot is independent. */
export type PokemonSlot = number | null;

/** Four picks from one roster: who leads and who's in the back, with each slot's Mega toggle. */
export interface PlanPicks {
  leadPair: [PokemonSlot, PokemonSlot];
  backPair: [PokemonSlot, PokemonSlot];
  leadMega: [boolean, boolean];
  backMega: [boolean, boolean];
  /** Back 2's alternative — "A or B": the last pick depends on the game. Only your own picks have one. */
  backAlt?: PokemonSlot;
}

/**
 * One way to play a matchup: what you expect them to bring (`theirs`, slots
 * into the opponent's roster) and what you bring against it (slots into your
 * team), with notes (rich text, HTML). Plan A lives in MatchupPlan's own
 * fields; Plans B, C… are `morePlans` — see src/lib/matchupPlans.ts.
 */
export interface GamePlan extends PlanPicks {
  id: string;
  notes: string;
  theirs?: PlanPicks;
}

export interface MatchupPlan {
  leadPair: [PokemonSlot, PokemonSlot];
  backPair: [PokemonSlot, PokemonSlot];
  /** Whether each Lead/Back slot's Mega-capable pick should render in its Mega form — defaults to true via EMPTY_PLAN, so plans saved before this field existed still show Mega by default (matching the old, always-Mega behavior). */
  leadMega: [boolean, boolean];
  backMega: [boolean, boolean];
  /** Back 2's alternative — "A or B": the last pick depends on the game. Only your own picks have one. */
  backAlt?: PokemonSlot;
  notes: string;
  /** Matchup page notes per opponent Pokémon, keyed by index into the opponent's roster (see docs/team-report.md). */
  pokemonNotes?: Record<number, string>;
  /** Matchup page "What they do" — rich text: their likely leads, common plays. */
  scoutingNotes?: string;
  /** Plan A's id (stable across reordering; set once a matchup has more than one plan). */
  planId?: string;
  /** Plan A's expected opponent picks (slots into the opponent's roster). */
  theirs?: PlanPicks;
  /** Plans B, C…, in order. Plan A is this object's own fields — see src/lib/matchupPlans.ts. */
  morePlans?: GamePlan[];
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
  /** In a prep group: who added it (uid and display name) — they and the group's owner can remove it. Absent on personal opponents. See docs/prep-groups.md. */
  addedBy?: string;
  addedByName?: string;
  createdAt: string;
  updatedAt: string;
}
