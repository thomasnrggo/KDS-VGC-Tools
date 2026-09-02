"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { deleteSeason, getSeasons, saveSeason } from "@/lib/firebase";
import { parseTeamFolder } from "@/lib/teamFolder";
import { generateId } from "@/lib/id";
import { REGULATIONS } from "@/data/regulations";
import { AuthMenu } from "@/components/AuthMenu";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import type { Season } from "@/types";

// Client-side gate only, for hiding the page from everyone else — the real
// enforcement is firestore.rules' write:admin-uid-only rule, which rejects
// the request regardless of what this check does.
const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID;

interface SeasonFormState {
  regulationId: string;
  label: string;
  startDate: string;
  endDate: string;
  rawPaste: string;
}

function emptyForm(): SeasonFormState {
  return {
    regulationId: REGULATIONS[0]?.id ?? "",
    label: "",
    startDate: "",
    endDate: "",
    rawPaste: "",
  };
}

export default function AdminSeasonsPage() {
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<SeasonFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = !!user && !!ADMIN_UID && user.uid === ADMIN_UID;

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    getSeasons()
      .then((loaded) => {
        if (!cancelled) setSeasons(loaded);
      })
      .catch((error) => {
        console.error("[admin/seasons] load failed:", error);
        toast.error("Couldn't load seasons.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  function startAdding() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEditing(season: Season) {
    setEditingId(season.id);
    setForm({
      regulationId: season.regulationId,
      label: season.label,
      startDate: season.startDate,
      endDate: season.endDate,
      rawPaste: season.rawPaste,
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.label.trim() || !form.startDate || !form.endDate || !form.rawPaste.trim()) {
      toast.error("Fill in every field before saving.");
      return;
    }

    // parseTeamFolder needs Showdown's "Team Folder" export format — each
    // team preceded by a `=== [format] Title ===` header line — not a plain
    // single-team paste. Catch that here rather than only failing later when
    // someone actually tries to load this season's default set.
    const teamCount = parseTeamFolder(form.rawPaste.trim()).length;
    if (teamCount === 0) {
      toast.error(
        "No teams detected — this needs Showdown's \"Team Folder\" export format (each team preceded by a === [format] Title === header line), not a plain team paste.",
      );
      return;
    }

    const season: Season = {
      id: editingId ?? generateId(),
      regulationId: form.regulationId,
      label: form.label.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      rawPaste: form.rawPaste.trim(),
    };

    setIsSaving(true);
    try {
      await saveSeason(season);
      setSeasons((prev) => {
        const exists = prev.some((s) => s.id === season.id);
        return exists ? prev.map((s) => (s.id === season.id ? season : s)) : [...prev, season];
      });
      toast.success(`Saved season ${season.label} (${teamCount} team${teamCount === 1 ? "" : "s"})`);
      startAdding();
    } catch (error) {
      console.error("[admin/seasons] save failed:", error);
      toast.error("Couldn't save that season.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    try {
      await deleteSeason(confirmDeleteId);
      setSeasons((prev) => prev.filter((s) => s.id !== confirmDeleteId));
      toast.success("Season deleted");
    } catch (error) {
      console.error("[admin/seasons] delete failed:", error);
      toast.error("Couldn't delete that season.");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const confirmDeleteSeason = confirmDeleteId
    ? (seasons.find((s) => s.id === confirmDeleteId) ?? null)
    : null;

  if (isAuthLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-mauve-700">Sign in to continue.</p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white hover:bg-mauve-700"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-mauve-900">Not authorized</p>
        <p className="text-sm text-mauve-600">This page is only available to the site admin.</p>
        <Link
          href="/matchup-planner"
          className="text-sm font-medium text-mauve-600 hover:underline"
        >
          ← Back to Matchup Planner
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-mauve-200 bg-mauve-600 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/matchup-planner"
            className="text-sm font-medium text-mauve-100 hover:text-white"
          >
            ← Matchup Planner
          </Link>
          <h1 className="text-lg font-semibold text-white">Admin: Seasons</h1>
        </div>
        <AuthMenu user={user} isLoading={isAuthLoading} onSignIn={signInWithGoogle} onSignOut={signOut} />
      </header>

      <div className="flex flex-col gap-6 p-6 md:flex-row">
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 md:max-w-md">
          <h2 className="text-sm font-semibold text-mauve-900">
            {editingId ? `Editing ${editingId}` : "New season"}
          </h2>

          <label className="flex flex-col gap-1 text-sm text-mauve-700">
            Regulation
            <select
              value={form.regulationId}
              onChange={(event) => setForm((f) => ({ ...f, regulationId: event.target.value }))}
              className="rounded-lg border border-mauve-300 px-3 py-2 text-sm"
            >
              {REGULATIONS.map((regulation) => (
                <option key={regulation.id} value={regulation.id}>
                  {regulation.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-mauve-700">
            Label
            <input
              type="text"
              value={form.label}
              onChange={(event) => setForm((f) => ({ ...f, label: event.target.value }))}
              placeholder="M-5"
              className="rounded-lg border border-mauve-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-mauve-700">
              Start date
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))}
                className="rounded-lg border border-mauve-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-mauve-700">
              End date
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((f) => ({ ...f, endDate: event.target.value }))}
                className="rounded-lg border border-mauve-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-mauve-700">
            Default team set — Showdown&apos;s &ldquo;Team Folder&rdquo; export, each team
            preceded by its own <code className="text-xs">=== [format] Title ===</code> header line
            (a plain single-team paste won&apos;t work)
            <textarea
              value={form.rawPaste}
              onChange={(event) => setForm((f) => ({ ...f, rawPaste: event.target.value }))}
              rows={12}
              placeholder={"=== [gen9championsvgc2026regmb] Team Name ===\n\nSpecies @ Item\n...\n\n=== [gen9championsvgc2026regmb] Another Team ===\n\n..."}
              className="rounded-lg border border-mauve-300 px-3 py-2 font-mono text-xs"
            />
            {form.rawPaste.trim() && (
              <span className="text-xs text-mauve-500">
                {parseTeamFolder(form.rawPaste.trim()).length} team
                {parseTeamFolder(form.rawPaste.trim()).length === 1 ? "" : "s"} detected
              </span>
            )}
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white hover:bg-mauve-700 disabled:opacity-50"
            >
              {editingId ? "Save changes" : "Add season"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={startAdding}
                className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="flex w-full flex-col gap-2">
          <h2 className="text-sm font-semibold text-mauve-900">Existing seasons</h2>
          {isLoading ? (
            <p className="text-sm text-mauve-500">Loading…</p>
          ) : seasons.length === 0 ? (
            <p className="text-sm text-mauve-500">No seasons yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {seasons.map((season) => (
                <li
                  key={season.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-mauve-200 p-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-mauve-900">
                      {season.label} ·{" "}
                      {REGULATIONS.find((r) => r.id === season.regulationId)?.label ??
                        season.regulationId}
                    </span>
                    <span className="text-xs text-mauve-500">
                      {season.startDate} – {season.endDate}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(season)}
                      className="text-sm font-medium text-mauve-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(season.id)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {confirmDeleteSeason && (
        <Modal onClose={() => setConfirmDeleteId(null)} labelledBy="confirm-delete-season-title">
          <h2
            id="confirm-delete-season-title"
            className="mb-2 text-lg font-semibold text-mauve-900"
          >
            Delete season {confirmDeleteSeason.label}?
          </h2>
          <p className="mb-4 text-sm text-mauve-600">This can&apos;t be undone.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
