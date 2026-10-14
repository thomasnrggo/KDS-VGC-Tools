"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ParsedPokemon } from "@/types";
import { SPECIES_OPTIONS, buildCustomPokemon } from "../PokemonEditor";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useViewportSafePosition } from "@/hooks/useViewportSafePosition";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";

/** Species groups rendered at once — the list is long, and typing narrows it. */
const MAX_VISIBLE_GROUPS = 60;

/** One pickable build under a species heading. Only "Blank Set" for now; team, opponent and saved sets join it later. */
interface SetOption {
  id: string;
  name: string;
  build: () => ParsedPokemon;
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
  onSelect: (pokemon: ParsedPokemon) => void;
}

/**
 * The Damage Calculator's species picker: a Showdown-style dropdown that
 * lists each species with its sets underneath, so choosing a Pokémon also
 * chooses its build. Deliberately lighter than the Team Builder's species
 * search (no abilities/base-stat rows) — in the calc you already know the
 * Pokémon; what you're picking is the set.
 */
export function PokemonSetPicker({ title, pokemon, onSelect }: PokemonSetPickerProps) {
  const t = useMessages();
  const text = usePokemonText();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownWidth, setDropdownWidth] = useState<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const style = useViewportSafePosition(isOpen, triggerRef, dropdownRef);
  const listId = useId();

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
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

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

  const groups: SpeciesGroup[] = SPECIES_OPTIONS.map((option) => ({
    speciesKey: option.id,
    englishName: option.label,
    label: text.species(option.label),
    sets: [{ id: "blank", name: t.calcPanel.blankSet, build: () => buildCustomPokemon(option.id) }],
  }));

  // A species matches by either of its names, and then shows all its sets;
  // otherwise only the sets whose name matches show under it.
  const folded = foldForSearch(query.trim());
  const filteredGroups = (
    folded
      ? groups.flatMap((group) => {
          const speciesMatches =
            foldForSearch(group.label).includes(folded) ||
            foldForSearch(group.englishName).includes(folded);
          const sets = speciesMatches
            ? group.sets
            : group.sets.filter((set) => foldForSearch(set.name).includes(folded));
          return sets.length > 0 ? [{ ...group, sets }] : [];
        })
      : groups
  );
  const visibleGroups = filteredGroups.slice(0, MAX_VISIBLE_GROUPS);
  const flatSets = visibleGroups.flatMap((group) => group.sets);

  function open() {
    setQuery("");
    setActiveIndex(0);
    setIsOpen(true);
  }

  function pick(set: SetOption) {
    onSelect(set.build());
    setIsOpen(false);
    triggerRef.current?.focus();
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
      if (set) pick(set);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }

  const ariaLabel = t.calcPanel.setPickerLabel(title);
  let setIndex = 0;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className="flex w-full items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
      >
        <span className={`min-w-0 flex-1 truncate ${pokemon ? "font-medium" : "text-zinc-500"}`}>
          {pokemon ? text.species(pokemon.species) : t.calcPanel.choosePokemon}
        </span>
        <Icon name={isOpen ? IconName.ExpandLess : IconName.ExpandMore} size={16} />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={{ ...style, width: dropdownWidth }}
          className="z-20 flex max-h-96 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 shadow-lg"
        >
          <div className="border-b border-zinc-200 p-1.5">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t.editor.searchPokemon}
              aria-label={ariaLabel}
              aria-controls={listId}
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-900"
            />
          </div>
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
                    <div className="truncate px-2 pt-1.5 text-sm font-semibold text-zinc-900">
                      {group.label}
                    </div>
                    {group.sets.map((set) => {
                      const index = setIndex++;
                      const isActive = index === activeIndex;
                      return (
                        <button
                          key={set.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          data-set-index={index}
                          onClick={() => pick(set)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={`block w-full rounded-md py-1 pl-5 pr-2 text-left text-sm text-zinc-700 ${
                            isActive ? "bg-zinc-200 text-zinc-900" : ""
                          }`}
                        >
                          {set.name}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
            {filteredGroups.length > MAX_VISIBLE_GROUPS && (
              <p className="p-2 text-[11px] text-zinc-500">{t.calcPanel.keepTyping(MAX_VISIBLE_GROUPS)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
