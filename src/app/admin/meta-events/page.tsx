"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMeta, useMetaTournament } from "@/hooks/useMeta";
import { useExcludedEvents } from "@/hooks/useExcludedEvents";
import { AuthMenu } from "@/components/AuthMenu";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { PokemonSprite } from "@/components/PokemonSprite";
import { RegulationSelect } from "@/components/Select";
import { toast } from "@/components/Toast";
import { IconName } from "@/enums";
import { REGULATIONS } from "@/data/regulations";
import type { MetaTournament } from "@/lib/meta/metaDocument";
import { cn } from "@/lib/utils";
import { deleteMetaImport, getMetaImports, saveMetaImport } from "@/lib/firebase";
import type { MetaImport } from "@/lib/meta/metaImport";
import { MetaEventUpload } from "./MetaEventUpload";
import { MetaJobStatus } from "./MetaJobStatus";

/** The metagame job's workflow — "Run workflow" (dry run unticked) applies a change right away. */
const WORKFLOW_URL =
  "https://github.com/thomasnrggo/KDS-VGC-Tools/actions/workflows/update-meta.yml";

const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

const dateRange = (event: Pick<MetaTournament, "startDate" | "endDate">) =>
  event.startDate === event.endDate ? event.startDate : `${event.startDate} – ${event.endDate}`;

/**
 * Each official event behind a regulation's metagame, with a switch to leave
 * one out (src/lib/meta/excludedEvents.ts) — the metagame job rebuilds the
 * summary without it on its next run. Open an event to see its own most
 * used Pokémon. Admin-only, so English-only like the other admin pages.
 */
