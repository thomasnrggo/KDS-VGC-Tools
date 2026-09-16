/**
 * Debounces calls to `run` per `key` — scheduling a call replaces any call
 * still pending for that same key, so only the most recent one actually
 * fires, after `delayMs` of no further calls for that key. Independent keys
 * never interfere with each other's timers.
 *
 * Built for src/lib/storage/db.ts's save* functions: a notes textarea's
 * onChange fires on every keystroke, and each keystroke used to trigger an
 * immediate Firestore write — typing continuously queued writes faster than
 * Firestore's write stream could drain them, eventually throwing
 * "resource-exhausted: Write stream exhausted maximum allowed queued
 * writes." Debouncing the cloud push (not the local IndexedDB write, which
 * stays instant) collapses a whole burst of edits into a single write once
 * the user actually pauses, without changing local-first responsiveness —
 * and it's safe even if the tab closes mid-debounce, since the local record
 * is already newer than the cloud copy and gets caught up by the next
 * pullAndMerge (see createCollectionSync).
 */
export function createKeyedDebouncer(delayMs: number) {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  function schedule(key: string, run: () => void): void {
    const existing = pending.get(key);
    if (existing) clearTimeout(existing);
    pending.set(
      key,
      setTimeout(() => {
        pending.delete(key);
        run();
      }, delayMs),
    );
  }

  /** Drops a still-pending call for `key` without running it — e.g. when the record is deleted, so a stale queued push can't resurrect it in Firestore. */
  function cancel(key: string): void {
    const existing = pending.get(key);
    if (existing) {
      clearTimeout(existing);
      pending.delete(key);
    }
  }

  return { schedule, cancel };
}
