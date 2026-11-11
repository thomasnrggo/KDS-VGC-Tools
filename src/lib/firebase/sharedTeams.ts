import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { SharedMatchup, SharedTeam } from "@/types";

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

// ── Shared matchups ──────────────────────────────────────────────────────────
// sharedTeams/{teamId}/matchups/{opponentId} (see SharedMatchup) — public
// like their team, written only by its owner (firestore.rules checks the
// parent doc's ownerUid, so they go before the team doc does).

function matchupsRef(teamId: string) {
  return collection(db, SHARED_TEAMS_COLLECTION, teamId, "matchups");
}

export async function publishSharedMatchup(teamId: string, matchup: SharedMatchup): Promise<void> {
  await setDoc(doc(matchupsRef(teamId), matchup.id), matchup);
}

export async function unpublishSharedMatchup(teamId: string, opponentId: string): Promise<void> {
  await deleteDoc(doc(matchupsRef(teamId), opponentId));
}

/** A shared team's matchups, in no particular order. */
export async function getSharedMatchups(teamId: string): Promise<SharedMatchup[]> {
  const snap = await getDocs(matchupsRef(teamId));
  return snap.docs.map((d) => d.data() as SharedMatchup);
}

/** One shared matchup, or null when it isn't shared (any more). */
export async function getSharedMatchup(
  teamId: string,
  opponentId: string,
): Promise<SharedMatchup | null> {
  const snap = await getDoc(doc(matchupsRef(teamId), opponentId));
  return snap.exists() ? (snap.data() as SharedMatchup) : null;
}
