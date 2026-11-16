import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { ArchetypeSample } from "@/lib/archetypes/samples";

/**
 * Sample teams for the archetype definitions (src/lib/archetypes/samples.ts)
 * — `archetypeSamples/{id}`, staff only (firestore.rules), added and removed
 * at /admin/archetypes.
 */
const SAMPLES = collection(db, "archetypeSamples");

export async function getArchetypeSamples(): Promise<ArchetypeSample[]> {
  const snap = await getDocs(SAMPLES);
  return snap.docs.map((entry) => entry.data() as ArchetypeSample);
}

export async function saveArchetypeSample(sample: ArchetypeSample): Promise<void> {
  // Firestore rejects undefined fields.
  const clean = Object.fromEntries(Object.entries(sample).filter(([, v]) => v !== undefined));
  await setDoc(doc(SAMPLES, sample.id), clean);
}

export async function deleteArchetypeSample(id: string): Promise<void> {
  await deleteDoc(doc(SAMPLES, id));
}
