import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { CalcSet } from "@/types";

/**
 * The admin's public Damage Calculator sets — global data every visitor
 * reads, only the admin writes (same shape as seasons; see firestore.rules).
 */
const PUBLIC_SETS_COLLECTION = "publicSets";

export async function getPublicSets(): Promise<CalcSet[]> {
  const snap = await getDocs(collection(db, PUBLIC_SETS_COLLECTION));
  return snap.docs.map((d) => d.data() as CalcSet);
}

export async function savePublicSet(set: CalcSet): Promise<void> {
  await setDoc(doc(db, PUBLIC_SETS_COLLECTION, set.id), set);
}

export async function deletePublicSet(id: string): Promise<void> {
  await deleteDoc(doc(db, PUBLIC_SETS_COLLECTION, id));
}
