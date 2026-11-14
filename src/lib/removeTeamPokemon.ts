import {
  getOpponents,
  getTournaments,
  saveOpponent,
  saveTournament,
  syncOpponentsWithCloud,
  syncTournamentsWithCloud,
} from "./storage/db";
import { getMyGroupPlans, saveGroupPlan } from "./firebase/groups";
import { getSharedPlans, saveSharedPlans } from "./firebase/collabTeams";
import {
  moveMap,
  remapMatchupPlan,
  remapTournament,
  removalMap,
  type SlotMap,
} from "./rosterSlots";
import { sharedPlansRemapped } from "./collabTeam";
import type { EditedBy, MatchupPlan, TeamCollab } from "@/types";

function remapPlans(
  plansByTeamId: Record<string, MatchupPlan>,
  teamId: string,
  map: SlotMap,
): Record<string, MatchupPlan> | null {
  const plan = plansByTeamId[teamId];
  if (!plan) return null;
  return { ...plansByTeamId, [teamId]: remapMatchupPlan(plan, map) };
}

type Collab = { team: TeamCollab; by: EditedBy };

// One remap at a time: each reads what the last one saved (moving a Pokémon
// twice in a row must not remap the same old copy twice).
let queue: Promise<void> = Promise.resolve();

/**
 * The rest of a Pokémon's removal from a team (the team's own record is
 * updated by the caller — see teamWithoutSlot). See remapPokemonEverywhere.
 */
export function removePokemonEverywhere(
  teamId: string,
  removed: number,
  uid: string | null,
  collab?: Collab,
): Promise<void> {
  return remapPokemonEverywhere(teamId, removalMap(removed), uid, collab);
}

/** The rest of moving a Pokémon to another place in a team (see teamWithPokemonMoved). */
export function movePokemonEverywhere(
  teamId: string,
  from: number,
  to: number,
  uid: string | null,
  collab?: Collab,
): Promise<void> {
  return remapPokemonEverywhere(teamId, moveMap(from, to), uid, collab);
}

function remapPokemonEverywhere(
  teamId: string,
  map: SlotMap,
  uid: string | null,
  collab?: Collab,
): Promise<void> {
  const run = queue.then(() => remapNow(teamId, map, uid, collab));
  queue = run.catch(() => {});
  return run;
}

/**
 * After a team's roster changed (a Pokémon removed or moved — the team's own
 * record is updated by the caller): this team's plans against
 * your opponents and prep groups' opponents, and the games logged with it,
 * remapped so they keep pointing at the same Pokémon. Signed in, the cloud
 * copies are pulled first, so a newer edit from another device isn't
 * overwritten with this device's older copy. On a collaborative team
 * (`collab`), its group's shared plans are remapped too, in one batch
 * (docs/collaborative-teams.md).
 */
async function remapNow(
  teamId: string,
  map: SlotMap,
  uid: string | null,
  collab?: Collab,
): Promise<void> {
  const now = new Date().toISOString();
  const [opponents, tournaments] = await Promise.all([
    uid ? syncOpponentsWithCloud(uid) : getOpponents(),
    uid ? syncTournamentsWithCloud(uid) : getTournaments(),
  ]);

  const saves: Promise<void>[] = [];
  for (const opponent of opponents) {
    const plansByTeamId = remapPlans(opponent.plansByTeamId, teamId, map);
    if (plansByTeamId) saves.push(saveOpponent({ ...opponent, plansByTeamId, updatedAt: now }));
  }
  for (const tournament of tournaments) {
    if (tournament.teamId !== teamId) continue;
    saves.push(saveTournament({ ...remapTournament(tournament, teamId, map), updatedAt: now }));
  }
  if (uid) {
    for (const plan of await getMyGroupPlans(uid)) {
      const plansByTeamId = remapPlans(plan.plansByTeamId, teamId, map);
      if (plansByTeamId) saves.push(saveGroupPlan(uid, { ...plan, plansByTeamId, updatedAt: now }));
    }
  }
  if (uid && collab) {
    const { groupId } = collab.team;
    const shifted = sharedPlansRemapped(await getSharedPlans(groupId), map, collab.by, now);
    saves.push(saveSharedPlans(groupId, shifted));
  }
  await Promise.all(saves);
}
