import { requireStaff } from "@/lib/server/staffAuth";
import { MetaWorkflowError, dispatchMetaJob, latestMetaJobRun } from "@/lib/server/metaWorkflow";

/**
 * The metagame job, for /admin/meta-events (staff only): GET its latest
 * run, POST to start one now. See src/lib/server/metaWorkflow.ts.
 */
export const dynamic = "force-dynamic";

function failure(error: unknown): Response {
  console.error("[meta-job]", error);
  const message =
    error instanceof MetaWorkflowError ? error.message : "Couldn't reach GitHub — try again.";
  return Response.json({ error: message }, { status: 502 });
}

export async function GET(request: Request) {
  const caller = await requireStaff(request);
  if (caller instanceof Response) return caller;
  try {
    return Response.json({ run: await latestMetaJobRun() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const caller = await requireStaff(request);
  if (caller instanceof Response) return caller;
  try {
    await dispatchMetaJob();
    return Response.json({ started: true });
  } catch (error) {
    return failure(error);
  }
}
