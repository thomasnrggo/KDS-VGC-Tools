"use client";

import { useEffect, useRef, useState } from "react";
import { PokemonSprite } from "../PokemonSprite";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useViewportSafePosition } from "@/hooks/useViewportSafePosition";

export interface SearchableSelectOption {
  /** Stable key AND the value handed back to onSelect. */
  id: string;
  label: string;
  /** Species name to render a sprite next to the label (species search) — omitted for options with no natural icon (move search). */
  sprite?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  placeholder: string;
  onSelect: (option: SearchableSelectOption) => void;
  ariaLabel: string;
  autoFocus?: boolean;
  /** Shows this as the input's current text (e.g. an already-picked move) instead of starting empty — clicking/focusing the input re-opens the dropdown with every option available and selects the existing text, so typing (or just picking a new result) replaces it in one step instead of needing to clear the slot first. */
  value?: string;
  /** Smaller padding/font size for tight inline contexts (e.g. the ability/nature row) — same behavior, just sized to sit next to other small controls instead of taking a full-width form row. */
  compact?: boolean;
  /** Shows an inline "×" button inside the input's right edge (visible only when `value` is set) that clears the selection — an alternative to the caller rendering its own clear button next to the field. */
  onClear?: () => void;
}

const MAX_VISIBLE_RESULTS = 30;

/**
 * A single reusable text-input-driven combobox — filters `options` by
 * substring match against `label` as the user types, click-outside/Escape
 * to close (mirrors PokemonSlotPicker.tsx's dropdown pattern, including
 * reusing useViewportSafePosition so it clamps to the viewport the same
 * way). With no `value`, it's uncontrolled/stateless from the caller's
 * perspective — starts empty and resets after a pick (e.g. a fresh "add a
 * Pokémon" search). With `value`, it displays and lets you directly replace
 * an existing selection (e.g. an already-picked move) — internally still a
 * local, editable text buffer (not a controlled input), synced back to
 * `value` only when the prop itself changes (switching which slot/Pokémon is
 * shown), via React's documented "adjust state when a prop changes" pattern.
 */
export function SearchableSelect({
  options,
  placeholder,
  onSelect,
  ariaLabel,
  autoFocus,
  value,
  compact,
  onClear,
}: SearchableSelectProps) {
  const [query, setQuery] = useState(value ?? "");
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setQuery(value ?? "");
  }
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownWidth, setDropdownWidth] = useState<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const style = useViewportSafePosition(isOpen, triggerRef, dropdownRef);

  // Matches the dropdown's width to the input's — read inside an effect
  // (not during render) since reading a ref's .current synchronously while
  // rendering isn't allowed under React Compiler.
  useEffect(() => {
    if (isOpen) setDropdownWidth(triggerRef.current?.offsetWidth);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Until the user actually types something different, the query is just
  // the untouched `value` prop echoed back — treated as "no filter yet" so
  // opening a slot that already has a pick shows every option (browsable),
  // not a narrow self-match. Once they type, normal substring filtering
  // takes over.
  const trimmed = query === value ? "" : query.trim().toLowerCase();
  const filtered = (
    trimmed ? options.filter((o) => o.label.toLowerCase().includes(trimmed)) : options
  ).slice(0, MAX_VISIBLE_RESULTS);

  function pick(option: SearchableSelectOption) {
    onSelect(option);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div ref={triggerRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={(event) => {
            setIsOpen(true);
            // Selects the existing text (if any) so it opens ready to
            // either type-to-replace or just pick a different result —
            // no separate "clear this slot" step needed first.
            event.target.select();
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          className={
            compact
              ? `w-full rounded border border-mauve-300 bg-white py-0.5 pl-1 text-xs text-mauve-900 focus:outline-none focus:ring-2 focus:ring-mauve-400 ${onClear ? "pr-5" : "pr-1"}`
              : `w-full rounded-lg border border-mauve-300 bg-white py-2 pl-2 text-sm text-mauve-900 focus:outline-none focus:ring-2 focus:ring-mauve-400 ${onClear ? "pr-8" : "pr-2"}`
          }
        />
        {onClear && value && (
          <button
            type="button"
            onClick={(event) => {
              // Clearing shouldn't also open the dropdown via the input's
              // own onFocus, and shouldn't count as a click-outside either
              // (this button lives inside containerRef already, so it
              // wouldn't anyway, but stopping here keeps the intent explicit).
              event.stopPropagation();
              onClear();
              setIsOpen(false);
            }}
            aria-label={`Clear ${ariaLabel}`}
            className={
              compact
                ? "absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-mauve-400 hover:bg-mauve-100 hover:text-mauve-600"
                : "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-mauve-400 hover:bg-mauve-100 hover:text-mauve-600"
            }
          >
            <Icon name={IconName.Close} size={compact ? 10 : 12} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{ ...style, width: dropdownWidth }}
          className="z-20 max-h-72 overflow-y-auto rounded-lg border border-mauve-200 bg-white p-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="p-2 text-xs text-mauve-500">No matches.</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pick(option)}
                className={
                  compact
                    ? "flex w-full items-center gap-2 rounded-md p-1 text-left text-xs text-mauve-900 hover:bg-mauve-100 focus:outline-none focus:ring-2 focus:ring-mauve-400"
                    : "flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm text-mauve-900 hover:bg-mauve-100 focus:outline-none focus:ring-2 focus:ring-mauve-400"
                }
              >
                {option.sprite && (
                  <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-mauve-50">
                    <PokemonSprite species={option.sprite} fill />
                  </span>
                )}
                <span className="truncate">{option.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
