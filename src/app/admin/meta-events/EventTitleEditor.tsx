"use client";

import { useState } from "react";
import { Button, TextAction } from "@/components/Button";

const FIELD_CLASSES =
  "min-w-0 flex-1 rounded-lg border border-zinc-300 bg-field px-3 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none";

/**
 * Renaming one event at /admin/meta-events: its title in a field, Save,
 * Cancel, and — once renamed — Use the original. `onSave` gets the new title,
 * or null for the original; it throws on failure (the field stays open).
 */
export function EventTitleEditor({
  title,
  original,
  onSave,
  onClose,
}: {
  title: string;
  /** The event's own title when it's been renamed. */
  original?: string;
  onSave: (title: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const trimmed = value.trim();

  async function save(next: string | null) {
    setIsSaving(true);
    try {
      await onSave(next);
      onClose();
    } catch {
      // onSave reports it; keep the field open to try again.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed && trimmed !== title) save(trimmed === original ? null : trimmed);
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        maxLength={120}
        aria-label="Event title"
        className={FIELD_CLASSES}
      />
      <Button
        type="submit"
        disabled={isSaving || !trimmed || trimmed === title}
        className="py-1.5 text-sm"
      >
        {isSaving ? "Saving…" : "Save"}
      </Button>
      <Button variant="outline" onClick={onClose} className="py-1.5 text-sm">
        Cancel
      </Button>
      {original && (
        <TextAction onClick={() => save(null)} disabled={isSaving}>
          Use the original ({original})
        </TextAction>
      )}
    </form>
  );
}
