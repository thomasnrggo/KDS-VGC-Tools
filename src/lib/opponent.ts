import { createTeam } from "./team";
import { EMPTY_PLAN } from "@/constants";
import type { MatchupPlan, Opponent, PokemonSlot } from "@/types";

export function createOpponent(label: string, rawPaste: string, pokepasteUrl?: string): Opponent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    label,
    team: createTeam(rawPaste, label),
    pokepasteUrl,
    plansByTeamId: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Returns the matchup plan for `teamId`, or an empty one if none has been made yet. */
export function getPlanForTeam(opponent: Opponent, teamId: string | null): MatchupPlan {
  if (!teamId) return EMPTY_PLAN;
  return opponent.plansByTeamId[teamId] ?? EMPTY_PLAN;
}

/**
 * Backfills fields for opponents saved by an older version of the schema. Storage should
 * always read through this rather than trusting IndexedDB's stored shape.
 *
 * - Pre-plansByTeamId records (`leadPair`/`backPair`/`notes` lived directly on Opponent) are
 *   migrated into `plansByTeamId[legacyTeamId]`, so the single team that existed at the time
 *   keeps its picks. `legacyTeamId` is the id of whatever "My Team" the DB migration resolved
 *   (see storage/db.ts) — falls back to a fixed key if that's unavailable.
 */
export function normalizeOpponent(opponent: Opponent, legacyTeamId?: string | null): Opponent {
  if (opponent.plansByTeamId) {
    return opponent;
  }

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
      notes: legacy.notes ?? "",
    };
  }

  return {
    id: opponent.id,
    label: opponent.label,
    team: opponent.team,
    pokepasteUrl: opponent.pokepasteUrl,
    plansByTeamId,
    createdAt: opponent.createdAt,
    updatedAt: opponent.updatedAt,
  };
}
