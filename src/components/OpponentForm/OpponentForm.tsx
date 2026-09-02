"use client";

import { useState, type FormEvent } from "react";
import { fetchPokepaste, isPokepasteUrl } from "@/lib/pokepaste/fetchPokepaste";

interface OpponentFormProps {
  initialLabel?: string;
  initialPokepasteUrl?: string;
  initialRawPaste?: string;
  submitLabel?: string;
  /** Set false when the caller already provides a bordered container (e.g. a Modal), to avoid a card-in-a-card look. */
  bordered?: boolean;
  onSubmit: (
    label: string,
    rawPaste: string,
    pokepasteUrl: string,
  ) => string | null;
  onCancel: () => void;
}

const INPUT_CLASSES =
  "w-full rounded-lg border border-mauve-300 bg-white p-2 text-sm text-mauve-900 focus:outline-none focus:ring-2 focus:ring-mauve-400";

export function OpponentForm({
  initialLabel = "",
  initialPokepasteUrl = "",
  initialRawPaste = "",
  submitLabel = "Add opponent",
  bordered = true,
  onSubmit,
  onCancel,
}: OpponentFormProps) {
  const [label, setLabel] = useState(initialLabel);
  const [pokepasteUrl, setPokepasteUrl] = useState(initialPokepasteUrl);
  const [rawPaste, setRawPaste] = useState(initialRawPaste);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // A bare link in the paste box takes priority; otherwise fall back to
    // fetching the Poképaste link field if the paste box was left empty —
    // so filling in just the link (which is needed anyway for the "Open
    // Poképaste" button) is enough to also import the roster.
    const linkToResolve = isPokepasteUrl(rawPaste)
      ? rawPaste
      : !rawPaste.trim() && isPokepasteUrl(pokepasteUrl)
        ? pokepasteUrl
        : null;

    let pasteText = rawPaste;
    let resolvedLabel = label;
    let resolvedPokepasteUrl = pokepasteUrl;

    if (linkToResolve) {
      setIsFetching(true);
      setError(null);
      try {
        const data = await fetchPokepaste(linkToResolve);
        pasteText = data.paste;
        if (!resolvedLabel.trim() && data.title) {
          resolvedLabel = data.title;
        }
        if (!resolvedPokepasteUrl.trim()) {
          resolvedPokepasteUrl = linkToResolve;
        }
        setRawPaste(pasteText);
        setLabel(resolvedLabel);
        setPokepasteUrl(resolvedPokepasteUrl);
      } catch (fetchError) {
        setIsFetching(false);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Couldn't load that Poképaste.",
        );
        return;
      }
      setIsFetching(false);
    }

    setError(onSubmit(resolvedLabel, pasteText, resolvedPokepasteUrl));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col gap-3 ${bordered ? "rounded-lg border border-mauve-200 p-4" : ""}`}
    >
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder='Opponent name (e.g. "Sand toxapex - Wolfey")'
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
        placeholder="Paste their Pokémon Showdown team export here… (or a Poképaste link)"
        aria-label="Opponent's Pokémon Showdown team export or Poképaste link"
        className={`${INPUT_CLASSES} resize-y p-3 font-mono`}
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isFetching}
          className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFetching ? "Loading…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
