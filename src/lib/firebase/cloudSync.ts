import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firestore";

export interface SyncableRecord {
  id: string;
  updatedAt: string;
}

/**
 * Generic per-collection Firestore sync for a `SyncableRecord[]` — teams and
 * opponents both use this. `push`/`remove` mirror a single local mutation to
 * the cloud; `pullAndMerge` reconciles a whole local list against the cloud
 * using last-write-wins by `updatedAt`, returning the merged list (callers
 * persist it locally themselves — this module knows nothing about IndexedDB).
 *
 * A parallel tombstone collection records deletions with a timestamp.
 * Without it, a device that was offline when a record got deleted elsewhere
 * would see "record doesn't exist locally, but does exist — no wait, it
 * doesn't — on the cloud" as indistinguishable from "never had this record,"
 * and push the deleted record right back on its next sync.
 */
export function createCollectionSync<T extends SyncableRecord>(collectionName: string) {
  const tombstoneCollectionName = `${collectionName}_deleted`;

  function recordsRef(uid: string) {
    return collection(db, "users", uid, collectionName);
  }
  function tombstonesRef(uid: string) {
    return collection(db, "users", uid, tombstoneCollectionName);
  }

  async function push(uid: string, record: T): Promise<void> {
    await setDoc(doc(recordsRef(uid), record.id), record);
    await deleteDoc(doc(tombstonesRef(uid), record.id)).catch(() => {});
  }

  async function remove(uid: string, id: string): Promise<void> {
    await setDoc(doc(tombstonesRef(uid), id), { deletedAt: new Date().toISOString() });
    await deleteDoc(doc(recordsRef(uid), id));
  }

  async function pullAndMerge(uid: string, localRecords: T[]): Promise<T[]> {
    const [recordsSnap, tombstonesSnap] = await Promise.all([
      getDocs(recordsRef(uid)),
      getDocs(tombstonesRef(uid)),
    ]);

    const remoteById = new Map<string, T>();
    recordsSnap.forEach((snap) => remoteById.set(snap.id, snap.data() as T));
    const tombstoneAtById = new Map<string, string>();
    tombstonesSnap.forEach((snap) => {
      tombstoneAtById.set(snap.id, (snap.data() as { deletedAt: string }).deletedAt);
    });

    const localById = new Map(localRecords.map((record) => [record.id, record]));
    const allIds = new Set([...localById.keys(), ...remoteById.keys(), ...tombstoneAtById.keys()]);

    const merged: T[] = [];
    const toPush: T[] = [];

    for (const id of allIds) {
      const local = localById.get(id);
      const remote = remoteById.get(id);
      const deletedAt = tombstoneAtById.get(id);
      // Editing a record after it was deleted elsewhere "undeletes" it — the
      // edit's own updatedAt outranking the tombstone is what makes that work.
      const localBeatsTombstone = !!local && !!deletedAt && local.updatedAt > deletedAt;

      if (deletedAt && !localBeatsTombstone) {
        continue;
      }

      if (local && (!remote || local.updatedAt > remote.updatedAt)) {
        merged.push(local);
        toPush.push(local);
      } else if (remote) {
        merged.push(remote);
      }
    }

    await Promise.all(toPush.map((record) => push(uid, record)));
    return merged;
  }

  return { push, remove, pullAndMerge };
}

/**
 * Single-doc sync for small scalar state (e.g. which team is currently
 * active) — no per-record merging, just a plain read/write of one doc under
 * `users/{uid}/meta/{docName}`.
 */
export async function pushMetaDoc(
  uid: string,
  docName: string,
  data: Record<string, unknown>,
): Promise<void> {
  await setDoc(doc(db, "users", uid, "meta", docName), data);
}

export async function pullMetaDoc<T>(uid: string, docName: string): Promise<T | null> {
  const snap = await getDoc(doc(db, "users", uid, "meta", docName));
  return snap.exists() ? (snap.data() as T) : null;
}
