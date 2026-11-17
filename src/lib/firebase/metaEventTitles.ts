import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { EventTitle, EventTitles } from "@/lib/meta/eventTitles";

/**
 * Event titles renamed by an admin (see src/lib/meta/eventTitles.ts) — a public
 * doc in the everyone-reads/staff-writes `appConfig` collection (see
 * firestore.rules), edited at /admin/meta-events, read by the metagame job.
 */
const TITLES_DOC = doc(db, "appConfig", "metaEventTitles");

/** A missing doc (nothing renamed yet) is none. */
export async function getEventTitles(): Promise<EventTitles> {
  const snap = await getDoc(TITLES_DOC);
  return snap.exists() ? (snap.data() as EventTitles) : {};
}

/** Renames an event — or, with null, gives it back its own title. */
export async function setEventTitle(id: string, title: EventTitle | null): Promise<void> {
  await setDoc(TITLES_DOC, { [id]: title ?? deleteField() }, { merge: true });
}
