import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firestore";
import { collabDocToTeam, collabSubDocs, type CollabTeamChanges } from "@/lib/collabTeam";
import { activityFromTeamChanges } from "@/lib/teamActivity";
import { addActivityToBatch, deleteTeamActivity } from "./teamActivity";
import type {
  CollabCalcDoc,
  CollabCombinationDoc,
  CollabTeamDoc,
  EditedBy,
  SharedPlanDoc,
  Team,
} from "@/types";

/**
 * Collaborative teams in Firestore (docs/collaborative-teams.md):
 * `teams/{teamId}` with its `combinations` and `calcs` subcollections, and
 * the shared plans of its group, `groups/{groupId}/plans/{opponentId}`.
 * Online-only and read through live listeners, like prep groups; members of
 * the team's group read and write them (firestore.rules).
 */
const TEAMS = "teams";

function teamRef(teamId: string) {
  return doc(db, TEAMS, teamId);
}

function combinationsRef(teamId: string) {
  return collection(db, TEAMS, teamId, "combinations");
}

function calcsRef(teamId: string) {
  return collection(db, TEAMS, teamId, "calcs");
}

function sharedPlansRef(groupId: string) {
  return collection(db, "groups", groupId, "plans");
}

/**
 * Live view of one collaborative team, as a Team (see collabDocToTeam) —
 * reported once its doc and both subcollections have answered, then on
 * every change. Null when the doc doesn't exist (any more).
 */
export function subscribeCollabTeam(
  teamId: string,
  onChange: (team: Team | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let teamDoc: CollabTeamDoc | null | undefined;
  let combinations: CollabCombinationDoc[] | undefined;
  let calcs: CollabCalcDoc[] | undefined;

  function publish() {
    if (teamDoc === undefined || !combinations || !calcs) return;
    onChange(teamDoc ? collabDocToTeam(teamDoc, combinations, calcs) : null);
  }

  const stops = [
    onSnapshot(
      teamRef(teamId),
      (snap) => {
        teamDoc = snap.exists() ? (snap.data() as CollabTeamDoc) : null;
        publish();
      },
      onError,
    ),
    onSnapshot(
      combinationsRef(teamId),
      (snap) => {
        combinations = snap.docs.map((d) => d.data() as CollabCombinationDoc);
        publish();
      },
      onError,
    ),
    onSnapshot(
      calcsRef(teamId),
      (snap) => {
        calcs = snap.docs.map((d) => d.data() as CollabCalcDoc);
        publish();
      },
      onError,
    ),
  ];
  return () => stops.forEach((stop) => stop());
}

/**
 * Writes one edit of a collaborative team (see diffCollabTeam) in a single
 * batch: only the changed fields of its doc (a cleared one is deleted), and
 * only the combination and calc docs that changed — so a teammate's edit to
 * another part is never overwritten. Its activity entries go in the same
 * batch (`before` is the team the edit started from).
 */
export async function writeCollabTeamChanges(
  teamId: string,
  before: Team,
  changes: CollabTeamChanges,
  by: EditedBy,
  updatedAt: string,
): Promise<void> {
  const batch = writeBatch(db);
  addActivityToBatch(batch, teamId, activityFromTeamChanges(before, changes), by, updatedAt);
  const fields: Record<string, unknown> = { updatedAt, updatedBy: by };
  for (const [key, value] of Object.entries(changes.fields)) {
    fields[key] = value === undefined ? deleteField() : value;
  }
  batch.update(teamRef(teamId), fields);
  for (const combination of changes.combinations.put) {
    batch.set(doc(combinationsRef(teamId), combination.id), combination);
  }
  for (const id of changes.combinations.remove) batch.delete(doc(combinationsRef(teamId), id));
  for (const calc of changes.calcs.put) batch.set(doc(calcsRef(teamId), calc.id), calc);
  for (const id of changes.calcs.remove) batch.delete(doc(calcsRef(teamId), id));
  await batch.commit();
}

/** Every shared plan of a collaborative team's group. */
export async function getSharedPlans(groupId: string): Promise<SharedPlanDoc[]> {
  const snap = await getDocs(sharedPlansRef(groupId));
  return snap.docs.map((d) => d.data() as SharedPlanDoc);
}

/** Saves several shared plans at once (e.g. all of them shifted after a roster change). */
export async function saveSharedPlans(groupId: string, plans: SharedPlanDoc[]): Promise<void> {
  if (plans.length === 0) return;
  const batch = writeBatch(db);
  for (const plan of plans) batch.set(doc(sharedPlansRef(groupId), plan.opponentId), plan);
  await batch.commit();
}

/** Live list of a collaborative team's shared plans (its group's `plans`). */
export function subscribeSharedPlans(
  groupId: string,
  onChange: (plans: SharedPlanDoc[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    sharedPlansRef(groupId),
    (snap) => onChange(snap.docs.map((d) => d.data() as SharedPlanDoc)),
    onError,
  );
}

export async function saveSharedPlan(groupId: string, plan: SharedPlanDoc): Promise<void> {
  await setDoc(doc(sharedPlansRef(groupId), plan.opponentId), plan);
}

export async function deleteSharedPlan(groupId: string, opponentId: string): Promise<void> {
  await deleteDoc(doc(sharedPlansRef(groupId), opponentId));
}

/**
 * Creates a collaborative team's docs: `teams/{id}` (its group must already
 * name it — see firestore.rules), then its combinations and calcs.
 */
export async function createCollabTeam(teamDoc: CollabTeamDoc, team: Team): Promise<void> {
  await setDoc(teamRef(teamDoc.id), teamDoc);
  const { combinations, calcs } = collabSubDocs(team);
  if (combinations.length + calcs.length === 0) return;
  const batch = writeBatch(db);
  for (const combination of combinations) {
    batch.set(doc(combinationsRef(teamDoc.id), combination.id), combination);
  }
  for (const calc of calcs) batch.set(doc(calcsRef(teamDoc.id), calc.id), calc);
  await batch.commit();
}

/** Deletes a collaborative team's docs (its combinations, calcs and activity first — the rules read the team doc). */
export async function deleteCollabTeam(teamId: string): Promise<void> {
  await deleteTeamActivity(teamId);
  const [combinations, calcs] = await Promise.all([
    getDocs(combinationsRef(teamId)),
    getDocs(calcsRef(teamId)),
  ]);
  const batch = writeBatch(db);
  for (const snap of [...combinations.docs, ...calcs.docs]) batch.delete(snap.ref);
  await batch.commit();
  await deleteDoc(teamRef(teamId));
}
