/**
 * Team archetypes — see docs/archetypes.md. Three layers:
 *
 * 1. Checks (code): questions about one Pokémon on a team sheet — its
 *    species, ability, moves, item, base stats, nature, or a computed check.
 * 2. Roles (data): a named combination of checks — "Sun setter",
 *    "Redirection", "Trick Room attacker".
 * 3. Archetypes (data): a recipe of roles counted across the team —
 *    "Sun · Fire spam" needs a Sun setter and Mega Pyroar.
 *
 * Roles and archetypes are plain data so they can live in Firestore and be
 * edited from an admin page; only a new kind of check needs code.
 */

/** A Pokémon's base stats, plus two derived ones: `offense` (the higher attack) and `bulk` (mean of HP, Def, SpD). */
export type BaseStatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe" | "offense" | "bulk";

export type NatureStatKey = "atk" | "def" | "spa" | "spd" | "spe";

/** Checks that need real logic — each is implemented in checks.ts. */
export type ComputedCheckId =
  /** Two or more damaging moves and a base attacking stat of 90+. */
  | "attacker"
  /** Offense far above bulk (base offense ≥ 110, bulk ≤ 85). */
  | "fragileAttacker"
  /** Knows a damaging spread move (Heat Wave, Earthquake, …). */
  | "spreadAttacker"
  /** One damaging move at most — with a setup move, it can't do much without the boost. */
  | "fewAttacks";

/**
 * Layer 1: a question about one Pokémon. Names (species, abilities, moves,
 * items) are compared as slugs, so "Heat Wave" and "heat-wave" both work.
 * Species match the Pokémon's form after Mega Evolution ("pyroar-mega") or
 * its base identity ("pyroar" matches both).
 */
export type Check =
  | { species: string[] }
  /** The ability it has in battle — a Mega Stone's ability replaces the pasted one. */
  | { ability: string[] }
  | { move: string[] }
  | { item: string[] }
  /** Every listed stat must be in range (inclusive). Mega forms use their own base stats. */
  | { baseStat: Partial<Record<BaseStatKey, { min?: number; max?: number }>> }
  | { natureLowers: NatureStatKey }
  | { natureRaises: NatureStatKey }
  | { computed: ComputedCheckId }
  | { allOf: Check[] }
  | { anyOf: Check[] }
  | { not: Check };

/** Layer 2: a named job a Pokémon can do. One Pokémon can hold several roles. */
export interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  match: Check;
}

/**
 * A condition on the whole team: how many of its Pokémon hold a role, or
 * pass an inline check. `min` defaults to 1; `max` is open unless given.
 */
export type TeamCondition =
  | { role: string; min?: number; max?: number }
  | { pokemon: Check; min?: number; max?: number }
  | { allOf: TeamCondition[] }
  | { anyOf: TeamCondition[] };

/**
 * How an archetype plays — the owner's colors: offense (red, "blow it up"),
 * positioning (blue, "wait until perfect"), patient (green, "take your time").
 * A description of the archetype, not a classification of teams; none (black) = no fixed tempo.
 */
export type Tempo = "offense" | "positioning" | "patient";

export type ArchetypeFamily =
  "speedControl" | "weather" | "terrain" | "setup" | "stall" | "screens" | "perishTrap";

/** Layer 3: a recipe. */
export interface ArchetypeDefinition {
  id: string;
  name: string;
  family: ArchetypeFamily;
  /**
   * Archetypes this one refines. Their `requires` are inherited (not their
   * `excludes`), so a child only lists what makes it different. Several
   * parents are allowed: Double weather refines both Sun and Rain.
   */
  parents?: string[];
  /** The game plan, in a sentence or two — shown to users. */
  description: string;
  /** All must pass. */
  requires: TeamCondition[];
  /** None may pass. */
  excludes?: TeamCondition[];
  /** Strengthen a match without being needed — signature Pokémon, typical partners. */
  boosts?: { condition: TeamCondition; weight: number }[];
  /**
   * Breaks ties between unrelated archetypes a team matches at once: a Sun
   * team that also runs Tailwind is "Sun" (3) tagged Tailwind (1).
   */
  priority: number;
  /** Its tempo; a variant without one takes its nearest ancestor's (archetypeTempo). */
  tempo?: Tempo;
  /** Regulation ids ("M-C") it applies to; omitted = every regulation. */
  regulations?: string[];
  status: "active" | "draft";
}

export interface ArchetypeSet {
  /** Bumped on every change, so stored classifications can tell they're stale. */
  version: number;
  roles: RoleDefinition[];
  archetypes: ArchetypeDefinition[];
}

export interface ArchetypeMatch {
  id: string;
  /** Required conditions, inherited ones included — the more, the more specific. */
  specificity: number;
  /** Sum of the matched boosts' weights. */
  boost: number;
  priority: number;
}

export interface TeamClassification {
  /** The best match's id, or null — no engine dominates: Balance. */
  primary: string | null;
  /** Matches from other families — "Sun", tagged "Tailwind". One per family. */
  tags: string[];
  /** Matches folded into the primary or a tag of the same family — Double weather's Sun · Chlorophyll. */
  folded: string[];
  /** The speed-control archetype among primary and tags (Tailwind, Trick Room, Tail/room), if any. */
  speedMode: string | null;
  /** Every match, best first. */
  matches: ArchetypeMatch[];
  /** Each Pokémon's role ids, in team order. */
  roles: string[][];
}
