import { fromFirestoreFields } from "@/lib/meta/serverMeta";
import type { SharedTeam } from "@/types";

/** How long a shared team's link preview (title, image) is cached before it's read again. */
export const SHARED_TEAM_PREVIEW_REVALIDATE = 300;

/**
 * Reads a shared team on the server, for its link preview (the page itself
 * still loads it in the browser — see getSharedTeam). `sharedTeams/` is
 * public (firestore.rules), so like getMetaSnapshot this uses Firestore's
 * REST API with the app's public web key — no Admin SDK. Null when it isn't
 * shared (or can't be read): the preview then falls back to the site's own.
 */
export async function getSharedTeamOnServer(teamId: string): Promise<SharedTeam | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey || !teamId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sharedTeams/${encodeURIComponent(teamId)}`;
  try {
    const response = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey },
      next: { revalidate: SHARED_TEAM_PREVIEW_REVALIDATE },
    });
    if (!response.ok) return null;
    const { fields } = (await response.json()) as {
      fields?: Parameters<typeof fromFirestoreFields>[0];
    };
    if (!fields) return null;
    const team = fromFirestoreFields(fields) as unknown as SharedTeam;
    return Array.isArray(team.pokemon) ? team : null;
  } catch (error) {
    console.error(`[shared team] server read of ${teamId} failed:`, error);
    return null;
  }
}
