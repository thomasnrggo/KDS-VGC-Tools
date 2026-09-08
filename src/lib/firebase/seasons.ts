import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { Season } from "@/types";

/**
 * Public, shared collection (not scoped under users/{uid} — this is global
 * data every visitor reads, only the admin writes). See firestore.rules for
 * the read:true/write:admin-uid-only rule, and /admin/seasons for the editor.
 */
const SEASONS_COLLECTION = "seasons";

export async function getSeasons(): Promise<Season[]> {
  const snap = await getDocs(collection(db, SEASONS_COLLECTION));
  return snap.docs.map((d) => d.data() as Season);
}

export async function saveSeason(season: Season): Promise<void> {
  await setDoc(doc(db, SEASONS_COLLECTION, season.id), season);
}

export async function deleteSeason(id: string): Promise<void> {
  await deleteDoc(doc(db, SEASONS_COLLECTION, id));
}
