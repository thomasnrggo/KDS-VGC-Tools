"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "../Modal";
import { useMessages } from "@/hooks/useLanguage";
import { REGULATIONS } from "@/data/regulations";
import { Button } from "@/components/Button";

const INPUT_CLASSES =
  "w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

interface CreateGroupDialogProps {
  defaultRegulationId: string;
  /** Resolves when the group exists; a rejection shows an error and keeps the dialog open. */
  onCreate: (name: string, regulationId: string) => Promise<void>;
  onClose: () => void;
}

/** "New prep group": a name and the event's regulation (see docs/prep-groups.md). */
export function CreateGroupDialog({
  defaultRegulationId,
  onCreate,
  onClose,
}: CreateGroupDialogProps) {
  const t = useMessages();
  const [name, setName] = useState("");
  const [regulationId, setRegulationId] = useState(defaultRegulationId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await onCreate(name, regulationId);
    } catch (cause) {
      console.error("[prep group] create failed:", cause);
      setError(t.groups.actionFailed);
      setIsSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="create-group-title">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 id="create-group-title" className="text-lg font-semibold text-zinc-900">
          {t.groups.create.title}
        </h2>
        <p className="text-sm text-zinc-600">{t.groups.create.intro}</p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          {t.groups.create.name}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.groups.create.namePlaceholder}
            autoFocus
            className={INPUT_CLASSES}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          {t.groups.create.regulation}
          <select
            value={regulationId}
            onChange={(event) => setRegulationId(event.target.value)}
            className={INPUT_CLASSES}
          >
            {REGULATIONS.map((regulation) => (
              <option key={regulation.id} value={regulation.id}>
                {t.common.regulationLabel(regulation.label)}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!name.trim() || isSaving}
            className="rounded-full bg-chrome-600 px-5 py-2 text-sm font-medium text-white hover:bg-chrome-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? t.common.saving : t.groups.create.submit}
          </button>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
