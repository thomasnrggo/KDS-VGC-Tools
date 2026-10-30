import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firestore";
import { generateId } from "@/lib/id";
import type { GroupInvite, GroupMember, GroupPlanDoc, PrepGroup, SharedOpponent } from "@/types";

/**
 * Prep groups in Firestore — see docs/prep-groups.md for the model and
 * firestore.rules for who may do what. Unlike personal data (IndexedDB
 * first, cloud sync on top), group data is online-only and read through
 * live listeners, so teammates' changes show up as they happen.
 */
const GROUPS = "groups";
const INVITES = "groupInvites";

function groupRef(groupId: string) {
  return doc(db, GROUPS, groupId);
}

function opponentsRef(groupId: string) {
  return collection(db, GROUPS, groupId, "opponents");
}

function plansRef(uid: string) {
  return collection(db, "users", uid, "groupPlans");
}

/** A long random code — the invite link's secret. */
function newInviteCode(): string {
  return generateId().replace(/-/g, "");
}

export async function createGroup(
  name: string,
  regulationId: string,
  owner: { uid: string } & GroupMember,
): Promise<PrepGroup> {
  const now = new Date().toISOString();
  const member: GroupMember = { name: owner.name };
  if (owner.photoURL) member.photoURL = owner.photoURL;
  const group: PrepGroup = {
    id: generateId(),
    name,
    regulationId,
    ownerUid: owner.uid,
    memberUids: [owner.uid],
    members: { [owner.uid]: member },
    inviteCode: newInviteCode(),
    createdAt: now,
    updatedAt: now,
  };
  // The group first: the invite's rule checks that its creator owns the group.
  await setDoc(groupRef(group.id), group);
  await setDoc(doc(db, INVITES, group.inviteCode), {
    groupId: group.id,
    groupName: name,
  } satisfies GroupInvite);
  return group;
}

export async function renameGroup(group: PrepGroup, name: string): Promise<void> {
  await updateDoc(groupRef(group.id), { name, updatedAt: new Date().toISOString() });
  await setDoc(doc(db, INVITES, group.inviteCode), {
    groupId: group.id,
    groupName: name,
  } satisfies GroupInvite);
}

export async function setGroupArchived(groupId: string, archived: boolean): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(groupRef(groupId), {
    archivedAt: archived ? now : deleteField(),
    updatedAt: now,
  });
}

/** A new invite link; the old one stops working. Returns the new code. */
export async function resetInviteCode(group: PrepGroup): Promise<string> {
  const code = newInviteCode();
  await setDoc(doc(db, INVITES, code), {
    groupId: group.id,
    groupName: group.name,
  } satisfies GroupInvite);
  await updateDoc(groupRef(group.id), { inviteCode: code, updatedAt: new Date().toISOString() });
  await deleteDoc(doc(db, INVITES, group.inviteCode)).catch(() => {});
  return code;
}

export async function getInvite(code: string): Promise<GroupInvite | null> {
  const snap = await getDoc(doc(db, INVITES, code));
  return snap.exists() ? (snap.data() as GroupInvite) : null;
}

/** Adds you to the group the invite points at — the rules check the code matches an invite for it. */
export async function joinGroup(
  code: string,
  invite: GroupInvite,
  member: { uid: string } & GroupMember,
): Promise<void> {
  const entry: GroupMember = { name: member.name };
  if (member.photoURL) entry.photoURL = member.photoURL;
  await updateDoc(groupRef(invite.groupId), {
    memberUids: arrayUnion(member.uid),
    [`members.${member.uid}`]: entry,
    joinCode: code,
    updatedAt: new Date().toISOString(),
  });
}

/** Removes a member — yourself (leaving), or anyone if you're the owner. */
export async function removeGroupMember(groupId: string, uid: string): Promise<void> {
  await updateDoc(groupRef(groupId), {
    memberUids: arrayRemove(uid),
    [`members.${uid}`]: deleteField(),
    updatedAt: new Date().toISOString(),
  });
}

/** Live list of the groups you're a member of. */
export function subscribeMyGroups(
  uid: string,
  onChange: (groups: PrepGroup[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, GROUPS), where("memberUids", "array-contains", uid)),
    (snap) => onChange(snap.docs.map((d) => d.data() as PrepGroup)),
    onError,
  );
}

export function subscribeGroupOpponents(
  groupId: string,
  onChange: (opponents: SharedOpponent[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    opponentsRef(groupId),
    (snap) => onChange(snap.docs.map((d) => d.data() as SharedOpponent)),
    onError,
  );
}

/** Live list of your private plans for one group's opponents. */
export function subscribeGroupPlans(
  uid: string,
  groupId: string,
  onChange: (plans: GroupPlanDoc[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(plansRef(uid), where("groupId", "==", groupId)),
    (snap) => onChange(snap.docs.map((d) => d.data() as GroupPlanDoc)),
    onError,
  );
}

export async function saveGroupOpponent(groupId: string, opponent: SharedOpponent): Promise<void> {
  await setDoc(doc(opponentsRef(groupId), opponent.id), opponent);
}

export async function deleteGroupOpponent(groupId: string, opponentId: string): Promise<void> {
  await deleteDoc(doc(opponentsRef(groupId), opponentId));
}

/** Every one of your private group plans, across all groups — see removePokemonEverywhere. */
export async function getMyGroupPlans(uid: string): Promise<GroupPlanDoc[]> {
  const snap = await getDocs(plansRef(uid));
  return snap.docs.map((d) => d.data() as GroupPlanDoc);
}

export async function saveGroupPlan(uid: string, plan: GroupPlanDoc): Promise<void> {
  await setDoc(doc(plansRef(uid), plan.id), plan);
}

export async function deleteGroupPlan(uid: string, planId: string): Promise<void> {
  await deleteDoc(doc(plansRef(uid), planId));
}
