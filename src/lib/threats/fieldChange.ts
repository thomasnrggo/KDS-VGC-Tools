import movesData from "@/data/moves.json";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import type { DamageCalcOptions } from "@/types";
import type { MoveData } from "@/types/damage";
import type { Duel } from "./analyzeThreats";

const MOVES = movesData as unknown as Record<string, MoveData>;

type Weather = NonNullable<DamageCalcOptions["weather"]>;
type Terrain = NonNullable<DamageCalcOptions["terrain"]>;

/** How a weather or terrain changes a move: powers it up, weakens it, or changes it some other way (Weather Ball, Solar Beam, an ability). */
export type FieldDirection = "up" | "down" | "changed";

/** Grounded moves Grassy Terrain halves. */
const GRASSY_HALVED = new Set(["earthquake", "bulldoze", "magnitude"]);

/** How `field` changes `move` — for a hit the calcs flagged as changed by it. */
export function fieldDirection(
  field: { weather: Weather } | { terrain: Terrain },
  move: string,
): FieldDirection {
  const key = normalizeSpeciesKey(move);
  const type = MOVES[key]?.type;
  if ("weather" in field) {
    const [boosts, weakens] =
      field.weather === "Sun"
        ? ["Fire", "Water"]
        : field.weather === "Rain"
          ? ["Water", "Fire"]
          : [];
    if (type && type === boosts) return "up";
    if (type && type === weakens) return "down";
    return "changed";
  }
  switch (field.terrain) {
    case "Grassy":
      if (GRASSY_HALVED.has(key)) return "down";
      return type === "Grass" ? "up" : "changed";
    case "Electric":
      return type === "Electric" ? "up" : "changed";
    case "Psychic":
      return type === "Psychic" ? "up" : "changed";
    case "Misty":
      return type === "Dragon" ? "down" : "changed";
  }
}

export interface FieldChange {
  /** The threat's moves the field powers up, weakens or otherwise changes. */
  its: Record<FieldDirection, string[]>;
  /** Yours (setup hits included). */
  yours: Record<FieldDirection, string[]>;
}

/**
 * What a threat's weather or terrain changed in its duels, move by move:
 * "Charizard's Sun powers up its Flare Blitz and weakens your Wave Crash".
 * Null when it changed no hit (only who moves first, or nothing).
 */
export function fieldChange(
  duels: Duel[],
  field: { weather: Weather } | { terrain: Terrain },
): FieldChange | null {
  const applied = (hit: Duel["theirs"] | undefined) =>
    !!hit && ("weather" in field ? hit.weatherApplied : hit.terrainApplied);
  const empty = (): Record<FieldDirection, string[]> => ({ up: [], down: [], changed: [] });
  const change: FieldChange = { its: empty(), yours: empty() };
  const add = (side: Record<FieldDirection, string[]>, move: string) => {
    const list = side[fieldDirection(field, move)];
    if (!list.includes(move)) list.push(move);
  };
  for (const duel of duels) {
    if (applied(duel.theirs)) add(change.its, duel.theirs!.move);
    if (applied(duel.yours)) add(change.yours, duel.yours!.move);
    if (applied(duel.setup)) add(change.yours, duel.setup!.move);
  }
  const any = (side: Record<FieldDirection, string[]>) =>
    side.up.length + side.down.length + side.changed.length > 0;
  return any(change.its) || any(change.yours) ? change : null;
}
