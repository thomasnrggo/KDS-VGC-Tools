import { generateId } from "@/lib/id";
import { parseStatPoints } from "@/lib/stats/calculateFinalStats";
import { speciesIdentity } from "@/lib/teamIdentity";
import type { SlotMap } from "@/lib/rosterSlots";
import type { BaseStats, ParsedPokemon, Team, TeamSnapshot, TeamSnapshotData } from "@/types";

/**
 * Team snapshots ("versions"): save the team as it is when you're happy with
 * it, keep changing it, and look back at — or restore — that version later.
 *
 * A snapshot keeps the build and the strategy together (SNAPSHOT_FIELDS):
 * combinations point at roster slots, so a roster restored without them
 * could leave them pointing at the wrong Pokémon. It leaves out the team's
 * identity — name, regulations, folder, sharing, collaboration — so
 * restoring never renames, unshares or moves it. Snapshots are saved on the
 * team itself (`Team.snapshots`, newest first), so they sync and, on a
 * collaborative team, are shared with its members. A shared copy never
 * includes them (toSharedTeam lists its fields).
 */

export const SNAPSHOT_FIELDS = [
  "rawPaste",
  "pokemon",
  "notes",
  "weaknesses",
  "pokemonNotes",
  "combinations",
  "overview",
  "calcs",
  "speedPins",
  "pokepasteUrl",
  "replicaCode",
] as const satisfies readonly (keyof TeamSnapshotData)[];

/** Snapshots kept per team; past it, the oldest go — automatic ones first. */
export const MAX_SNAPSHOTS = 20;

/** The team's build and strategy, as a snapshot keeps them. Fields it doesn't have are left out (Firestore rejects `undefined`). */
export function snapshotData(team: Team): TeamSnapshotData {
  const data: Record<string, unknown> = {};
  for (const field of SNAPSHOT_FIELDS) {
    if (team[field] !== undefined) data[field] = team[field];
  }
  return data as unknown as TeamSnapshotData;
}

export function createSnapshot(
  team: Team,
  name: string,
  options: { createdBy?: string; auto?: TeamSnapshot["auto"]; now?: string } = {},
): TeamSnapshot {
  return {
    id: generateId(),
    name: name.trim(),
    createdAt: options.now ?? new Date().toISOString(),
    ...(options.createdBy ? { createdBy: options.createdBy } : {}),
    ...(options.auto ? { auto: options.auto } : {}),
    data: snapshotData(team),
  };
}

/** The team with `snapshot` added first, past MAX_SNAPSHOTS dropping the oldest (an automatic one before one saved by hand). */
export function withSnapshot(team: Team, snapshot: TeamSnapshot): Team {
  const list = [snapshot, ...(team.snapshots ?? [])];
  while (list.length > MAX_SNAPSHOTS) {
    const oldestAuto = list.findLastIndex((entry, index) => index > 0 && !!entry.auto);
    list.splice(oldestAuto > 0 ? oldestAuto : list.length - 1, 1);
  }
  return { ...team, snapshots: list };
}

export function withoutSnapshot(team: Team, id: string): Team {
  const list = (team.snapshots ?? []).filter((snapshot) => snapshot.id !== id);
  const next = { ...team };
  if (list.length) next.snapshots = list;
  // `delete`, not `undefined` — see unarchiveTeam.
  else delete next.snapshots;
  return next;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Whether the team is exactly as the snapshot keeps it. */
export function matchesSnapshot(team: Team, snapshot: TeamSnapshot): boolean {
  const current = snapshotData(team) as unknown as Record<string, unknown>;
  const saved = snapshot.data as unknown as Record<string, unknown>;
  return SNAPSHOT_FIELDS.every((field) => same(current[field], saved[field]));
}

/** The team with a snapshot's build and strategy put back — nothing else changed. */
export function applySnapshot(team: Team, snapshot: TeamSnapshot): Team {
  const next: Record<string, unknown> = { ...team };
  const saved = snapshot.data as unknown as Record<string, unknown>;
  for (const field of SNAPSHOT_FIELDS) {
    if (saved[field] === undefined) delete next[field];
    else next[field] = saved[field];
  }
  return next as unknown as Team;
}

/**
 * Restores a snapshot: the team as it is now is saved first, as an automatic
 * snapshot named `beforeName` (unless it already matches one), so a restore
 * can always be undone.
 */
export function restoreSnapshot(
  team: Team,
  snapshot: TeamSnapshot,
  beforeName: string,
  options: { createdBy?: string; now?: string } = {},
): Team {
  const now = options.now ?? new Date().toISOString();
  const alreadySaved = (team.snapshots ?? []).some((saved) => matchesSnapshot(team, saved));
  const kept = alreadySaved
    ? team
    : withSnapshot(
        team,
        createSnapshot(team, beforeName, { ...options, now, auto: "beforeRestore" }),
      );
  return { ...applySnapshot(kept, snapshot), updatedAt: now };
}

export type StatKey = keyof BaseStats;

/** What changed in one Pokémon kept on the team. */
export interface PokemonChange {
  kind: "changed";
  species: string;
  item?: [string | undefined, string | undefined];
  ability?: [string | undefined, string | undefined];
  nature?: [string | undefined, string | undefined];
  movesAdded: string[];
  movesRemoved: string[];
  /** Stat points that moved, as now minus then. */
  points: { stat: StatKey; delta: number }[];
}

export type SnapshotChange =
  | { kind: "added"; species: string }
  | { kind: "removed"; species: string }
  | PokemonChange
  | { kind: "strategy"; parts: StrategyPart[] };

export type StrategyPart = "notes" | "combinations" | "calcs" | "speedPins" | "overview";

const STATS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];

