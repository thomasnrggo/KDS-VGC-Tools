import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { LearnsetOverride, LearnsetOverrides } from "@/lib/learnsets";

/**
 * The admin's corrections to the generated learnsets (see src/lib/learnsets.ts)
 * — one public doc keyed by species key, same everyone-reads/admin-writes
 * `appConfig` collection as the feature flags (see firestore.rules), edited
 * at /admin/learnsets.
 */
const LEARNSET_OVERRIDES_DOC = doc(db, "appConfig", "learnsetOverrides");

/** A missing doc (nothing corrected yet) is no overrides. */
export async function getLearnsetOverrides(): Promise<LearnsetOverrides> {
  const snap = await getDoc(LEARNSET_OVERRIDES_DOC);
  return snap.exists() ? (snap.data() as LearnsetOverrides) : {};
}

/** Saves one species' override — null removes it (back to the generated learnset). */
export async function saveLearnsetOverride(
  speciesKey: string,
  override: LearnsetOverride | null,
): Promise<void> {
  await setDoc(
    LEARNSET_OVERRIDES_DOC,
    { [speciesKey]: override ?? deleteField() },
    { merge: true },
  );
}
