import type { GroupPlanDoc, Opponent, PrepGroup, SharedOpponent } from "@/types";

/** The id of your plan doc for one group opponent. */
export function groupPlanId(groupId: string, opponentId: string): string {
  return `${groupId}_${opponentId}`;
}

/**
 * Splits an opponent into the part the whole group shares and your private
 * plan doc (lead/back picks, Megas, notes). See docs/prep-groups.md.
 */
export function splitGroupOpponent(
  opponent: Opponent,
  groupId: string,
): { shared: SharedOpponent; plan: GroupPlanDoc } {
  const { plansByTeamId, copiedPlanFrom, ...shared } = opponent;
  const plan: GroupPlanDoc = {
    id: groupPlanId(groupId, opponent.id),
    groupId,
    opponentId: opponent.id,
    plansByTeamId,
    updatedAt: opponent.updatedAt,
  };
  if (copiedPlanFrom && Object.keys(copiedPlanFrom).length > 0) plan.copiedPlanFrom = copiedPlanFrom;
  return { shared, plan };
}

/** The reverse: a shared opponent with your plans (if any) — the shape the planner works with. */
export function mergeGroupOpponent(shared: SharedOpponent, plan: GroupPlanDoc | undefined): Opponent {
  const merged: Opponent = { ...shared, plansByTeamId: plan?.plansByTeamId ?? {} };
  if (plan?.copiedPlanFrom) merged.copiedPlanFrom = plan.copiedPlanFrom;
  return merged;
}

/** Whether a split changed your plan doc — editing tags or the order shouldn't rewrite your plans. */
export function planChanged(before: Opponent | undefined, after: Opponent): boolean {
  if (!before) return Object.keys(after.plansByTeamId).length > 0 || !!after.copiedPlanFrom;
  return (
    JSON.stringify(before.plansByTeamId) !== JSON.stringify(after.plansByTeamId) ||
    JSON.stringify(before.copiedPlanFrom ?? null) !== JSON.stringify(after.copiedPlanFrom ?? null)
  );
}

/** Whether a shared field changed — editing your notes shouldn't rewrite the group's copy. */
export function sharedChanged(before: Opponent | undefined, after: Opponent, groupId: string): boolean {
  if (!before) return true;
  return (
    JSON.stringify(splitGroupOpponent({ ...before, updatedAt: "" }, groupId).shared) !==
    JSON.stringify(splitGroupOpponent({ ...after, updatedAt: "" }, groupId).shared)
  );
}

/** Who can remove an opponent from a group: whoever added it, and the group's owner. */
export function canRemoveGroupOpponent(
  opponent: Opponent,
  group: PrepGroup,
  uid: string | null | undefined,
): boolean {
  if (!uid) return false;
  return group.ownerUid === uid || opponent.addedBy === uid;
}

export function isGroupArchived(group: PrepGroup): boolean {
  return !!group.archivedAt;
}

/**
 * A copy of `opponent` for another list (your own, or a group): a new id,
 * at the top of the list, outside any variant group, with your plans.
 * `addedBy` is set for a group copy.
 */
export function copyOpponent(
  opponent: Opponent,
  newId: string,
  addedBy?: { uid: string; name?: string },
): Opponent {
  const now = new Date().toISOString();
  const copy: Opponent = { ...opponent, id: newId, sortOrder: Date.now(), createdAt: now, updatedAt: now };
  delete copy.variantOf;
  delete copy.copiedPlanFrom;
  delete copy.addedBy;
  delete copy.addedByName;
  if (addedBy) {
    copy.addedBy = addedBy.uid;
    if (addedBy.name) copy.addedByName = addedBy.name;
  }
  return copy;
}
