import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firestore";
import { generateId } from "@/lib/id";
import {
  continuesActivity,
  mergeActivity,
  newActivity,
  type ActivityDraft,
} from "@/lib/teamActivity";
import type { EditedBy, TeamActivity } from "@/types";

/**
 * A collaborative team's activity log, `teams/{teamId}/activity`
 * (docs/collaborative-teams.md, src/lib/teamActivity.ts). Entries are
 * written with the edits they describe; your own recent entries are
 * remembered here so a continued edit extends one instead of adding another.
 */

/** How many entries the panel shows (the newest). */
export const ACTIVITY_SHOWN = 100;

function activityRef(teamId: string) {
  return collection(db, "teams", teamId, "activity");
}

// Your latest entries this session, per team — what a new edit may continue.
const recentByTeam = new Map<string, TeamActivity[]>();

/** The entries to write for `drafts`: each a new entry, or one of your recent ones extended. */
function entriesFor(
  teamId: string,
  drafts: ActivityDraft[],
  by: EditedBy,
  now: string,
): TeamActivity[] {
  const recent = recentByTeam.get(teamId) ?? [];
  const entries = drafts.map((draft) => {
    const index = recent.findIndex((entry) => continuesActivity(entry, draft, by.uid, now));
    const entry =
      index >= 0
        ? mergeActivity(recent[index], draft, now)
        : newActivity(generateId(), draft, by, now);
    if (index >= 0) recent.splice(index, 1);
    recent.unshift(entry);
    return entry;
  });
  recentByTeam.set(teamId, recent.slice(0, 10));
  return entries;
}

/** Adds the entries for `drafts` to a batch (an edit's own, see writeCollabTeamChanges). */
export function addActivityToBatch(
  batch: WriteBatch,
  teamId: string,
  drafts: ActivityDraft[],
  by: EditedBy,
  now: string,
): void {
  for (const entry of entriesFor(teamId, drafts, by, now)) {
    batch.set(doc(activityRef(teamId), entry.id), entry);
  }
}

/** Logs activity on its own (a plan edit, someone joining or leaving). */
export async function logTeamActivity(
  teamId: string,
  draft: ActivityDraft,
  by: EditedBy,
): Promise<void> {
  const batch = writeBatch(db);
  addActivityToBatch(batch, teamId, [draft], by, new Date().toISOString());
  await batch.commit();
}

/** Live list of a team's newest activity, newest first. */
export function subscribeTeamActivity(
  teamId: string,
  onChange: (entries: TeamActivity[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(activityRef(teamId), orderBy("at", "desc"), limit(ACTIVITY_SHOWN)),
    (snap) => onChange(snap.docs.map((d) => d.data() as TeamActivity)),
    onError,
  );
}

/** Deletes a team's whole log (it's ending — see deleteCollabTeam), in batches of 400. */
export async function deleteTeamActivity(teamId: string): Promise<void> {
  const snap = await getDocs(activityRef(teamId));
  for (let start = 0; start < snap.docs.length; start += 400) {
    const batch = writeBatch(db);
    for (const entry of snap.docs.slice(start, start + 400)) batch.delete(entry.ref);
    await batch.commit();
  }
  recentByTeam.delete(teamId);
}
