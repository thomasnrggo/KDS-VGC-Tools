import { createTeam } from "./team";
import { EMPTY_PLAN } from "@/constants";
import { REGULATIONS } from "@/data/regulations";
import type { MatchupPlan, Opponent, PokemonSlot } from "@/types";

export function createOpponent(
  label: string,
  rawPaste: string,
  regulationId: string,
  pokepasteUrl?: string,
): Opponent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    label,
    team: createTeam(rawPaste, label, regulationId),
    pokepasteUrl,
    regulationId,
    plansByTeamId: {},
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
  const withPlans = opponent.plansByTeamId ? opponent : migrateLegacyPlan(opponent, legacyTeamId);
  return withPlans.regulationId
    ? withPlans
    : { ...withPlans, regulationId: REGULATIONS[0].id };
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
    createdAt: opponent.createdAt,
    updatedAt: opponent.updatedAt,
  };
}
