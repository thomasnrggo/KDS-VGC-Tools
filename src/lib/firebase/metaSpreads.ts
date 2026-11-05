import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { MetaSpread, MetaSpreads } from "@/lib/meta/metaSpreads";

/**
 * The admin's common spreads for the metagame's sets (see
 * src/lib/meta/metaSpreads.ts) — one public doc per regulation in the
 * everyone-reads/admin-writes `appConfig` collection (see firestore.rules),
 * keyed by metaSpreadKey, edited at /admin/meta-sets.
 */
function spreadsDoc(regulationId: string) {
  return doc(db, "appConfig", `metaSpreads_${regulationId}`);
}

/** A missing doc (nothing set yet) is no spreads. */
export async function getMetaSpreads(regulationId: string): Promise<MetaSpreads> {
  const snap = await getDoc(spreadsDoc(regulationId));
  return snap.exists() ? (snap.data() as MetaSpreads) : {};
}

/** Saves one set's spread — null removes it (back to the estimate). */
export async function saveMetaSpread(
  regulationId: string,
  key: string,
  spread: MetaSpread | null,
): Promise<void> {
  await setDoc(spreadsDoc(regulationId), { [key]: spread ?? deleteField() }, { merge: true });
}
