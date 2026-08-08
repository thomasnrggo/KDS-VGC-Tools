"use client";

import { useState, type FormEvent } from "react";

interface OpponentFormProps {
  initialLabel?: string;
  initialPokepasteUrl?: string;
  initialRawPaste?: string;
  submitLabel?: string;
  onSubmit: (label: string, rawPaste: string, pokepasteUrl: string) => string | null;
  onCancel: () => void;
}

const INPUT_CLASSES =
  "w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function OpponentForm({
  initialLabel = "",
  initialPokepasteUrl = "",
  initialRawPaste = "",
  submitLabel = "Add opponent",
  onSubmit,
  onCancel,
}: OpponentFormProps) {
  const [label, setLabel] = useState(initialLabel);
  const [pokepasteUrl, setPokepasteUrl] = useState(initialPokepasteUrl);
  const [rawPaste, setRawPaste] = useState(initialRawPaste);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(onSubmit(label, rawPaste, pokepasteUrl));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder='Opponent name (e.g. "Blastoise Delphox - LenVGC")'
        aria-label="Opponent name"
        className={INPUT_CLASSES}
      />
      <input
        value={pokepasteUrl}
        onChange={(event) => setPokepasteUrl(event.target.value)}
        placeholder="Poképaste link (optional)"
        aria-label="Poképaste link (optional)"
        className={INPUT_CLASSES}
      />
      <textarea
        value={rawPaste}
        onChange={(event) => setRawPaste(event.target.value)}
        rows={12}
        placeholder="Paste their Pokémon Showdown team export here…"
        aria-label="Opponent's Pokémon Showdown team export"
        className={`${INPUT_CLASSES} resize-y p-3 font-mono`}
      />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          {submitLabel}
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
