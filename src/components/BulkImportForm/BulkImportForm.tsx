"use client";

import { useMemo, useState, type FormEvent } from "react";
import { parseTeamFolder } from "@/lib/teamFolder";
import type { TeamFolderEntry } from "@/types";

interface BulkImportFormProps {
  onImport: (entries: TeamFolderEntry[]) => void;
  onCancel: () => void;
}

export function BulkImportForm({ onImport, onCancel }: BulkImportFormProps) {
  const [value, setValue] = useState("");
  const entries = useMemo(() => parseTeamFolder(value), [value]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (entries.length === 0) return;
    onImport(entries);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Paste a Showdown team folder export — multiple teams, each starting with a{" "}
        <code className="text-xs">=== [format] Name ===</code> line — to add them all as
        opponents at once.
      </p>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={14}
        placeholder="Paste a Showdown team folder export here…"
        aria-label="Showdown team folder export"
        className="w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
        {entries.length === 0
          ? "No teams detected yet."
          : `Found ${entries.length} team${entries.length === 1 ? "" : "s"}: ${entries
              .map((entry) => entry.label)
              .join(", ")}`}
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={entries.length === 0}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Import {entries.length > 0 ? entries.length : ""} team
          {entries.length === 1 ? "" : "s"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
