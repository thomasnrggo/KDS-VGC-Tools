import {
  getOpponents,
  getTournaments,
  saveOpponent,
  saveTournament,
  syncOpponentsWithCloud,
  syncTournamentsWithCloud,
} from "./storage/db";
import { getMyGroupPlans, saveGroupPlan } from "./firebase/groups";
import { matchupPlanWithoutSlot, tournamentWithoutSlot } from "./rosterSlots";
import type { MatchupPlan } from "@/types";

function plansWithoutSlot(
  plansByTeamId: Record<string, MatchupPlan>,
  teamId: string,
  removed: number,
): Record<string, MatchupPlan> | null {
  const plan = plansByTeamId[teamId];
  if (!plan) return null;
  return { ...plansByTeamId, [teamId]: matchupPlanWithoutSlot(plan, removed) };
}

/**
 * The rest of a Pokémon's removal from a team (the team's own record is
 * updated by the caller — see teamWithoutSlot): this team's plans against
 * your opponents and prep groups' opponents, and the games logged with it,
 * shifted so they keep pointing at the same Pokémon. Signed in, the cloud
 * copies are pulled first, so a newer edit from another device isn't
 * overwritten with this device's older copy.
 */
export async function removePokemonEverywhere(
  teamId: string,
  removed: number,
  uid: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const [opponents, tournaments] = await Promise.all([
    uid ? syncOpponentsWithCloud(uid) : getOpponents(),
    uid ? syncTournamentsWithCloud(uid) : getTournaments(),
  ]);

  const saves: Promise<void>[] = [];
  for (const opponent of opponents) {
    const plansByTeamId = plansWithoutSlot(opponent.plansByTeamId, teamId, removed);
    if (plansByTeamId) saves.push(saveOpponent({ ...opponent, plansByTeamId, updatedAt: now }));
  }
  for (const tournament of tournaments) {
    if (tournament.teamId !== teamId) continue;
    saves.push(
      saveTournament({ ...tournamentWithoutSlot(tournament, teamId, removed), updatedAt: now }),
    );
  }
  if (uid) {
    for (const plan of await getMyGroupPlans(uid)) {
      const plansByTeamId = plansWithoutSlot(plan.plansByTeamId, teamId, removed);
      if (plansByTeamId) saves.push(saveGroupPlan(uid, { ...plan, plansByTeamId, updatedAt: now }));
    }
  }
  await Promise.all(saves);
}
