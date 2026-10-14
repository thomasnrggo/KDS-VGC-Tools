import type { MatchupPlan, Opponent } from "./opponent";

/** A member as shown in a prep group (name and avatar from their Google account when they joined). */
export interface GroupMember {
  name: string;
  photoURL?: string;
}

/**
 * A prep group: a shared opponent list several players build together for
 * an event, each keeping their own picks and notes private. Stored at
 * `groups/{id}` in Firestore. See docs/prep-groups.md.
 */
export interface PrepGroup {
  id: string;
  name: string;
  /** The event's regulation — the group's opponents all belong to it. */
  regulationId: string;
  ownerUid: string;
  /** Member uids, the owner included — what the security rules and "my groups" query check. */
  memberUids: string[];
  members: Record<string, GroupMember>;
  /** The current invite link's code (see GroupInvite); resetting the link replaces it. */
  inviteCode: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** `groupInvites/{code}` — knowing the code (from the invite link) is what lets someone join. */
export interface GroupInvite {
  groupId: string;
  groupName: string;
}

/** A group opponent as stored in the group: everything but your private plan fields. */
export type SharedOpponent = Omit<Opponent, "plansByTeamId" | "copiedPlanFrom">;

/** `users/{uid}/groupPlans/{groupId}_{opponentId}` — your private plans for one group opponent. */
export interface GroupPlanDoc {
  id: string;
  groupId: string;
  opponentId: string;
  plansByTeamId: Record<string, MatchupPlan>;
  copiedPlanFrom?: Record<string, string>;
  updatedAt: string;
}
