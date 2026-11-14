"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { getLatestMetaJobRun, startMetaJob, type MetaJobRun } from "@/lib/metaJobClient";
import { cn } from "@/lib/utils";

/** How often the status is re-read while a run is queued or going. */
const POLL_MS = 15_000;

function describe(run: MetaJobRun): { text: string; tone: "busy" | "good" | "bad" } {
  if (run.status !== "completed") return { text: "Running…", tone: "busy" };
  if (run.conclusion === "success") return { text: "Last run succeeded", tone: "good" };
  return { text: `Last run: ${run.conclusion ?? "unknown"}`, tone: "bad" };
}

/**
 * The metagame job, from the app: its latest run (re-read while it's going)
 * and "Run now" — a real run on main, applying new events, uploads and
 * exclusions (src/lib/server/metaWorkflow.ts).
 */
export function MetaJobStatus() {
  const [run, setRun] = useState<MetaJobRun | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  // Bumped to re-read the status (after starting a run, and while one is going).
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getLatestMetaJobRun()
      .then((latest) => {
        if (cancelled) return;
        setRun(latest);
        setError(null);
      })
      .catch((failure: Error) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const isRunning = !!run && run.status !== "completed";
  useEffect(() => {
    if (!isRunning) return;
    const timer = setTimeout(() => setTick((value) => value + 1), POLL_MS);
    return () => clearTimeout(timer);
  }, [isRunning, tick]);

  async function runNow() {
    setIsStarting(true);
    try {
      await startMetaJob();
      toast.success("Metagame job started — it takes a few minutes.");
      // GitHub lists the new run a moment after it's asked for.
      setTimeout(() => setTick((value) => value + 1), 3000);
    } catch (failure) {
      toast.error((failure as Error).message);
    } finally {
      setIsStarting(false);
    }
  }

  const status = run ? describe(run) : null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-raised px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-zinc-900">Metagame job</span>
        <span className="text-xs text-zinc-500">
          {error ? (
            <span className="text-red-700">{error}</span>
          ) : run === undefined ? (
            "Checking…"
          ) : !run || !status ? (
            "No runs yet."
          ) : (
            <>
              <span
                className={cn(
                  "font-medium",
                  status.tone === "busy" && "text-amber-700",
                  status.tone === "good" && "text-green-700",
                  status.tone === "bad" && "text-red-700",
                )}
              >
                {status.text}
              </span>{" "}
              · started {new Date(run.createdAt).toLocaleString()} ·{" "}
              <a href={run.url} target="_blank" rel="noreferrer" className="underline">
                details on GitHub
              </a>
            </>
          )}
        </span>
      </div>
      <Button onClick={runNow} disabled={isStarting || isRunning} className="py-1.5 text-sm">
        {isRunning ? "Running…" : isStarting ? "Starting…" : "Run now"}
      </Button>
    </div>
  );
}
