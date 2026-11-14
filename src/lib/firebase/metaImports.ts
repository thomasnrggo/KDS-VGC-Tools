import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { MetaImport } from "@/lib/meta/metaImport";

/**
 * Events uploaded by hand, waiting for the metagame job (see
 * src/lib/meta/metaImport.ts) — `metaImports/{id}`, staff only
 * (firestore.rules). The job saves each as an event and deletes it here.
 */
const IMPORTS = collection(db, "metaImports");

export async function getMetaImports(): Promise<MetaImport[]> {
  const snap = await getDocs(IMPORTS);
  return snap.docs.map((entry) => entry.data() as MetaImport);
}

export async function saveMetaImport(entry: MetaImport): Promise<void> {
  await setDoc(doc(IMPORTS, entry.id), entry);
}

export async function deleteMetaImport(id: string): Promise<void> {
  await deleteDoc(doc(IMPORTS, id));
}
