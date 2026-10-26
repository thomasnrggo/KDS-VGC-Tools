"use client";

import { useMemo, useState, type FormEvent } from "react";
import { parseTeamFolder } from "@/lib/teamFolder";
import type { TeamFolderEntry } from "@/types";
import { useMessages } from "@/hooks/useLanguage";
import { Button } from "@/components/Button";

interface BulkImportFormProps {
  onImport: (entries: TeamFolderEntry[]) => void;
  onCancel: () => void;
}

export function BulkImportForm({ onImport, onCancel }: BulkImportFormProps) {
  const t = useMessages();
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
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4"
    >
      <p className="text-sm text-zinc-600">
        {t.bulkImport.introBefore}
        <code className="text-xs">=== [format] Name ===</code>
        {t.bulkImport.introAfter}
      </p>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={14}
        placeholder={t.bulkImport.placeholder}
        aria-label={t.bulkImport.label}
        className="w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
      />
      <p role="status" className="text-sm text-zinc-500">
        {entries.length === 0
          ? t.bulkImport.noneDetected
          : t.bulkImport.found(entries.length, entries.map((entry) => entry.label).join(", "))}
      </p>
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={entries.length === 0}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.bulkImport.importButton(entries.length)}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
