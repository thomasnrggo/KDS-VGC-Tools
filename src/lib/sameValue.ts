/**
 * Deep equality for plain data (what Firestore and IndexedDB store): object
 * keys in any order, and a key holding `undefined` the same as no key —
 * Firestore hands objects back with their keys in its own order, so
 * comparing `JSON.stringify`s would see a change where there's none.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return a === undefined ? b === undefined : Object.is(a, b);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!sameValue(left[key], right[key])) return false;
  }
  return true;
}
