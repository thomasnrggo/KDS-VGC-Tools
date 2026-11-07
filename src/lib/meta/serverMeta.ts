import { unstable_rethrow } from "next/navigation";
import type { MetaDocument } from "./metaDocument";
import { metaSnapshot } from "./metaSnapshot";

/**
 * Reading the metagame on the server, for the home page's server-rendered
 * first paint. `meta/` is public (see firestore.rules), so this uses
 * Firestore's REST API with the app's public web key — no Admin SDK or
 * credentials on the server. It runs when the home page is (re)built — at
 * most once an hour (its `revalidate`), not once per visitor.
 */

/** A Firestore REST value (`{stringValue: "…"}`, `{mapValue: {fields}}`…) as plain JSON. */
type FirestoreValue = Record<string, unknown>;

export function fromFirestoreValue(value: FirestoreValue): unknown {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("arrayValue" in value) {
    const { values = [] } = value.arrayValue as { values?: FirestoreValue[] };
    return values.map(fromFirestoreValue);
  }
  if ("mapValue" in value) {
    const { fields = {} } = value.mapValue as { fields?: Record<string, FirestoreValue> };
    return fromFirestoreFields(fields);
  }
  throw new Error(`Unsupported Firestore value: ${Object.keys(value).join(", ")}`);
}

export function fromFirestoreFields(
  fields: Record<string, FirestoreValue>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]),
  );
}

/**
 * The home page's snapshot of a regulation's metagame (see metaSnapshot), or
 * null when there isn't one yet — the page then loads it in the browser, as
 * it did before. A failed read throws, so a background rebuild fails and the
 * last good page keeps being served; only a build with no page yet goes
 * without (null), retried on the next rebuild.
 */
export async function getMetaSnapshot(regulationId: string): Promise<MetaDocument | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/meta/${encodeURIComponent(regulationId)}`;
  try {
    // The page is what's cached — static, rebuilt hourly (src/app/page.tsx) —
    // not this response (~6MB of typed REST values, over Next's 2MB data
    // cache limit, so no `next.revalidate` here). The key goes in a header,
    // so it stays out of logs.
    const response = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { fields } = (await response.json()) as { fields?: Record<string, FirestoreValue> };
    if (!fields) return null;
    return metaSnapshot(fromFirestoreFields(fields) as unknown as MetaDocument);
  } catch (error) {
    unstable_rethrow(error);
    const building = process.env.NEXT_PHASE === "phase-production-build";
    // In dev (offline, say) the page just loads it in the browser.
    if (!building && process.env.NODE_ENV === "production") throw error;
    console.error(`[meta] server read of ${regulationId} failed:`, error);
    return null;
  }
}
