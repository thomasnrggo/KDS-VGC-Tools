"use client";

import { useState, type FormEvent } from "react";
import { fetchPokepaste, isPokepasteUrl } from "@/lib/pokepaste/fetchPokepaste";
import { useMessages } from "@/hooks/useLanguage";
import { Button } from "@/components/Button";

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
  const t = useMessages();
  const [name, setName] = useState(initialName);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    let pasteText = value;
    let resolvedName = name;

    if (isPokepasteUrl(value)) {
      setIsFetching(true);
      setError(null);
      try {
        const data = await fetchPokepaste(value);
        pasteText = data.paste;
        if (!resolvedName.trim() && data.title) {
          resolvedName = data.title;
        }
        setValue(pasteText);
        setName(resolvedName);
      } catch (fetchError) {
        setIsFetching(false);
        setError(fetchError instanceof Error ? fetchError.message : t.errors.pokepasteFailed);
        return;
      }
      setIsFetching(false);
    }

    setError(onSubmit(pasteText, resolvedName));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t.teamPaste.namePlaceholder}
        aria-label={t.teamPaste.nameLabel}
        className="w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
      />
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={16}
        placeholder={t.teamPaste.pastePlaceholder}
        aria-label={t.teamPaste.pasteLabel}
        className="w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isFetching} className="disabled:cursor-not-allowed">
          {isFetching ? t.common.loading : t.teamPaste.saveTeam}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
