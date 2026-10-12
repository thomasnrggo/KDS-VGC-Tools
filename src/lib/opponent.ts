import { createTeam } from "./team";
import { generateId } from "./id";
import { EMPTY_PLAN } from "@/constants";
import { REGULATIONS } from "@/data/regulations";
import type { MatchupPlan, Opponent, PokemonSlot } from "@/types";

export function createOpponent(
  label: string,
  rawPaste: string,
  regulationId: string,
  pokepasteUrl?: string,
  sortOrder: number = Date.now(),
): Opponent {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    label,
    team: createTeam(rawPaste, label, regulationId),
    pokepasteUrl,
    regulationId,
    plansByTeamId: {},
    sortOrder,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Returns the matchup plan for `teamId`, or an empty one if none has been made yet. Merges over
 * EMPTY_PLAN rather than trusting the stored shape directly, so a plan saved before a field (e.g.
 * `leadMega`/`backMega`) existed still gets that field's default instead of `undefined`.
 */
export function getPlanForTeam(opponent: Opponent, teamId: string | null): MatchupPlan {
  if (!teamId) return EMPTY_PLAN;
  const plan = opponent.plansByTeamId[teamId];
  if (!plan) return EMPTY_PLAN;
  return { ...EMPTY_PLAN, ...plan };
}

/**
 * Backfills fields for opponents saved by an older version of the schema. Storage should
 * always read through this rather than trusting IndexedDB's stored shape.
 *
 * - Pre-plansByTeamId records (`leadPair`/`backPair`/`notes` lived directly on Opponent) are
 *   migrated into `plansByTeamId[legacyTeamId]`, so the single team that existed at the time
 *   keeps its picks. `legacyTeamId` is the id of whatever "My Team" the DB migration resolved
 *   (see storage/db.ts) — falls back to a fixed key if that's unavailable.
 * - Pre-regulationId records (every opponent added before the regulation switcher existed) get
 *   tagged with the current regulation — `REGULATIONS[0]` today, the only one registered — rather
 *   than being left unfiltered/invisible once switching is a thing.
 */
export function normalizeOpponent(opponent: Opponent, legacyTeamId?: string | null): Opponent {
  let next = opponent.plansByTeamId ? opponent : migrateLegacyPlan(opponent, legacyTeamId);
  if (!next.regulationId) {
    next = { ...next, regulationId: REGULATIONS[0].id };
  }
  if (typeof next.sortOrder !== "number") {
    // createdAt as a stand-in reproduces the newest-first order the list had
    // before manual ordering existed.
    next = { ...next, sortOrder: new Date(next.createdAt).getTime() };
  }
  if (!Array.isArray(next.tags)) {
    next = { ...next, tags: [] };
  }
  return next;
}

/**
 * List order: highest sortOrder first, ties broken by createdAt (newest
 * first) and then id. The tie-breaks matter — IndexedDB returns records in
 * random-UUID key order, so without a fully deterministic comparator tied
 * opponents (e.g. a legacy bulk import that all got the same millisecond)
 * reshuffle on every reload.
 */
export function compareOpponentOrder(a: Opponent, b: Opponent): number {
  return (
    b.sortOrder - a.sortOrder ||
    b.createdAt.localeCompare(a.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

/** A sortOrder that places a new opponent above every one in `opponents` (pass one regulation's list). */
export function topSortOrder(opponents: Opponent[]): number {
  if (opponents.length === 0) return 0;
  return Math.max(...opponents.map((opponent) => opponent.sortOrder)) + 1;
}

/**
 * Moves `movedId` to position `toIndex` of `ordered` — one regulation's
 * opponents, already in list order (see compareOpponentOrder) — and returns
 * only the opponents whose sortOrder changed, ready to persist.
 *
 * Normally that's just the moved opponent: it gets the midpoint of its new
 * neighbors' sortOrders, so a move costs one cloud-sync write rather than
 * rewriting everything in between. Only when there's no room between the
 * neighbors (tied values, e.g. legacy opponents imported in the same
 * millisecond) does it renumber the whole list.
 */
export function moveOpponent(ordered: Opponent[], movedId: string, toIndex: number): Opponent[] {
  const fromIndex = ordered.findIndex((opponent) => opponent.id === movedId);
  if (fromIndex === -1) return [];
  const rest = ordered.filter((opponent) => opponent.id !== movedId);
  const index = Math.max(0, Math.min(toIndex, rest.length));
  if (index === fromIndex) return [];

  const moved = ordered[fromIndex];
  const above = rest[index - 1];
  const below = rest[index];
  const now = new Date().toISOString();

  let sortOrder: number | null = null;
  if (!above) {
    sortOrder = below.sortOrder + 1;
  } else if (!below) {
    sortOrder = above.sortOrder - 1;
  } else {
    const midpoint = (above.sortOrder + below.sortOrder) / 2;
    if (midpoint < above.sortOrder && midpoint > below.sortOrder) sortOrder = midpoint;
  }
  if (sortOrder !== null) {
    return [{ ...moved, sortOrder, updatedAt: now }];
  }

  const reordered = [...rest];
  reordered.splice(index, 0, moved);
  const top = Math.max(...ordered.map((opponent) => opponent.sortOrder));
  return reordered.flatMap((opponent, position) => {
    const nextSortOrder = top - position;
    return opponent.sortOrder === nextSortOrder
      ? []
      : [{ ...opponent, sortOrder: nextSortOrder, updatedAt: now }];
  });
}

function migrateLegacyPlan(opponent: Opponent, legacyTeamId?: string | null): Opponent {
  const legacy = opponent as unknown as Opponent & {
    leadPair?: [PokemonSlot, PokemonSlot];
    backPair?: [PokemonSlot, PokemonSlot];
    notes?: string;
  };
  const hadLegacyPlan = legacy.leadPair || legacy.backPair || legacy.notes;
  const plansByTeamId: Record<string, MatchupPlan> = {};
  if (hadLegacyPlan) {
    plansByTeamId[legacyTeamId ?? "legacy"] = {
      leadPair: legacy.leadPair ?? [null, null],
      backPair: legacy.backPair ?? [null, null],
      leadMega: [true, true],
      backMega: [true, true],
      notes: legacy.notes ?? "",
    };
  }

  return {
    id: opponent.id,
    label: opponent.label,
    team: opponent.team,
    pokepasteUrl: opponent.pokepasteUrl,
    regulationId: opponent.regulationId,
    plansByTeamId,
    sortOrder: opponent.sortOrder,
    tags: opponent.tags,
    variantOf: opponent.variantOf,
    copiedPlanFrom: opponent.copiedPlanFrom,
    createdAt: opponent.createdAt,
    updatedAt: opponent.updatedAt,
  };
}
