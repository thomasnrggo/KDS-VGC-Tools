"use client";

import { useEffect, useState } from "react";
import {
  createGroup as createGroupDoc,
  removeGroupMember,
  renameGroup as renameGroupDoc,
  resetInviteCode,
  setGroupArchived,
  subscribeMyGroups,
} from "@/lib/firebase";
import { useAuth } from "./useAuth";
import type { PrepGroup } from "@/types";

/** Last known groups per user, kept across page navigations (see useOpponents' cache). */
let cached: { uid: string; groups: PrepGroup[] } | null = null;

function sortGroups(groups: PrepGroup[]): PrepGroup[] {
  // Newest first — the event you're prepping for now is usually the latest one.
  return [...groups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The prep groups you're a member of, live from Firestore, and what you can
 * do with them (see docs/prep-groups.md). Signed out, there are none — groups
 * need an account.
 */
export function useGroups() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<{ uid: string; groups: PrepGroup[] } | null>(() =>
    cached && cached.uid === uid ? cached : null,
  );

  useEffect(() => {
    if (!uid) return;
    return subscribeMyGroups(
      uid,
      (groups) => {
        cached = { uid, groups: sortGroups(groups) };
        setState(cached);
      },
      (error) => console.error("[prep group] groups listener failed:", error),
    );
  }, [uid]);

  const groups = state && state.uid === uid ? state.groups : [];
  const isLoading = !!uid && (!state || state.uid !== uid);

  async function createGroup(name: string, regulationId: string): Promise<PrepGroup | null> {
    if (!user) return null;
    return createGroupDoc(name.trim(), regulationId, {
      uid: user.uid,
      name: user.displayName ?? user.email ?? "?",
      photoURL: user.photoURL ?? undefined,
    });
  }

  // A collaborative team's group (PrepGroup.teamId) is that team's matchup
  // list, managed from the team's page — never offered as a prep group.
  const prepGroups = groups.filter((group) => !group.teamId);

  return {
    /** Every group you're in, collaborative teams' included — for looking one up by id. */
    groups,
    /** Prep groups only (not a collaborative team's): the planner's lists, copy targets… */
    prepGroups,
    activeGroups: prepGroups.filter((group) => !group.archivedAt),
    archivedGroups: prepGroups.filter((group) => !!group.archivedAt),
    /** Your collaborative teams' groups (still going — a stopped one is archived). */
    teamGroups: groups.filter((group) => !!group.teamId && !group.archivedAt),
    isLoading,
    uid,
    createGroup,
    renameGroup: (group: PrepGroup, name: string) => renameGroupDoc(group, name.trim()),
    setArchived: (group: PrepGroup, archived: boolean) => setGroupArchived(group.id, archived),
    resetInvite: (group: PrepGroup) => resetInviteCode(group),
    removeMember: (group: PrepGroup, memberUid: string) => removeGroupMember(group.id, memberUid),
    leaveGroup: (group: PrepGroup) => (uid ? removeGroupMember(group.id, uid) : Promise.resolve()),
  };
}
