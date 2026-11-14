import { auth } from "@/lib/firebase/auth";
import type { MetaJobRun } from "@/lib/server/metaWorkflow";

export type { MetaJobRun };

/**
 * The browser side of /api/admin/meta-job (staff only): the metagame job's
 * latest run, or start one now. Sends the signed-in user's ID token; throws
 * with the server's message on failure.
 */
async function call(method: "GET" | "POST"): Promise<{ run?: MetaJobRun | null }> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch("/api/admin/meta-job", {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as {
    run?: MetaJobRun | null;
    error?: string;
  };
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body;
}

export async function getLatestMetaJobRun(): Promise<MetaJobRun | null> {
  return (await call("GET")).run ?? null;
}

export async function startMetaJob(): Promise<void> {
  await call("POST");
}
