"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PokemonSprite } from "../PokemonSprite";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useViewportSafePosition } from "@/hooks/useViewportSafePosition";
import { useMessages } from "@/hooks/useLanguage";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { useIsPhone } from "@/hooks/useIsPhone";
import { FLOW_FIELD, focusNextFlowField, isInFlow } from "@/lib/fieldFlow";
import { PickerSheet, pickerSheetSearchClassName } from "../PickerSheet";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  /** Stable key AND the value handed back to onSelect. */
  id: string;
  /** Displayed as the input's current text once picked, and what substring search filters against — always plain text, even when `content` renders something richer. */
  label: string;
  /** Also matched by the search, besides `label` — the English name when the label is translated, so either finds it. */
  searchText?: string;
  /** Species name to render a sprite next to the label (species search) — ignored when `content` is set. */
  sprite?: string;
  /** Custom rendering for this option's row in the dropdown (e.g. a Showdown-style move/species/item card with type/stats/description) — defaults to a plain `label` (with optional `sprite` thumbnail) when omitted. Built by the caller, since only it knows the shape of whatever data (MoveData, base stats, item/ability descriptions, ...) the row needs. */
  content?: ReactNode;
  /**
   * An action row instead of a value (e.g. "Show all moves"): listed last
   * whatever's typed, and picking it keeps the list open (the caller changes
   * `options`) rather than closing or moving on.
   */
  action?: boolean;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  placeholder: string;
  onSelect: (option: SearchableSelectOption) => void;
  ariaLabel: string;
  autoFocus?: boolean;
  /** Shows this as the input's current text (e.g. an already-picked move) instead of starting empty — clicking/focusing the input re-opens the dropdown with every option available and selects the existing text, so typing (or just picking a new result) replaces it in one step instead of needing to clear the slot first. */
  value?: string;
  /**
   * The picked option's id, when its label isn't exactly `value` (a hidden
   * ability's or Mega Stone's label carries a note) — so the list opens
   * highlighting it, and Enter keeps it instead of picking the first row.
   */
  selectedId?: string;
  /** Smaller padding/font size for tight inline contexts (e.g. the ability/nature row) — same behavior, just sized to sit next to other small controls instead of taking a full-width form row. */
  compact?: boolean;
  /**
   * For narrow grid cells (the phone's 2×2 moves): on phones a long label
   * wraps onto two lines instead of being cut off, and clearing moves from
   * the inline "×" into a "Remove" row at the top of the sheet.
   */
  narrow?: boolean;
  /** Shows an inline "×" button inside the input's right edge (visible only when `value` is set) that clears the selection — an alternative to the caller rendering its own clear button next to the field. */
  onClear?: () => void;
  /**
   * Leave this field out of the keyboard flow (see src/lib/fieldFlow.ts) — e.g.
   * the calculator's Status, which isn't part of filling in a set.
   */
  skipFlow?: boolean;
}

const MAX_VISIBLE_RESULTS = 30;

/**
 * On a phone, lists this short (abilities, natures) open without focusing the
 * search, so the keyboard doesn't cover options you can just tap.
 */
const SHORT_LIST_LENGTH = 30;

