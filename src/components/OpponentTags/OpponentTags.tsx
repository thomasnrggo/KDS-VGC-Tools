"use client";

import { useId, useRef, useState } from "react";
import { addTag, removeTag } from "@/lib/opponentTags";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

interface OpponentTagsProps {
  tags: string[];
  /** Strategy tags detected from the team (see suggestTags) — offered while editing, never applied automatically. */
  suggestions: string[];
  /** Every tag already used in this regulation, for the input's autocomplete. */
  knownTags: string[];
  onChange: (tags: string[]) => void;
  /** Highlights a chip that matches the current search, like TeamRoster's isMatch does for sprites. */
  isMatch?: (tag: string) => boolean;
  className?: string;
}

const CHIP_CLASSES =
  "flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium";

/**
 * A row of tag chips plus an "+ Tag" button that opens an inline input —
 * suggestions only appear while that input is open, so 13+ rows of opponents
 * don't each carry a cluster of dashed "maybe" chips all the time.
 */
export function OpponentTags({
  tags,
  suggestions,
  knownTags,
  onChange,
  isMatch,
  className = "",
}: OpponentTagsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const datalistId = useId();

  const openSuggestions = suggestions.filter((tag) => !tags.includes(tag));
  const autocomplete = knownTags.filter((tag) => !tags.includes(tag));

  function commitDraft() {
    const next = addTag(tags, draft);
    if (next !== tags) onChange(next);
    setDraft("");
  }

  function close() {
    setDraft("");
    setIsEditing(false);
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={`${CHIP_CLASSES} ${
            isMatch?.(tag)
              ? "border-zinc-600 bg-zinc-600 text-white"
              : "border-zinc-300 bg-zinc-50 text-zinc-700"
          }`}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(removeTag(tags, tag))}
            aria-label={`Remove tag ${tag}`}
            title="Remove tag"
            className="-mr-1 flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:opacity-100"
          >
            <Icon name={IconName.Close} size={12} />
          </button>
        </span>
      ))}

      {isEditing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
              } else if (event.key === "Escape") {
                close();
              }
            }}
            // Clicking a suggestion chip blurs the input first — let that
            // click land (mousedown preventDefault on the chips below) rather
            // than closing the editor out from under it.
            onBlur={() => {
              commitDraft();
              setIsEditing(false);
            }}
            list={datalistId}
            autoFocus
            placeholder="Add tag…"
            aria-label="New tag"
            className="h-6 w-28 rounded-full border border-zinc-300 bg-zinc-50 px-2 text-xs text-zinc-700 outline-none focus:border-zinc-500"
          />
          <datalist id={datalistId}>
            {autocomplete.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          {openSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(addTag(tags, tag));
                inputRef.current?.focus();
              }}
              title="Suggested from this team"
              className={`${CHIP_CLASSES} border-dashed border-zinc-400 text-zinc-500 hover:border-zinc-600 hover:text-zinc-700`}
            >
              <Icon name={IconName.Add} size={12} />
              {tag}
            </button>
          ))}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          title={
            openSuggestions.length > 0
              ? `Add a tag (suggested: ${openSuggestions.join(", ")})`
              : "Add a tag"
          }
          className={`${CHIP_CLASSES} border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-500 hover:text-zinc-700`}
        >
          <Icon name={IconName.Add} size={12} />
          Tag
          {openSuggestions.length > 0 && (
            <span className="text-zinc-400">· {openSuggestions.length} suggested</span>
          )}
        </button>
      )}
    </div>
  );
}
