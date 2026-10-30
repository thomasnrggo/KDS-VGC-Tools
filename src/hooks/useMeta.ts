"use client";

import { useEffect, useState } from "react";
import { getMeta } from "@/lib/firebase";
import { getCachedMeta, saveCachedMeta } from "@/lib/storage/db";
import type { MetaDocument } from "@/lib/meta/metaDocument";

/**
 * One Firestore read per regulation per session, shared by every page and
 * component that asks — the summary changes weekly at most.
 */
const loaded = new Map<string, MetaDocument | null>();
const pending = new Map<string, Promise<MetaDocument | null>>();

function loadFromFirestore(regulationId: string): Promise<MetaDocument | null> {
  let request = pending.get(regulationId);
  if (!request) {
    request = getMeta(regulationId)
      .then((meta) => {
        loaded.set(regulationId, meta);
        if (meta) void saveCachedMeta(meta).catch((error) => console.error("[meta] cache:", error));
        return meta;
      })
      .finally(() => pending.delete(regulationId));
    pending.set(regulationId, request);
  }
  return request;
}

/**
 * The metagame summary for a regulation (see PLANNING.md's "Metagame data"):
 * this device's copy right away, then Firestore's once per session. `meta` is
 * null while there's nothing yet — no data for that regulation, offline on a
 * first visit, or a failed read — so every use has to work without it.
 */
export function useMeta(regulationId: string | undefined) {
  // What this hook has learned for `id` (state is only ever set from async results).
  const [entry, setEntry] = useState<{
    id: string | undefined;
    meta: MetaDocument | null;
    done: boolean;
  }>({ id: undefined, meta: null, done: false });

  const isCurrent = entry.id === regulationId;
  const meta = isCurrent ? entry.meta : regulationId ? (loaded.get(regulationId) ?? null) : null;
  const isLoading = !!regulationId && !loaded.has(regulationId) && !(isCurrent && entry.done);

  useEffect(() => {
    if (!regulationId || loaded.has(regulationId)) return;
    let cancelled = false;
    const keep = (current: typeof entry) => (current.id === regulationId ? current.meta : null);
    // This device's copy first, so the data shows without waiting on the network.
    getCachedMeta(regulationId)
      .then((cached) => {
        if (cancelled || !cached) return;
        setEntry((current) =>
          current.id === regulationId && current.done
            ? current
            : { id: regulationId, meta: cached, done: false },
        );
      })
      .catch((error) => console.error("[meta] cache:", error));
    loadFromFirestore(regulationId)
      .then((fresh) => {
        // Keep the device's copy if the read came back empty.
        if (!cancelled) {
          setEntry((current) => ({ id: regulationId, meta: fresh ?? keep(current), done: true }));
        }
      })
      .catch((error) => {
        console.error("[meta] load failed:", error);
        if (!cancelled)
          setEntry((current) => ({ id: regulationId, meta: keep(current), done: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [regulationId]);

  return { meta, isLoading };
}
