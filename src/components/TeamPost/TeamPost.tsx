"use client";

import { useState, type ReactNode } from "react";
import { RichTextEditor, RichTextView } from "../RichTextEditor";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { hasRichText } from "@/lib/richText";
import { fetchPokepaste, isPokepasteUrl } from "@/lib/pokepaste/fetchPokepaste";
import { CopyButton } from "./ShareDialog";
import { useMessages } from "@/hooks/useLanguage";

export interface TeamPostContent {
  creator?: string;
  pokepasteUrl?: string;
  replicaCode?: string;
  overview?: string;
}

interface TeamPostProps extends TeamPostContent {
  name: string;
  /** The team's Showdown export — edited in the post's edit mode (owner only). */
  rawPaste?: string;
  /** Quiet status at the end of the details line — the shared page's "Open team sheet". */
  status?: string;
  /** The owner's controls — omit for a read-only post (a shared report). */
  owner?: {
    /**
     * `name` is always a non-empty, trimmed name; `rawPaste` is only set when
     * the paste changed (already resolved from a Poképaste link). Returns an
     * error message to keep the form open, or null when saved.
     */
    onSave: (content: TeamPostContent & { name: string; rawPaste?: string }) => string | null;
    onShare: () => void;
    shareLabel: string;
    /** The paste being edited (null when not editing) — lets the page preview the roster live. */
    onDraftPasteChange?: (paste: string | null) => void;
    /** Marks the Share icon with a dot — the owner's only sign the report is shared. */
    isShared: boolean;
  };
}

const INPUT_CLASSES =
  "w-full rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";
const ICON_BUTTON_CLASSES =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800";

function DetailsLine({
  creator,
  pokepasteUrl,
  replicaCode,
  status,
}: TeamPostContent & { status?: string }) {
  const t = useMessages();
  // A shared report shows a link someone else typed — only ever render a
  // real web link, never e.g. a javascript: URL.
  const safePokepasteUrl =
    pokepasteUrl && /^https?:\/\//i.test(pokepasteUrl) ? pokepasteUrl : undefined;
  const items: ReactNode[] = [];
  if (creator) {
    items.push(
      <span key="creator">
        {t.teamPost.by} <span className="font-medium text-zinc-800">{creator}</span>
      </span>,
    );
  }
  if (safePokepasteUrl) {
    items.push(
      <a
        key="pokepaste"
        href={safePokepasteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-zinc-800 hover:underline"
      >
        Poképaste
        <Icon name={IconName.OpenInNew} size={13} />
      </a>,
    );
  }
  if (replicaCode) {
    items.push(
      <span key="replica" className="inline-flex items-center gap-1">
        {t.teamPost.replicaCode}{" "}
        <span className="font-mono font-medium text-zinc-800">{replicaCode}</span>
        <CopyButton text={replicaCode} label={t.teamPost.copyReplicaCode} />
      </span>,
    );
  }
  if (status) items.push(<span key="status">{status}</span>);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-y-1 text-sm text-zinc-500">
      {items.map((item, index) => (
        <span key={index} className="inline-flex items-center">
          {index > 0 && <span className="mx-2 text-zinc-300">·</span>}
          {item}
        </span>
      ))}
    </div>
  );
}

/**
 * The team's "post" at the top of its report: the name as the title, a
 * details line (creator, Poképaste, replica code, sharing status) and the
 * overview as formatted text. The owner gets a Share icon and one Edit
 * that turns the whole card into a form — details fields and the overview's
 * rich text editor — until Save or Cancel. A shared report shows the same
 * card without the controls.
 */