export default function AdminMetaEventsPage() {
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const { isStaff, isLoading: roleLoading } = useIsAdmin();
  const [regulationId, setRegulationId] = useState(REGULATIONS[0].id);
  const { meta, isLoading: metaLoading } = useMeta(regulationId);
  const { excluded, isLoading: excludedLoading, setExcluded } = useExcludedEvents();
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Included again this visit: gone from the exclusions and not back in the summary
  // until the job runs, so kept here to stay listed.
  const [reincluded, setReincluded] = useState<MetaTournament[]>([]);
  const { tournamentMeta, isLoading: tournamentLoading } = useMetaTournament(regulationId, openId);
  // Uploaded by hand, waiting for the job (src/lib/meta/metaImport.ts).
  const [uploads, setUploads] = useState<MetaImport[]>([]);
  const canLoadUploads = !!user;
  useEffect(() => {
    if (!canLoadUploads) return;
    let cancelled = false;
    getMetaImports()
      .then((loaded) => {
        if (!cancelled) setUploads(loaded);
      })
      .catch((error) => console.error("[metaImports] loading failed:", error));
    return () => {
      cancelled = true;
    };
  }, [canLoadUploads]);

  if (isAuthLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-zinc-700">Sign in to continue.</p>
        <Button onClick={signInWithGoogle}>Sign in with Google</Button>
      </div>
    );
  }

  if (roleLoading) return null;

  if (!isStaff) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-zinc-900">Not authorized</p>
        <p className="text-sm text-zinc-600">
          This page is only available to moderators and admins.
        </p>
        <Link href="/matchup-planner" className="text-sm font-medium text-zinc-600 hover:underline">
          ← Back to Matchup Planner
        </Link>
      </div>
    );
  }

  const inSummary = new Set((meta?.official.tournaments ?? []).map((event) => event.id));
  // The summary's events, plus the excluded ones it no longer lists, newest first.
  const events = [
    ...(meta?.official.tournaments ?? []),
    ...Object.values(excluded).filter(
      (event) => event.regulationId === regulationId && !inSummary.has(event.id),
    ),
    ...reincluded.filter((event) => !inSummary.has(event.id) && !excluded[event.id]),
  ].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const regulationUploads = uploads.filter((upload) => upload.regulationId === regulationId);
  const pending =
    regulationUploads.length > 0 ||
    events.some((event) => !!excluded[event.id] === inSummary.has(event.id));
  const uploader = user?.displayName ?? user?.email ?? "an admin";

  async function addUpload(entry: MetaImport) {
    await saveMetaImport(entry);
    setUploads((current) => [...current.filter((upload) => upload.id !== entry.id), entry]);
    setRegulationId(entry.regulationId);
  }

  async function removeUpload(id: string) {
    try {
      await deleteMetaImport(id);
      setUploads((current) => current.filter((upload) => upload.id !== id));
    } catch (error) {
      console.error("[metaImports] remove failed:", error);
      toast.error("Couldn't remove it. Check your connection and try again.");
    }
  }

  async function toggle(event: MetaTournament) {
    const isExcluded = !!excluded[event.id];
    setSavingId(event.id);
    try {
      await setExcluded(
        event.id,
        isExcluded
          ? null
          : {
              id: event.id,
              title: event.title,
              regulationId,
              startDate: event.startDate,
              endDate: event.endDate,
              teams: event.teams,
              excludedAt: new Date().toISOString(),
              excludedBy: uploader,
            },
      );
      if (isExcluded) setReincluded((current) => [...current, event]);
    } catch (error) {
      console.error("[metaEvents] save failed:", error);
      toast.error("Couldn't save. Check your connection and try again.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-chrome-600 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/matchup-planner"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            ← Matchup Planner
          </Link>
          <h1 className="text-lg font-semibold text-white">Admin: Meta events</h1>
          <Link
            href="/admin/meta-sets"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            Meta sets →
          </Link>
        </div>
        <AuthMenu
          user={user}
          isLoading={isAuthLoading}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
        />
      </header>

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <RegulationSelect value={regulationId} onChange={setRegulationId} />
          <p className="max-w-3xl text-sm text-zinc-600">
            The official events behind this regulation&apos;s metagame. Exclude one to leave it out
            of every number in the app — usage, items, teams, the Speed and Threats tabs. The
            metagame job applies changes on its next run (Mondays), or now from{" "}
            <a
              href={WORKFLOW_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-zinc-900 underline"
            >
              Run workflow
            </a>{" "}
            with &ldquo;dry run&rdquo; unticked — or Run now below. Nothing is deleted: include it
            again anytime. Missing an event? Add it by hand at the bottom.
          </p>
        </div>

        <MetaJobStatus />

        {pending && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950">
            Changes waiting for the metagame job — the app still shows the old numbers until it runs
            (Mondays, or Run now above).
          </p>
        )}

        {regulationUploads.length > 0 && (
          <ul className="flex flex-col overflow-hidden rounded-lg border border-amber-300 bg-raised dark:border-amber-800">
            {regulationUploads.map((upload) => (
              <li
                key={upload.id}
                className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-zinc-900">
                    {upload.title}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {dateRange(upload)} · {upload.players.length} teams · uploaded by{" "}
                    {upload.uploadedBy}, {upload.uploadedAt.slice(0, 10)}
                  </span>
                </span>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Uploaded · joins on the next run
                </span>
                <Button
                  variant="outline"
                  onClick={() => removeUpload(upload.id)}
                  className="py-1.5 text-sm"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        {metaLoading || excludedLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-500">No events for this regulation yet.</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-raised">
            {events.map((event) => {
              const isExcluded = !!excluded[event.id];
              const counted = inSummary.has(event.id);
              const isOpen = openId === event.id;
              return (
                <li key={event.id} className="border-b border-zinc-100 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : event.id)}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <Icon
                        name={IconName.ExpandMore}
                        size={18}
                        className={cn("text-zinc-500 transition-transform", isOpen && "rotate-180")}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            "truncate text-sm font-semibold text-zinc-900",
                            isExcluded && "text-zinc-500 line-through",
                          )}
                        >
                          {event.title}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {dateRange(event)} · {event.teams} teams
                          {isExcluded &&
                            ` · excluded by ${excluded[event.id].excludedBy}, ${excluded[event.id].excludedAt.slice(0, 10)}`}
                        </span>
                      </span>
                    </button>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        isExcluded
                          ? counted
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                            : "bg-zinc-100 text-zinc-600"
                          : counted
                            ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
                            : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
                      )}
                    >
                      {isExcluded
                        ? counted
                          ? "Excluded · leaves on the next run"
                          : "Excluded"
                        : counted
                          ? "In the metagame"
                          : "Included · back on the next run"}
                    </span>
                    <Button
                      variant={isExcluded ? "outline" : "danger"}
                      onClick={() => toggle(event)}
                      disabled={savingId === event.id}
                      className="py-1.5 text-sm"
                    >
                      {isExcluded ? "Include" : "Exclude"}
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                      {tournamentLoading ? (
                        <p className="text-sm text-zinc-500">Loading…</p>
                      ) : !tournamentMeta ? (
                        <p className="text-sm text-zinc-500">No data saved for this event.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-zinc-500">
                            Most used, at this event alone ({tournamentMeta.teams} teams)
                          </p>
                          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
                            {tournamentMeta.pokemon.slice(0, 24).map((mon) => (
                              <li
                                key={mon.species}
                                title={mon.species}
                                className="flex flex-col items-center gap-0.5"
                              >
                                <span className="relative aspect-square w-12">
                                  <PokemonSprite species={mon.species} fill />
                                </span>
                                <span className="text-xs text-zinc-700">{percent(mon.usage)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <MetaEventUpload uploadedBy={uploader} onUpload={addUpload} />
      </div>
    </div>
  );
}
