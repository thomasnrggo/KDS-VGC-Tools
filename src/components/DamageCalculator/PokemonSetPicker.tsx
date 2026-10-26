"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { CalcSet, ParsedPokemon } from "@/types";
import { FLOW_FIELD, focusNextFlowField } from "@/lib/fieldFlow";
import { SPECIES_OPTIONS, buildCustomPokemon } from "../PokemonEditor";
import { toast } from "../Toast";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useViewportSafePosition } from "@/hooks/useViewportSafePosition";
import { useIsPhone } from "@/hooks/useIsPhone";
import { PickerSheet, pickerSheetSearchClassName } from "../PickerSheet";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import {
  SetNameTakenError,
  type CalcSetKind,
  type CalcSetsApi,
  type SavedSetRef,
} from "@/hooks/useCalcSets";
import { cn } from "@/lib/utils";

/** Species groups rendered at once — the list is long, and typing narrows it. */
const MAX_VISIBLE_GROUPS = 60;

/** One pickable build under a species heading: the user's own sets, then public ones, then "Blank Set". */
interface SetOption {
  id: string;
  name: string;
  build: () => ParsedPokemon;
  /** Set only for saved sets — "Blank Set" has no kind and can't be renamed or deleted. */
  kind?: CalcSetKind;
}

interface SpeciesGroup {
  speciesKey: string;
  /** English display name — what gets stored, and searchable alongside the translated one. */
  englishName: string;
  label: string;
  sets: SetOption[];
}

interface PokemonSetPickerProps {
  /** The side's name, for aria labels ("Attacker"). */
  title: string;
  pokemon: ParsedPokemon | null;
  /** `fromSet` is set when a saved set (not "Blank Set") was picked. */
  onSelect: (pokemon: ParsedPokemon, fromSet?: SavedSetRef) => void;
  calcSets: CalcSetsApi;
}

/**
 * The Damage Calculator's species picker: a Showdown-style dropdown that
 * lists each species with its sets underneath, so choosing a Pokémon also
 * chooses its build. Deliberately lighter than the Team Builder's species
 * search (no abilities/base-stat rows) — in the calc you already know the
 * Pokémon; what you're picking is the set.
 */
function savedSetOption(set: CalcSet, kind: CalcSetKind): SetOption {
  return {
    id: `${kind}-${set.id}`,
    name: set.name,
    kind,
    build: () => ({ ...set.pokemon, moves: [...(set.pokemon.moves ?? [])] }),
  };
}

