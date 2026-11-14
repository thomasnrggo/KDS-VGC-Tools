import { remapMatchupPlan, type SlotMap } from "./rosterSlots";
import { sameValue } from "./sameValue";
import type {
  CollabCalcDoc,
  CollabCombinationDoc,
  CollabTeamDoc,
  EditedBy,
  SharedPlanDoc,
  Team,
} from "@/types";

/**
 * Collaborative teams (docs/collaborative-teams.md) as the rest of the app
 * sees them: a `Team` like any other, with `collab` set. These are the pure
 * conversions between that and the Firestore docs (`teams/{id}` plus its
 * `combinations` and `calcs` subcollections), and the diff that turns an
 * edit into the fewest writes — so members editing different parts never
 * overwrite each other.
 */

/** The Team fields that only matter to one member, never written to the shared doc. */
const PER_MEMBER_FIELDS = [
  "combinations",
  "calcs",
  "share",
  "sortOrder",
  "archivedAt",
  "collab",
  "updatedAt",
] as const;

type SharedField = Exclude<keyof Team, (typeof PER_MEMBER_FIELDS)[number]>;

function bySortOrder<T extends { sortOrder: number }>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder;
}

function withoutSortOrder<T extends { sortOrder: number }>(doc: T): Omit<T, "sortOrder"> {
  const rest: Partial<T> = { ...doc };
  delete rest.sortOrder;
  return rest as Omit<T, "sortOrder">;
}

/** A collaborative team's docs as a Team. It sorts in your list by when it became collaborative. */
export function collabDocToTeam(
  doc: CollabTeamDoc,
  combinations: CollabCombinationDoc[],
  calcs: CollabCalcDoc[],
): Team {
  const team: Team &
    Partial<Pick<CollabTeamDoc, "groupId" | "ownerUid" | "createdAt" | "updatedBy">> = {
    ...doc,
    combinations: [...combinations].sort(bySortOrder).map(withoutSortOrder),
    calcs: [...calcs].sort(bySortOrder).map(withoutSortOrder),
    sortOrder: new Date(doc.createdAt).getTime() || 0,
    collab: {
      groupId: doc.groupId,
      ownerUid: doc.ownerUid,
      ...(doc.updatedBy && { updatedBy: doc.updatedBy }),
    },
  };
  delete team.groupId;
  delete team.ownerUid;
  delete team.createdAt;
  delete team.updatedBy;
  return team;
}

/** The `teams/{id}` doc for a team becoming collaborative (its combinations and calcs go in their own docs). */
export function teamToCollabDoc(
  team: Team,
  { groupId, ownerUid, by, now }: { groupId: string; ownerUid: string; by: EditedBy; now: string },
): CollabTeamDoc {
  const shared: Partial<Team> = { ...team };
  for (const field of PER_MEMBER_FIELDS) delete shared[field];
  return {
    ...(shared as Omit<Team, (typeof PER_MEMBER_FIELDS)[number]>),
    groupId,
    ownerUid,
    createdAt: now,
    updatedAt: now,
    updatedBy: by,
  };
}

/** The combinations and calcs of a team as subcollection docs, numbered in list order. */
export function collabSubDocs(team: Team): {
  combinations: CollabCombinationDoc[];
  calcs: CollabCalcDoc[];
} {
  return {
    combinations: (team.combinations ?? []).map((c, sortOrder) => ({ ...c, sortOrder })),
    calcs: (team.calcs ?? []).map((c, sortOrder) => ({ ...c, sortOrder })),
  };
}

export interface ListChanges<T> {
  /** New or changed docs (content or position). */
  put: T[];
  /** Ids no longer in the list. */
  remove: string[];
}

export interface CollabTeamChanges {
  /** Changed top-level fields; `undefined` means the field was cleared (deleteField). */
  fields: Partial<Record<SharedField, unknown>>;
  combinations: ListChanges<CollabCombinationDoc>;
  calcs: ListChanges<CollabCalcDoc>;
}

// Key order doesn't count: Firestore returns objects with its own (see sameValue).
const same = sameValue;

function listChanges<T extends { id: string; sortOrder: number }>(
  before: T[],
  after: T[],
): ListChanges<T> {
  const beforeById = new Map(before.map((doc) => [doc.id, doc]));
  const afterIds = new Set(after.map((doc) => doc.id));
  return {
    put: after.filter((doc) => !same(beforeById.get(doc.id), doc)),
    remove: before.filter((doc) => !afterIds.has(doc.id)).map((doc) => doc.id),
  };
}

/**
 * What an edit of a collaborative team changes, field by field and doc by
 * doc — what writeCollabTeamChanges sends. Per-member fields (list order,
 * archived, sharing) are ignored.
 */
export function diffCollabTeam(before: Team, after: Team): CollabTeamChanges {
  const fields: CollabTeamChanges["fields"] = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof Team>;
  for (const key of keys) {
    if ((PER_MEMBER_FIELDS as readonly string[]).includes(key)) continue;
    if (!same(before[key], after[key])) fields[key as SharedField] = after[key];
  }
  const beforeDocs = collabSubDocs(before);
  const afterDocs = collabSubDocs(after);
  return {
    fields,
    combinations: listChanges(beforeDocs.combinations, afterDocs.combinations),
    calcs: listChanges(beforeDocs.calcs, afterDocs.calcs),
  };
}

/** Whether an edit changes anything shared (nothing to write otherwise). */
export function hasCollabChanges(changes: CollabTeamChanges): boolean {
  return (
    Object.keys(changes.fields).length > 0 ||
    changes.combinations.put.length + changes.combinations.remove.length > 0 ||
    changes.calcs.put.length + changes.calcs.remove.length > 0
  );
}

/**
 * A collaborative team's shared plans after its roster changed (a Pokémon
 * removed or moved) — each remapped to keep pointing at the same Pokémon
 * (see SlotMap). Only the ones that change are returned.
 */
export function sharedPlansRemapped(
  plans: SharedPlanDoc[],
  map: SlotMap,
  by: EditedBy | undefined,
  now: string,
): SharedPlanDoc[] {
  return plans.flatMap((doc) => {
    const plan = remapMatchupPlan(doc.plan, map);
    return same(plan, doc.plan) ? [] : [{ ...doc, plan, updatedBy: by, updatedAt: now }];
  });
}
