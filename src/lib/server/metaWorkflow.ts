/**
 * Server side: the metagame job's GitHub workflow (.github/workflows/update-meta.yml),
 * started and watched from /admin/meta-events through /api/admin/meta-job.
 * Needs META_JOB_GITHUB_TOKEN — a fine-grained token for this repository
 * only, with "Actions: read and write" — set on the server (Vercel), never
 * sent to the browser.
 */
const REPOSITORY = process.env.META_JOB_GITHUB_REPOSITORY ?? "thomasnrggo/KDS-VGC-Tools";
const WORKFLOW = "update-meta.yml";
const API = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${WORKFLOW}`;

/** The workflow's latest run, as the admin page shows it. */
export interface MetaJobRun {
  /** "queued", "in_progress", "completed"… */
  status: string;
  /** When completed: "success", "failure", "cancelled"… */
  conclusion: string | null;
  createdAt: string;
  url: string;
}

export class MetaWorkflowError extends Error {}

function headers(): HeadersInit {
  const token = process.env.META_JOB_GITHUB_TOKEN;
  if (!token) {
    throw new MetaWorkflowError(
      "META_JOB_GITHUB_TOKEN isn't set on the server — see src/lib/server/metaWorkflow.ts.",
    );
  }
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Starts a real run (not a dry run) on main: new events, uploads and exclusions. */
export async function dispatchMetaJob(): Promise<void> {
  const response = await fetch(`${API}/dispatches`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ ref: "main", inputs: { dry_run: false } }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new MetaWorkflowError(`GitHub said ${response.status}: ${await response.text()}`);
  }
}

/** The latest run, or null if there's none. */
export async function latestMetaJobRun(): Promise<MetaJobRun | null> {
  const response = await fetch(`${API}/runs?per_page=1`, { headers: headers(), cache: "no-store" });
  if (!response.ok) {
    throw new MetaWorkflowError(`GitHub said ${response.status}: ${await response.text()}`);
  }
  const { workflow_runs: runs } = (await response.json()) as {
    workflow_runs: {
      status: string;
      conclusion: string | null;
      created_at: string;
      html_url: string;
    }[];
  };
  const run = runs[0];
  return run
    ? {
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        url: run.html_url,
      }
    : null;
}
