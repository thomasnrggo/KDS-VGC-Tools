import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { SharedTeam } from "@/types";

/**
 * Public copies of shared Team Reports (see SharedTeam and
 * src/lib/sharedTeam.ts) — not under users/{uid}, since anyone with the
 * link reads them, signed in or not. firestore.rules lets only the doc's
 * ownerUid create, update or delete it.
 */
const SHARED_TEAMS_COLLECTION = "sharedTeams";

export async function publishSharedTeam(shared: SharedTeam): Promise<void> {
  await setDoc(doc(db, SHARED_TEAMS_COLLECTION, shared.id), shared);
}

export async function unpublishSharedTeam(teamId: string): Promise<void> {
  await deleteDoc(doc(db, SHARED_TEAMS_COLLECTION, teamId));
}

/** The shared copy, or null when the team isn't shared (or was unshared). */
export async function getSharedTeam(teamId: string): Promise<SharedTeam | null> {
  const snap = await getDoc(doc(db, SHARED_TEAMS_COLLECTION, teamId));
  return snap.exists() ? (snap.data() as SharedTeam) : null;
}
