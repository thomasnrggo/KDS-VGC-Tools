"use client";

import { useEffect, useState } from "react";
import { getMeta, getMetaTournament } from "@/lib/firebase";
import {
  getCachedMeta,
  getCachedMetaTournament,
  saveCachedMeta,
  saveCachedMetaTournament,
} from "@/lib/storage/db";
import type { MetaDocument, MetaTournamentDocument } from "@/lib/meta/metaDocument";

/**
 * One Firestore read per document per session, shared by every page and
 * component that asks — the summaries change weekly at most.
 */
const loaded = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

function loadOnce<T>(
  key: string,
  read: () => Promise<T | null>,
  cache: (value: T) => Promise<void>,
): Promise<T | null> {
  let request = pending.get(key) as Promise<T | null> | undefined;
  if (!request) {
    request = read()
      .then((value) => {
        loaded.set(key, value);
        if (value) void cache(value).catch((error) => console.error("[meta] cache:", error));
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, request);
  }
  return request;
}

/**
 * A metagame document: this device's copy right away, then Firestore's once
 * per session. `value` is null while there's nothing yet — no such document,
 * offline on a first visit, or a failed read — so every use has to work
 * without it. State is only ever set from async results.
 */
function useMetaDocument<T>(
  key: string | null,
  readCached: () => Promise<T | null>,
  read: () => Promise<T | null>,
  cache: (value: T) => Promise<void>,
): { value: T | null; isLoading: boolean } {
  const [entry, setEntry] = useState<{ key: string | null; value: T | null; done: boolean }>({
    key: null,
    value: null,
    done: false,
  });

  const isCurrent = entry.key === key;
  const value = isCurrent ? entry.value : key ? ((loaded.get(key) as T | null) ?? null) : null;
  const isLoading = !!key && !loaded.has(key) && !(isCurrent && entry.done);

  useEffect(() => {
    if (!key || loaded.has(key)) return;
    let cancelled = false;
    const keep = (current: typeof entry) => (current.key === key ? current.value : null);
    // This device's copy first, so the data shows without waiting on the network.
    readCached()
      .then((cached) => {
        if (cancelled || !cached) return;
        setEntry((current) =>
          current.key === key && current.done ? current : { key, value: cached, done: false },
        );
      })
      .catch((error) => console.error("[meta] cache:", error));
    loadOnce(key, read, cache)
      .then((fresh) => {
        // Keep the device's copy if the read came back empty.
        if (!cancelled) setEntry((current) => ({ key, value: fresh ?? keep(current), done: true }));
      })
      .catch((error) => {
        console.error("[meta] load failed:", error);
        if (!cancelled) setEntry((current) => ({ key, value: keep(current), done: true }));
      });
    return () => {
      cancelled = true;
    };
    // The loaders are fixed by the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { value, isLoading };
}

/**
 * The metagame summary for a regulation (see PLANNING.md's "Metagame data"):
 * the whole regulation, the recent events, and each Pokémon's history.
 */
export function useMeta(regulationId: string | undefined) {
  const { value, isLoading } = useMetaDocument<MetaDocument>(
    regulationId ?? null,
    () => getCachedMeta(regulationId!),
    () => getMeta(regulationId!),
    saveCachedMeta,
  );
  return { meta: value, isLoading };
}

/** One event's own summary, for the Metagame page's tournament chips — loaded only when asked for. */
export function useMetaTournament(regulationId: string | undefined, tournamentId: string | null) {
  const { value, isLoading } = useMetaDocument<MetaTournamentDocument>(
    regulationId && tournamentId ? `${regulationId}/${tournamentId}` : null,
    () => getCachedMetaTournament(regulationId!, tournamentId!),
    () => getMetaTournament(regulationId!, tournamentId!),
    saveCachedMetaTournament,
  );
  return { tournamentMeta: value, isLoading };
}