/** Lists this short (a species' abilities) skip the search field altogether. */
const TINY_LIST_LENGTH = 8;

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
  selectedId,
  compact,
  narrow,
  onClear,
  skipFlow,
}: SearchableSelectProps) {
  const t = useMessages();
  const [query, setQuery] = useState(value ?? "");
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setQuery(value ?? "");
  }
  const [isOpen, setIsOpen] = useState(false);
  // The keyboard-highlighted row (arrow keys), picked by Enter.
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [dropdownWidth, setDropdownWidth] = useState<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // How the input was last pressed — see its onFocus.
  const pointerTypeRef = useRef<string>("");
  const style = useViewportSafePosition(isOpen, triggerRef, dropdownRef);
  const isPhone = useIsPhone();

  // Matches the dropdown's width to the input's — read inside an effect
  // (not during render) since reading a ref's .current synchronously while
  // rendering isn't allowed under React Compiler.
  useEffect(() => {
    if (isOpen) setDropdownWidth(triggerRef.current?.offsetWidth);
  }, [isOpen]);

  useEffect(() => {
    // The phone sheet is portaled outside the container and has its own close.
    if (!isOpen || isPhone) return;

    // Closing without a pick puts the current value back if the field was
    // emptied for a touch search (see the input's onFocus).
    function close() {
      setIsOpen(false);
      setQuery((current) => (current === "" ? (value ?? "") : current));
    }
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isPhone, value]);

  // Until the user actually types something different, the query is just
  // the untouched `value` prop echoed back — treated as "no filter yet" so
  // opening a slot that already has a pick shows every option (browsable),
  // not a narrow self-match. Once they type, normal substring filtering
  // takes over.
  const trimmed = query === value ? "" : foldForSearch(query.trim());
  const isCurrent = (option: SearchableSelectOption) =>
    selectedId !== undefined ? option.id === selectedId : option.label === value;
  const choices = options.filter((option) => !option.action);
  const actions = options.filter((option) => option.action);
  const matching = (
    trimmed
      ? choices.filter(
          (o) =>
            foldForSearch(o.label).includes(trimmed) ||
            (!!o.searchText && foldForSearch(o.searchText).includes(trimmed)),
        )
      : choices
  ).slice(0, MAX_VISIBLE_RESULTS);
  // Unfiltered, the current pick stays listed even past the first results,
  // so it's the highlighted row and Enter keeps it.
  const current = !trimmed && value ? choices.find(isCurrent) : undefined;
  const shown =
    current && !matching.includes(current)
      ? [current, ...matching.slice(0, MAX_VISIBLE_RESULTS - 1)]
      : matching;
  const filtered = [...shown, ...actions];

  // Keeps the highlighted row in view while arrowing through.
  useEffect(() => {
    if (!isOpen) return;
    dropdownRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]);

  /** `fromKeyboard`: an Enter pick, which moves on to the next field in the flow. */
  function pick(option: SearchableSelectOption, fromKeyboard = false) {
    onSelect(option);
    // An action row changes the list; it stays open, the search as typed.
    if (option.action) {
      setActiveIndex(0);
      return;
    }
    if (fromKeyboard && !skipFlow) focusNextFlowField(inputRef.current);
    // A field showing a value shows the pick (re-picking the same one doesn't
    // change `value`, so the sync above wouldn't refill it); a plain search
    // field starts empty again.
    setQuery(value !== undefined ? option.label : "");
    setIsOpen(false);
  }

  if (isPhone) {
    return (
      <PhoneSelect
        options={options}
        filtered={filtered}
        query={query}
        onQueryChange={setQuery}
        isOpen={isOpen}
        onOpen={() => {
          setQuery("");
          setIsOpen(true);
        }}
        onClose={() => {
          setQuery(value ?? "");
          setIsOpen(false);
        }}
        onPick={pick}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        value={value}
        compact={compact}
        narrow={narrow}
        onClear={onClear}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div ref={triggerRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          {...(skipFlow ? {} : FLOW_FIELD)}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!isOpen) {
                setIsOpen(true);
                return;
              }
              const last = filtered.length - 1;
              setActiveIndex((index) =>
                event.key === "ArrowDown" ? Math.min(index + 1, last) : Math.max(index - 1, 0),
              );
            } else if (event.key === "Enter" && isOpen && filtered[activeIndex]) {
              // Typing then Enter picks the top result; arrowing first picks that row.
              event.preventDefault();
              pick(filtered[activeIndex], true);
            } else if (event.key === "Escape" && isOpen) {
              setIsOpen(false);
              setQuery(value ?? "");
            } else if (
              event.key === "Tab" &&
              !event.shiftKey &&
              isOpen &&
              filtered[activeIndex] &&
              !filtered[activeIndex].action &&
              !isCurrent(filtered[activeIndex]) &&
              !skipFlow &&
              isInFlow(inputRef.current)
            ) {
              // In a flow, Tab picks like Enter (a field still showing its
              // pick just tabs on); past the last field Tab goes on as usual.
              pick(filtered[activeIndex]);
              if (focusNextFlowField(inputRef.current)) event.preventDefault();
            } else if (event.key === "Tab") {
              // Tabbing on leaves the list closed behind you.
              setIsOpen(false);
              setQuery((current) => (current === "" ? (value ?? "") : current));
            }
          }}
          onPointerDown={(event) => {
            pointerTypeRef.current = event.pointerType;
          }}
          onFocus={(event) => {
            setIsOpen(true);
            // Starts on the current pick, so arrowing moves from there.
            setActiveIndex(Math.max(0, filtered.findIndex(isCurrent)));
            if (pointerTypeRef.current === "touch") {
              // A touch tap on selected text opens the device's text menu
              // (iPadOS's Cut/Copy/Look Up bar; Chrome's context menu in its
              // touch emulation), so on touch the field is emptied instead,
              // the current pick showing as the placeholder until you type.
              setQuery("");
            } else {
              // Selects the existing text (if any) so it opens ready to
              // either type-to-replace or just pick a different result —
              // no separate "clear this slot" step needed first.
              event.target.select();
            }
            pointerTypeRef.current = "";
          }}
          placeholder={value || placeholder}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          className={
            compact
              ? `w-full rounded-lg border border-zinc-300 bg-zinc-50 py-1 pl-2 text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none ${onClear ? "pr-6" : "pr-2"}`
              : `w-full rounded-lg border border-zinc-300 bg-zinc-50 py-2 pl-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none ${onClear ? "pr-8" : "pr-2"}`
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
            aria-label={t.editor.clear(ariaLabel)}
            className={
              compact
                ? "absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                : "absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            }
          >
            <Icon name={IconName.Close} size={compact ? 10 : 12} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{ ...style, width: dropdownWidth }}
          className="z-20 max-h-96 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-1 shadow-lg"
        >
          {/* Only action rows left ("Show all moves"): say so above them. */}
          {filtered.every((option) => option.action) && (
            <p className="p-2 text-xs text-zinc-500">{t.editor.noMatches}</p>
          )}
          {filtered.map((option, index) => (
            <button
              key={option.id}
              id={`${listId}-${index}`}
              data-option-index={index}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              // Not a tab stop: the input keeps the focus, the arrow keys move the highlight.
              tabIndex={-1}
              // Keeps the focus in the input, so the click doesn't blur it first.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(option)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md text-left text-zinc-900 focus:outline-none",
                compact ? "p-1 text-xs" : "p-1.5 text-sm",
                index === activeIndex && "bg-zinc-200/70",
              )}
            >
              {option.content ?? (
                <>
                  {option.sprite && (
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-50">
                      <PokemonSprite species={option.sprite} fill />
                    </span>
                  )}
                  <span className="truncate">{option.label}</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PhoneSelectProps {
  options: SearchableSelectOption[];
  filtered: SearchableSelectOption[];
  query: string;
  onQueryChange: (query: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (option: SearchableSelectOption) => void;
  placeholder: string;
  ariaLabel: string;
  value?: string;
  compact?: boolean;
  narrow?: boolean;
  onClear?: () => void;
}

/**
 * SearchableSelect on a phone: a button showing the current pick (so tapping
 * it doesn't raise the keyboard over the page) that opens a full-screen
 * sheet with the search and roomier rows.
 */
function PhoneSelect({
  options,
  filtered,
  query,
  onQueryChange,
  isOpen,
  onOpen,
  onClose,
  onPick,
  placeholder,
  ariaLabel,
  value,
  compact,
  narrow,
  onClear,
}: PhoneSelectProps) {
  const t = useMessages();
  const inlineClear = !!onClear && !!value && !narrow;
  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={ariaLabel}
          className={cn(
            "flex w-full items-center rounded-lg border border-zinc-300 bg-zinc-50 pl-2 text-left text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none",
            compact
              ? "min-h-8 py-1 text-xs"
              : narrow
                ? "min-h-12 py-1 text-sm leading-tight"
                : "min-h-10 py-2 text-sm",
            inlineClear ? (compact ? "pr-7" : "pr-9") : "pr-2",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1",
              narrow ? "line-clamp-2 break-words" : "truncate",
              value ? "" : "text-zinc-500",
            )}
          >
            {value || placeholder}
          </span>
        </button>
        {inlineClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label={t.editor.clear(ariaLabel)}
            className={cn(
              "absolute top-1/2 right-0.5 flex -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600",
              compact ? "h-7 w-7" : "h-9 w-9",
            )}
          >
            <Icon name={IconName.Close} size={compact ? 12 : 14} />
          </button>
        )}
      </div>

      {isOpen && (
        <PickerSheet
          title={ariaLabel}
          onClose={onClose}
          search={
            options.length > TINY_LIST_LENGTH && (
              <input
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && filtered[0]) {
                    event.preventDefault();
                    onPick(filtered[0]);
                  }
                }}
                placeholder={placeholder}
                aria-label={ariaLabel}
                autoFocus={options.length > SHORT_LIST_LENGTH}
                enterKeyHint="done"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className={pickerSheetSearchClassName}
              />
            )
          }
        >
          <div role="listbox" aria-label={ariaLabel} className="flex flex-col gap-0.5">
            {narrow && onClear && value && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  onClose();
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-red-600 active:bg-zinc-200"
              >
                <Icon name={IconName.Close} size={16} />
                {t.editor.removeValue(value)}
              </button>
            )}
            {/* Only action rows left ("Show all moves"): say so above them. */}
            {filtered.every((option) => option.action) && (
              <p className="p-3 text-sm text-zinc-500">{t.editor.noMatches}</p>
            )}
            {filtered.map((option) => {
              const isCurrent = !!value && option.label === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => onPick(option)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-900 active:bg-zinc-200",
                    isCurrent && "bg-zinc-100 font-semibold",
                  )}
                >
                  {option.content ?? (
                    <>
                      {option.sprite && (
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-50">
                          <PokemonSprite species={option.sprite} fill />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </>
                  )}
                  {isCurrent && <Icon name={IconName.Check} size={16} />}
                </button>
              );
            })}
          </div>
        </PickerSheet>
      )}
    </>
  );
}
