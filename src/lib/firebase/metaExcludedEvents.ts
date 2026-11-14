import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { ExcludedEvent, ExcludedEvents } from "@/lib/meta/excludedEvents";

/**
 * The events left out of the metagame (see src/lib/meta/excludedEvents.ts) —
 * a public doc in the everyone-reads/staff-writes `appConfig` collection (see
 * firestore.rules), edited at /admin/meta-events, read by the metagame job.
 */
const EXCLUDED_DOC = doc(db, "appConfig", "metaExcludedEvents");

/** A missing doc (nothing excluded yet) is none. */
export async function getExcludedEvents(): Promise<ExcludedEvents> {
  const snap = await getDoc(EXCLUDED_DOC);
  return snap.exists() ? (snap.data() as ExcludedEvents) : {};
}

/** Excludes an event — or, with null, includes it again. */
export async function setEventExcluded(id: string, event: ExcludedEvent | null): Promise<void> {
  await setDoc(EXCLUDED_DOC, { [id]: event ?? deleteField() }, { merge: true });
}