export function TeamPost({ name, rawPaste = "", status, owner, ...content }: TeamPostProps) {
  const t = useMessages();
  const [draft, setDraft] = useState<
    (TeamPostContent & { name: string; rawPaste: string }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!owner && draft !== null;
  const hasOverview = hasRichText(content.overview);
  const isEmpty =
    !content.creator && !content.pokepasteUrl && !content.replicaCode && !hasOverview;

  function startEditing() {
    setError(null);
    setDraft({
      name,
      rawPaste,
      creator: content.creator ?? "",
      pokepasteUrl: content.pokepasteUrl ?? "",
      replicaCode: content.replicaCode ?? "",
      overview: content.overview ?? "",
    });
  }

  function stopEditing() {
    setDraft(null);
    setError(null);
    owner?.onDraftPasteChange?.(null);
  }

  async function save() {
    if (!owner || !draft) return;
    let paste = draft.rawPaste ?? "";
    let pokepasteUrl = draft.pokepasteUrl?.trim() || undefined;
    // A Poképaste link in the paste box is fetched and replaced by its
    // export, like adding a team — and fills in the link if it's empty.
    if (isPokepasteUrl(paste.trim())) {
      setIsSaving(true);
      setError(null);
      try {
        const data = await fetchPokepaste(paste.trim());
        pokepasteUrl ??= paste.trim();
        paste = data.paste;
        setDraft({ ...draft, rawPaste: paste, pokepasteUrl });
        owner.onDraftPasteChange?.(paste);
      } catch (fetchError) {
        setIsSaving(false);
        setError(fetchError instanceof Error ? fetchError.message : t.errors.pokepasteFailed);
        return;
      }
      setIsSaving(false);
    }
    const saveError = owner.onSave({
      // A cleared title keeps the current name rather than leaving the team unnamed.
      name: (draft.name ?? "").trim() || name,
      rawPaste: paste.trim() !== rawPaste.trim() ? paste : undefined,
      creator: draft.creator?.trim() || undefined,
      pokepasteUrl,
      replicaCode: draft.replicaCode?.trim() || undefined,
      overview: hasRichText(draft.overview) ? draft.overview : undefined,
    });
    if (saveError) {
      setError(saveError);
      return;
    }
    stopEditing();
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex min-w-0 flex-col gap-1 ${isEditing ? "flex-1" : ""}`}>
          {isEditing && draft ? (
            <input
              value={draft.name ?? ""}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              form="team-post-form"
              aria-label={t.teamPost.teamName}
              placeholder={name}
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-2xl font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          ) : (
            <h1 className="truncate text-2xl font-semibold text-zinc-900">{name}</h1>
          )}
          {!isEditing && <DetailsLine {...content} status={status} />}
        </div>
        {owner && !isEditing && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={owner.onShare}
              aria-label={owner.shareLabel}
              title={owner.shareLabel}
              className={`relative ${ICON_BUTTON_CLASSES}`}
            >
              <Icon name={IconName.Share} size={16} />
              {owner.isShared && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-50 bg-green-600"
                />
              )}
            </button>
            <button
              type="button"
              onClick={startEditing}
              aria-label={t.teamPost.editPost}
              title={t.common.edit}
              className={ICON_BUTTON_CLASSES}
            >
              <Icon name={IconName.Edit} size={16} />
            </button>
          </div>
        )}
      </div>

      {isEditing && draft ? (
        <form
          id="team-post-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              {t.teamPost.creator}
              <input
                value={draft.creator ?? ""}
                onChange={(event) => setDraft({ ...draft, creator: event.target.value })}
                placeholder={t.teamPost.creatorPlaceholder}
                className={INPUT_CLASSES}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              {t.teamPost.pokepasteLink}
              <input
                type="url"
                value={draft.pokepasteUrl ?? ""}
                onChange={(event) => setDraft({ ...draft, pokepasteUrl: event.target.value })}
                placeholder="https://pokepast.es/…"
                className={INPUT_CLASSES}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              {t.teamPost.replicaCode}
              <input
                value={draft.replicaCode ?? ""}
                onChange={(event) => setDraft({ ...draft, replicaCode: event.target.value })}
                placeholder={t.teamPost.replicaPlaceholder}
                className={`${INPUT_CLASSES} font-mono`}
              />
            </label>
          </div>
          <span className="-mb-2 text-xs font-medium text-zinc-600">{t.teamPost.overview}</span>
          <RichTextEditor
            value={draft.overview ?? ""}
            onChange={(overview) => setDraft((prev) => (prev ? { ...prev, overview } : prev))}
            placeholder={t.teamPost.overviewPlaceholder}
            ariaLabel={t.teamPost.overview}
          />
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            {t.teamPost.teamPaste}
            <textarea
              value={draft.rawPaste ?? ""}
              onChange={(event) => {
                setDraft({ ...draft, rawPaste: event.target.value });
                owner?.onDraftPasteChange?.(event.target.value);
              }}
              rows={10}
              placeholder={t.teamPaste.pastePlaceholder}
              className={`${INPUT_CLASSES} resize-y font-mono`}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-zinc-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-400 dark:hover:bg-zinc-300"
            >
              {isSaving ? t.teamPost.loadingPokepaste : t.common.save}
            </button>
            <button
              type="button"
              onClick={stopEditing}
              className="rounded-full border border-zinc-300 px-5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {t.common.cancel}
            </button>
          </div>
        </form>
      ) : hasOverview ? (
        <RichTextView html={content.overview ?? ""} className="leading-relaxed" />
      ) : (
        owner &&
        isEmpty && (
          <button
            type="button"
            onClick={startEditing}
            className="self-start text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
          >
            {t.teamPost.emptyPrompt}
          </button>
        )
      )}
    </article>
  );
}
