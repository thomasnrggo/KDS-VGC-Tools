import { doc, getDoc } from "firebase/firestore";
import { db } from "./firestore";
import type { MetaDocument, MetaTournamentDocument } from "@/lib/meta/metaDocument";

/**
 * The metagame summary for a regulation — public, written only by the
 * metagame job (scripts/update-meta.mjs; see firestore.rules). Null when the
 * job hasn't covered that regulation yet.
 */
const META_COLLECTION = "meta";

export async function getMeta(regulationId: string): Promise<MetaDocument | null> {
  const snap = await getDoc(doc(db, META_COLLECTION, regulationId));
  return snap.exists() ? (snap.data() as MetaDocument) : null;
}

/** One event's own summary (see the metagame job), or null if there isn't one. */
export async function getMetaTournament(
  regulationId: string,
  tournamentId: string,
): Promise<MetaTournamentDocument | null> {
  const snap = await getDoc(doc(db, META_COLLECTION, regulationId, "tournaments", tournamentId));
  return snap.exists() ? (snap.data() as MetaTournamentDocument) : null;
}
