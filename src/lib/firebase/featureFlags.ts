import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import { DEFAULT_FEATURE_FLAGS } from "@/types";
import type { FeatureFlags } from "@/types";

/**
 * Public, shared single doc (not scoped under users/{uid} — same
 * everyone-reads/admin-writes shape as the `seasons` collection, see
 * seasons.ts). Lives under a small `appConfig` collection rather than a
 * top-level collection of its own since it's one global settings doc, not a
 * list of records. See firestore.rules for the read:true/write:admin-uid-only
 * rule, and /admin/features for the editor.
 */
const FEATURE_FLAGS_DOC = doc(db, "appConfig", "featureFlags");

/** A missing doc (nothing configured yet) resolves to every section enabled — see DEFAULT_FEATURE_FLAGS. A partial doc (e.g. an older doc missing a newer flag key) is merged over the defaults rather than trusted as-is. */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const snap = await getDoc(FEATURE_FLAGS_DOC);
  const stored = snap.exists() ? (snap.data() as Partial<FeatureFlags>) : {};
  return { ...DEFAULT_FEATURE_FLAGS, ...stored };
}

export async function saveFeatureFlags(flags: FeatureFlags): Promise<void> {
  await setDoc(FEATURE_FLAGS_DOC, flags);
}
