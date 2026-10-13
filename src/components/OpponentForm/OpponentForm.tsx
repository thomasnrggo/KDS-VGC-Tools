"use client";

import { useState, type FormEvent } from "react";
import { fetchPokepaste, isPokepasteUrl } from "@/lib/pokepaste/fetchPokepaste";
import { useMessages } from "@/hooks/useLanguage";

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
  "w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

export function OpponentForm({
  initialLabel = "",
  initialPokepasteUrl = "",
  initialRawPaste = "",
  submitLabel,
  bordered = true,
  onSubmit,
  onCancel,
}: OpponentFormProps) {
  const t = useMessages();
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
            : t.errors.pokepasteFailed,
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
      className={`flex flex-col gap-3 ${bordered ? "rounded-lg border border-zinc-200 p-4" : ""}`}
    >
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={t.opponentForm.namePlaceholder}
        aria-label={t.opponentForm.nameLabel}
        className={INPUT_CLASSES}
      />
      <input
        value={pokepasteUrl}
        onChange={(event) => setPokepasteUrl(event.target.value)}
        placeholder={t.opponentForm.pokepastePlaceholder}
        aria-label={t.opponentForm.pokepastePlaceholder}
        className={INPUT_CLASSES}
      />
      <textarea
        value={rawPaste}
        onChange={(event) => setRawPaste(event.target.value)}
        rows={12}
        placeholder={t.opponentForm.pastePlaceholder}
        aria-label={t.opponentForm.pasteLabel}
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
          className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFetching ? t.common.loading : (submitLabel ?? t.opponents.add)}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