export function PokemonSetPicker({ title, pokemon, onSelect, calcSets }: PokemonSetPickerProps) {
  const t = useMessages();
  const text = usePokemonText();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [renaming, setRenaming] = useState<{ optionId: string; name: string } | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [dropdownWidth, setDropdownWidth] = useState<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const style = useViewportSafePosition(isOpen, triggerRef, dropdownRef);
  const listId = useId();
  const isPhone = useIsPhone();

  useEffect(() => {
    if (isOpen) setDropdownWidth(triggerRef.current?.offsetWidth);
  }, [isOpen]);

  useEffect(() => {
    // The phone sheet is portaled outside the container and has its own close.
    if (!isOpen || isPhone) return;
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, isPhone]);

  // The dropdown stays hidden until it's been positioned, and a hidden input
  // can't take focus — so focus it once it's visible rather than autoFocus.
  const isPositioned = isOpen && style.visibility !== "hidden";
  useEffect(() => {
    if (isPositioned) inputRef.current?.focus();
  }, [isPositioned]);

  // Keeps the keyboard-highlighted row in view while arrowing through.
  useEffect(() => {
    if (!isOpen) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-set-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]);

  // Saved sets by species key, so each species heading lists its own.
  const savedBySpecies = new Map<string, { species: string; sets: SetOption[] }>();
  for (const [kind, sets] of [
    ["custom", calcSets.customSets],
    ["public", calcSets.publicSets],
  ] as const) {
    for (const set of sets) {
      const key = normalizeSpeciesKey(set.pokemon.species);
      const entry = savedBySpecies.get(key) ?? { species: set.pokemon.species, sets: [] };
      entry.sets.push(savedSetOption(set, kind));
      savedBySpecies.set(key, entry);
    }
  }

  const groups: SpeciesGroup[] = SPECIES_OPTIONS.map((option) => ({
    speciesKey: option.id,
    englishName: option.label,
    label: text.species(option.label),
    sets: [
      ...(savedBySpecies.get(option.id)?.sets ?? []),
      { id: "blank", name: t.calcPanel.blankSet, build: () => buildCustomPokemon(option.id) },
    ],
  }));
  // A set saved from a species outside the regulation's list (e.g. one loaded
  // from a pasted team) still gets a heading of its own rather than vanishing.
  const listedKeys = new Set(SPECIES_OPTIONS.map((option) => option.id));
  for (const [key, entry] of savedBySpecies) {
    if (listedKeys.has(key)) continue;
    groups.push({
      speciesKey: key,
      englishName: entry.species,
      label: text.species(entry.species),
      sets: entry.sets,
    });
  }

  // A species matches by either of its names, and then shows all its sets;
  // otherwise only the sets whose name matches show under it.
  const folded = foldForSearch(query.trim());
  const filteredGroups = folded
    ? groups.flatMap((group) => {
        const speciesMatches =
          foldForSearch(group.label).includes(folded) ||
          foldForSearch(group.englishName).includes(folded);
        const sets = speciesMatches
          ? group.sets
          : group.sets.filter((set) => foldForSearch(set.name).includes(folded));
        return sets.length > 0 ? [{ ...group, sets }] : [];
      })
    : groups;
  const visibleGroups = filteredGroups.slice(0, MAX_VISIBLE_GROUPS);
  const flatSets = visibleGroups.flatMap((group) => group.sets);

  function open() {
    setQuery("");
    setActiveIndex(0);
    setRenaming(null);
    setConfirmingDeleteId(null);
    setIsOpen(true);
  }

  function savedSetId(option: SetOption): string {
    return option.id.slice(`${option.kind}-`.length);
  }

  function canEdit(option: SetOption): boolean {
    return option.kind === "custom" || (option.kind === "public" && calcSets.canEditPublic);
  }

  /** On Enter a taken name keeps the input open to fix it; on blur it just reverts. */
  async function commitRename(option: SetOption, keepOpenOnConflict: boolean) {
    const name = renaming?.name.trim();
    if (!option.kind || !name || name === option.name) {
      setRenaming(null);
      return;
    }
    try {
      await calcSets.renameSet(option.kind, savedSetId(option), name);
      setRenaming(null);
    } catch (error) {
      if (error instanceof SetNameTakenError) {
        toast.error(t.calcPanel.setNameTaken(name));
        if (!keepOpenOnConflict) setRenaming(null);
      } else {
        setRenaming(null);
        toast.error(t.calcPanel.setSaveFailed);
      }
    }
  }

  async function removeSet(option: SetOption) {
    if (!option.kind) return;
    if (confirmingDeleteId !== option.id) {
      setConfirmingDeleteId(option.id);
      return;
    }
    setConfirmingDeleteId(null);
    try {
      await calcSets.deleteSet(option.kind, savedSetId(option));
      toast.success(t.calcPanel.setDeleted(option.name));
    } catch {
      toast.error(t.calcPanel.setDeleteFailed);
    }
  }

  /** `fromKeyboard`: an Enter pick moves on to the next field (the item) instead of back to this one. */
  function pick(set: SetOption, fromKeyboard = false) {
    onSelect(set.build(), set.kind ? { kind: set.kind, id: savedSetId(set) } : undefined);
    setIsOpen(false);
    triggerRef.current?.focus();
    if (fromKeyboard) focusNextFlowField(triggerRef.current);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, flatSets.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const set = flatSets[activeIndex];
      if (set) pick(set, true);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }

  const ariaLabel = t.calcPanel.setPickerLabel(title);
  let setIndex = 0;

  const searchInput = (
    <input
      ref={inputRef}
      type={isPhone ? "search" : "text"}
      autoFocus={isPhone}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      value={query}
      onChange={(event) => {
        setQuery(event.target.value);
        setActiveIndex(0);
      }}
      onKeyDown={handleKeyDown}
      placeholder={t.editor.searchPokemon}
      aria-label={ariaLabel}
      aria-controls={listId}
      className={
        isPhone
          ? pickerSheetSearchClassName
          : "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none dark:bg-zinc-900"
      }
    />
  );

  const list = (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      className="overflow-y-auto p-1"
    >
      {visibleGroups.length === 0 ? (
        <p className="p-2 text-xs text-zinc-500">{t.editor.noMatches}</p>
      ) : (
        visibleGroups.map((group) => {
          return (
            <div key={group.speciesKey} role="group" aria-label={group.label}>
              <div
                className={cn(
                  "truncate px-2 font-semibold text-zinc-900",
                  isPhone ? "pt-3 text-base" : "pt-1.5 text-sm",
                )}
              >
                {group.label}
              </div>
              {group.sets.map((set) => {
                const index = setIndex++;
                const isActive = index === activeIndex;
                const isRenaming = renaming?.optionId === set.id;
                const isConfirmingDelete = confirmingDeleteId === set.id;
                return (
                  <div
                    key={set.id}
                    role="option"
                    aria-selected={isActive}
                    data-set-index={index}
                    onClick={() => {
                      if (!isRenaming) pick(set);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "group flex w-full cursor-pointer items-center gap-2 rounded-md pr-1 pl-5 text-left text-sm text-zinc-700",
                      isPhone ? "min-h-11 py-1.5" : "py-1",
                      isActive && "bg-zinc-200 text-zinc-900",
                    )}
                  >
                    {isRenaming ? (
                      <input
                        type="text"
                        value={renaming.name}
                        autoFocus
                        aria-label={t.calcPanel.renameSet(set.name)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          setRenaming({ optionId: set.id, name: event.target.value })
                        }
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") void commitRename(set, true);
                          else if (event.key === "Escape") setRenaming(null);
                        }}
                        onBlur={() => {
                          if (renaming?.optionId === set.id) void commitRename(set, false);
                        }}
                        className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none dark:bg-zinc-900"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{set.name}</span>
                    )}
                    {set.kind && !isRenaming && (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                        {set.kind === "custom" ? t.calcPanel.mySetTag : t.calcPanel.publicSetTag}
                      </span>
                    )}
                    {canEdit(set) && !isRenaming && (
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-0.5",
                          isActive || isConfirmingDelete
                            ? ""
                            : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
                        )}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setConfirmingDeleteId(null);
                            setRenaming({ optionId: set.id, name: set.name });
                          }}
                          aria-label={t.calcPanel.renameSet(set.name)}
                          title={t.calcPanel.renameSet(set.name)}
                          className={cn(
                            "flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900",
                            isPhone ? "h-9 w-9" : "h-6 w-6",
                          )}
                        >
                          <Icon name={IconName.Edit} size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeSet(set);
                          }}
                          aria-label={
                            isConfirmingDelete
                              ? t.calcPanel.confirmDeleteSet(set.name)
                              : t.calcPanel.deleteSet(set.name)
                          }
                          title={
                            isConfirmingDelete
                              ? t.calcPanel.confirmDeleteSet(set.name)
                              : t.calcPanel.deleteSet(set.name)
                          }
                          className={cn(
                            "flex items-center justify-center rounded",
                            isPhone ? "h-9 w-9" : "h-6 w-6",
                            isConfirmingDelete
                              ? "bg-red-600 text-white hover:bg-red-700"
                              : "text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900",
                          )}
                        >
                          <Icon
                            name={isConfirmingDelete ? IconName.Check : IconName.Delete}
                            size={14}
                          />
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
      {filteredGroups.length > MAX_VISIBLE_GROUPS && (
        <p className="p-2 text-[11px] text-zinc-500">
          {t.calcPanel.keepTyping(MAX_VISIBLE_GROUPS)}
        </p>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        ref={triggerRef}
        type="button"
        {...FLOW_FIELD}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className="flex w-full items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
      >
        <span className={cn("min-w-0 flex-1 truncate", pokemon ? "font-medium" : "text-zinc-500")}>
          {pokemon ? text.species(pokemon.species) : t.calcPanel.choosePokemon}
        </span>
        <Icon name={isOpen ? IconName.ExpandLess : IconName.ExpandMore} size={16} />
      </button>

      {isOpen && isPhone && (
        <PickerSheet title={ariaLabel} onClose={() => setIsOpen(false)} search={searchInput}>
          {list}
        </PickerSheet>
      )}
      {isOpen && !isPhone && (
        <div
          ref={dropdownRef}
          style={{ ...style, width: dropdownWidth }}
          className="z-20 flex max-h-96 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 shadow-lg"
        >
          <div className="border-b border-zinc-200 p-1.5">{searchInput}</div>
          {list}
        </div>
      )}
    </div>
  );
}
