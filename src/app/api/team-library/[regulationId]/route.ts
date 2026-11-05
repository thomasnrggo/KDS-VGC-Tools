import { parseTeamLibrary, type TeamLibraryResponse } from "@/lib/teamLibrary/parseTeamLibrary";
import { TEAM_LIBRARY_TABS, vgcPastesCsvUrl } from "@/lib/teamLibrary/sources";

/**
 * One regulation's Team Library — the VGCPastes Repository tab, parsed into
 * compact JSON (see src/lib/teamLibrary). Static and refreshed once a day:
 * the first request after a day re-reads the sheet in the background, and if
 * that read fails the last good copy keeps being served.
 */
export const dynamic = "force-static";
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(TEAM_LIBRARY_TABS).map((regulationId) => ({ regulationId }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ regulationId: string }> },
) {
  const { regulationId } = await params;
  const gid = TEAM_LIBRARY_TABS[regulationId];
  try {
    const response = await fetch(vgcPastesCsvUrl(gid), { next: { revalidate } });
    if (!response.ok) throw new Error(`VGCPastes sheet: HTTP ${response.status}`);
    const body: TeamLibraryResponse = {
      regulationId,
      updatedAt: new Date().toISOString(),
      teams: parseTeamLibrary(await response.text()),
    };
    return Response.json(body);
  } catch (error) {
    // A failed refresh throws, so the last good copy stays; only a build
    // with no copy yet ships an empty library, retried on the next refresh.
    if (process.env.NEXT_PHASE !== "phase-production-build") throw error;
    console.error("[team-library] build-time read failed:", error);
    const empty: TeamLibraryResponse = { regulationId, updatedAt: "", teams: [] };
    return Response.json(empty);
  }
}