function pokemonChange(then: ParsedPokemon, now: ParsedPokemon): PokemonChange | null {
  const change: PokemonChange = {
    kind: "changed",
    species: now.species,
    movesAdded: (now.moves ?? []).filter((move) => !(then.moves ?? []).includes(move)),
    movesRemoved: (then.moves ?? []).filter((move) => !(now.moves ?? []).includes(move)),
    points: [],
  };
  for (const key of ["item", "ability", "nature"] as const) {
    if ((then[key] ?? "") !== (now[key] ?? "")) change[key] = [then[key], now[key]];
  }
  const before = parseStatPoints(then.evs);
  const after = parseStatPoints(now.evs);
  change.points = STATS.flatMap((stat) =>
    after[stat] !== before[stat] ? [{ stat, delta: after[stat] - before[stat] }] : [],
  );
  const changed =
    change.item ||
    change.ability ||
    change.nature ||
    change.movesAdded.length ||
    change.movesRemoved.length ||
    change.points.length ||
    then.species !== now.species;
  return changed ? change : null;
}

/**
 * What changed from a snapshot to the team now: Pokémon added or removed
 * (matched by species, so reordering isn't a change), each kept Pokémon's
 * item, ability, nature, moves and stat points, and which parts of the
 * strategy were edited.
 */
export function snapshotChanges(snapshot: TeamSnapshotData, team: Team): SnapshotChange[] {
  const changes: SnapshotChange[] = [];
  const then = snapshot.pokemon;
  const now = team.pokemon;
  const thenBy = new Map(then.map((mon) => [speciesIdentity(mon.species), mon]));
  const nowBy = new Map(now.map((mon) => [speciesIdentity(mon.species), mon]));
  for (const mon of then) {
    if (!nowBy.has(speciesIdentity(mon.species))) {
      changes.push({ kind: "removed", species: mon.species });
    }
  }
  for (const mon of now) {
    const old = thenBy.get(speciesIdentity(mon.species));
    if (!old) changes.push({ kind: "added", species: mon.species });
    else {
      const change = pokemonChange(old, mon);
      if (change) changes.push(change);
    }
  }
  const current = snapshotData(team);
  const parts: StrategyPart[] = [];
  if (!same(snapshot.notes, current.notes) || !same(snapshot.weaknesses, current.weaknesses)) {
    parts.push("notes");
  }
  if (!same(snapshot.combinations, current.combinations)) parts.push("combinations");
  if (!same(snapshot.calcs, current.calcs)) parts.push("calcs");
  if (!same(snapshot.speedPins, current.speedPins)) parts.push("speedPins");
  if (!same(snapshot.overview, current.overview)) parts.push("overview");
  if (parts.length) changes.push({ kind: "strategy", parts });
  return changes;
}

/** A team of its own from a snapshot: the team as the snapshot keeps it, under `name`, with no snapshots of its own. */
export function teamFromSnapshot(team: Team, snapshot: TeamSnapshot): Team {
  const restored = applySnapshot(team, snapshot);
  delete restored.snapshots;
  return restored;
}

/**
 * Where each of the team's Pokémon lands when `restored` is put back —
 * matched by species, so plans and logged games that pick from the roster
 * (src/lib/rosterSlots.ts) keep pointing at the same Pokémon. One the
 * restored roster doesn't have is cleared. Null when nothing moves.
 */
export function restoreSlotMap(
  current: ParsedPokemon[],
  restored: ParsedPokemon[],
): SlotMap | null {
  const used = new Set<number>();
  const targets = current.map((mon) => {
    const at = restored.findIndex(
      (candidate, index) =>
        !used.has(index) && speciesIdentity(candidate.species) === speciesIdentity(mon.species),
    );
    if (at < 0) return null;
    used.add(at);
    return at;
  });
  if (targets.every((target, slot) => target === slot)) return null;
  return (slot) => targets[slot] ?? null;
}
