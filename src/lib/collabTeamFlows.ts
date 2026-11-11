import {
  createCollabTeam,
  createGroup,
  deleteCollabTeam,
  getGroupOpponents,
  getSharedPlans,
  logTeamActivity,
  removeGroupMember,
  saveGroupOpponent,
  saveSharedPlans,
  setGroupArchived,
} from "@/lib/firebase";
import { teamToCollabDoc } from "./collabTeam";
import {
  copyOpponentsInto,
  mergeGroupOpponent,
  splitGroupOpponent,
  toSharedPlanDoc,
  withSharedPlan,
  withoutSharedPlan,
} from "./groupOpponents";
import { hasMatchupPrep } from "./matchupPlans";
import { getPlanForTeam, normalizeOpponent } from "./opponent";
import { generateId } from "./id";
import type { EditedBy, GroupMember, Opponent, PrepGroup, Team } from "@/types";

/**
 * The steps of a collaborative team's life that touch Firestore (see
 * docs/collaborative-teams.md): making one, and bringing it back home (keep
 * a copy, stop collaborating). Personal storage is the caller's (useMyTeams).
 */

/**
 * Makes `team` collaborative: its own prep group (you as owner, invite link
 * included), then `teams/{id}` with its combinations and calcs, then —
 * optionally — your prepped matchups for it (`matchups`, from your own list)
 * copied into the group with their plans as the shared ones. Returns the
 * group. The caller then drops the personal copy.
 */
export async function makeTeamCollaborative({
  team,
  owner,
  matchups,
}: {
  team: Team;
  owner: { uid: string } & GroupMember;
  matchups: Opponent[];
}): Promise<PrepGroup> {
  const now = new Date().toISOString();
  const by: EditedBy = { uid: owner.uid, name: owner.name };
  // A prep group has one regulation: the team's first.
  const regulationId = team.regulationIds[0];
  const group = await createGroup(team.name, regulationId, owner, team.id);
  await createCollabTeam(
    teamToCollabDoc(
      { ...team, regulationIds: [regulationId] },
      { groupId: group.id, ownerUid: owner.uid, by, now },
    ),
    team,
  );

  const inRegulation = matchups.filter((opponent) => opponent.regulationId === regulationId);
  const copies = copyOpponentsInto(inRegulation, [], generateId, {
    uid: owner.uid,
    name: owner.name,
  });
  await Promise.all(
    copies.map((copy) =>
      saveGroupOpponent(
        group.id,
        splitGroupOpponent(withoutSharedPlan(copy, team.id), group.id).shared,
      ),
    ),
  );
  await saveSharedPlans(
    group.id,
    copies.map((copy) => toSharedPlanDoc(copy.id, getPlanForTeam(copy, team.id), by, now)),
  );
  await logTeamActivity(team.id, { change: { kind: "created" } }, by);
  return group;
}

/** Leaves a collaborative team (an editor), saying so in its activity first — after, you can't write there. */
export async function leaveCollabTeam(
  teamId: string,
  groupId: string,
  me: EditedBy,
): Promise<void> {
  await logTeamActivity(teamId, { change: { kind: "left" } }, me);
  await removeGroupMember(groupId, me.uid);
}

/** Removes a member from a collaborative team (its owner), logged in its activity. */
export async function removeCollabMember(
  teamId: string,
  groupId: string,
  member: { uid: string; name: string },
  owner: EditedBy,
): Promise<void> {
  await removeGroupMember(groupId, member.uid);
  await logTeamActivity(
    teamId,
    { change: { kind: "removedMember", memberName: member.name } },
    owner,
  );
}

/**
 * A collaborative team's prepped matchups, each with only the team's shared
 * plan — what "Keep a copy" and "Stop collaborating" bring into your own
 * opponents (see importSharedMatchups).
 */
export async function collabTeamMatchups(groupId: string, teamId: string): Promise<Opponent[]> {
  const [opponents, plans] = await Promise.all([
    getGroupOpponents(groupId),
    getSharedPlans(groupId),
  ]);
  const planFor = new Map(plans.map((plan) => [plan.opponentId, plan]));
  return opponents
    .map((shared) => {
      const opponent = withSharedPlan(
        mergeGroupOpponent(shared, undefined),
        teamId,
        planFor.get(shared.id),
      );
      return normalizeOpponent({
        ...opponent,
        plansByTeamId: opponent.plansByTeamId[teamId]
          ? { [teamId]: opponent.plansByTeamId[teamId] }
          : {},
      });
    })
    .filter((opponent) => hasMatchupPrep(getPlanForTeam(opponent, teamId)));
}

/**
 * Ends a collaborative team (its owner only): deletes `teams/{id}` and
 * archives its group, so it leaves every member's list. Read what you want
 * to keep (collabTeamMatchups) first.
 */
export async function endCollabTeam(teamId: string, groupId: string): Promise<void> {
  await deleteCollabTeam(teamId);
  await setGroupArchived(groupId, true);
}
