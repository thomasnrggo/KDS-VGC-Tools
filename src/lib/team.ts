import { parseTeam } from "./parseTeam";
import { generateId } from "./id";
import { REGULATIONS } from "@/data/regulations";
import type { ParsedPokemon, Team } from "@/types";
import { getMessages } from "./i18n/settings";

export function createTeam(rawPaste: string, name: string, regulationId: string): Team {
  return {
    id: generateId(),
    name,
    rawPaste,
    pokemon: parseTeam(rawPaste),
    regulationIds: [regulationId],
    // Date.now() is (in practice) always larger than any existing team's
    // sortOrder, new or migrated — see Team.sortOrder's doc comment for why
    // that's what puts a freshly created team at the top of the list.
    sortOrder: Date.now(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Backfills/migrates `regulationIds` for teams saved before it existed or
 * before it was pluralized (was a single `regulationId` string), and
 * `sortOrder` for teams saved before manual reordering existed — storage
 * should always read through this rather than trusting IndexedDB's stored
 * shape (same reasoning as normalizeOpponent).
 */
export function normalizeTeam(team: Team): Team {
  let next = team;
  if (!Array.isArray(next.regulationIds) || next.regulationIds.length === 0) {
    const legacy = next as unknown as Team & { regulationId?: string };
    next = { ...next, regulationIds: [legacy.regulationId ?? REGULATIONS[0].id] };
    delete (next as Team & { regulationId?: string }).regulationId;
  }
  if (typeof next.sortOrder !== "number") {
    // The team's own updatedAt timestamp as a stand-in — preserves whatever
    // relative creation order these teams already had (older updatedAt =
    // smaller number = sorts lower), rather than assigning them all the same
    // value or an arbitrary one.
    next = { ...next, sortOrder: new Date(next.updatedAt).getTime() };
  }
  return next;
}

/**
 * Tags `team` as also legal under `regulationId` (no-op if already tagged) —
 * the "promote"/"migrate" action from a team's row menu. Callers should
 * check isTeamLegalUnderRegulation first; this function itself doesn't
 * validate, so it stays usable for the (rarer) case of deliberately tagging
 * an override.
 */
export function addRegulationTag(team: Team, regulationId: string): Team {
  if (team.regulationIds.includes(regulationId)) return team;
  return { ...team, regulationIds: [...team.regulationIds, regulationId] };
}

/** Untags `team` from `regulationId` — a no-op if it would leave the team with zero regulations (every team must stay usable under at least one). */
export function removeRegulationTag(team: Team, regulationId: string): Team {
  if (team.regulationIds.length <= 1) return team;
  return { ...team, regulationIds: team.regulationIds.filter((id) => id !== regulationId) };
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

/**
 * Applies a drag-and-drop reorder — `orderedIds` is the *visible* team list
 * (one regulation/tab, so `teams` doesn't have to be the full set) in its
 * new top-to-bottom order. Reassigns only the sortOrder values that same set
 * of teams already held (highest first, matching sortByCustomOrder's
 * descending sort), so a team outside `orderedIds` — a different
 * regulation's teams, or the other Active/Archived tab — never has its own
 * sortOrder touched, regardless of what numeric range it happens to occupy.
 * Returns just the (id, updated Team) pairs that actually changed, ready to
 * persist and merge back into the full team list.
 */
export function reorderTeams(teams: Team[], orderedIds: string[]): Team[] {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const sortOrders = orderedIds
    .map((id) => byId.get(id)?.sortOrder)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => b - a);

  const now = new Date().toISOString();
  return orderedIds.flatMap((id, index) => {
    const team = byId.get(id);
    const sortOrder = sortOrders[index];
    if (!team || sortOrder === undefined || team.sortOrder === sortOrder) return [];
    return [{ ...team, sortOrder, updatedAt: now }];
  });
}

/** Returns an error message if the parsed roster isn't a valid VGC team, or null if it's fine. */
export function validateTeamSize(pokemon: ParsedPokemon[]): string | null {
  if (pokemon.length === 0) {
    return getMessages().errors.emptyTeamPaste;
  }
  if (pokemon.length > 6) {
    return getMessages().errors.tooManyPokemon(pokemon.length);
  }
  return null;
}
