"use client";

import { useState, type FormEvent } from "react";

interface TeamPasteFormProps {
  initialName?: string;
  initialValue?: string;
  onSubmit: (raw: string, name: string) => string | null;
  onCancel?: () => void;
}

export function TeamPasteForm({
  initialName = "",
  initialValue = "",
  onSubmit,
  onCancel,
}: TeamPasteFormProps) {
  const [name, setName] = useState(initialName);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(onSubmit(value, name));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Team name (e.g. Regionals Team)"
        aria-label="Team name"
        className="w-full rounded-lg border border-mauve-300 bg-white p-2 text-sm text-mauve-900 focus:outline-none focus:ring-2 focus:ring-mauve-400"
      />
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={16}
        placeholder="Paste your Pokémon Showdown team export here…"
        aria-label="Pokémon Showdown team export"
        className="w-full resize-y rounded-lg border border-mauve-300 bg-white p-3 font-mono text-sm text-mauve-900 focus:outline-none focus:ring-2 focus:ring-mauve-400"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
        >
          Save team
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
