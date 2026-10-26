/**
 * Whether two lists hold the same records, by id and `updatedAt` — what the
 * synced hooks check before swapping the cloud's copy in for the one already
 * shown, so an unchanged list never re-renders (or flickers) after a sync.
 */
export function sameRecords<T extends { id: string; updatedAt: string }>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const updatedAtById = new Map(a.map((record) => [record.id, record.updatedAt]));
  return b.every((record) => updatedAtById.get(record.id) === record.updatedAt);
}
