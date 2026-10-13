"use client";

import { useEffect, useRef, useState } from "react";
import type { ParsedPokemon, PokemonSlot } from "@/types";
import type { SlotTag } from "@/lib/slotPicks";
import { PokemonSprite } from "../PokemonSprite";
import { PokemonHoverCard } from "../PokemonHoverCard";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useViewportSafePosition } from "@/hooks/useViewportSafePosition";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";

interface PokemonSlotPickerProps {
  label: string;
  myTeamPokemon: ParsedPokemon[];
  value: PokemonSlot;
  onChange: (index: PokemonSlot) => void;
  /** Whether the selected Pokémon's Mega form (if it has one) should render — persisted by the caller so it survives a reload instead of resetting to "on" every time. */
  megaEnabled: boolean;
  onMegaToggle: () => void;
  /**
   * Roster indexes already in one of the group's other slots, with that
   * slot's label and a short tag ("L1") — shown dimmed and tagged. Picking one still works: the
   * caller swaps the two slots (see pickIntoSlot in src/lib/slotPicks.ts).
   */
  usedIn?: Record<number, SlotTag>;
  /** This slot repeats a Pokémon from another slot (older saved data) — gets a warning ring. */
  isDuplicate?: boolean;
  /** "range" when `myTeamPokemon` is an opponent's roster (a tournament game's opponent picks) — see PokemonHoverCard. */
  speedMode?: "exact" | "range";
}

export function PokemonSlotPicker({
  label,
  myTeamPokemon,
  value,
  onChange,
  megaEnabled,
  onMegaToggle,
  usedIn = {},
  isDuplicate = false,
  speedMode,
}: PokemonSlotPickerProps) {
  const t = useMessages();
  const pokemonText = usePokemonText();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const style = useViewportSafePosition(isOpen, triggerRef, dropdownRef);
  const selected = value !== null ? myTeamPokemon[value] : undefined;

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function pick(index: number) {
    onChange(index);
    setIsOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center gap-1"
    >
      <div
        ref={triggerRef}
        className="relative flex h-16 w-16 items-center justify-center"
      >
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={
            selected
              ? t.slotPicker.picked(label, pokemonText.species(selected.species))
              : t.slotPicker.empty(label)
          }
          title={isDuplicate ? t.slotPicker.duplicate : undefined}
          className={`flex h-16 w-16 items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 ${
            isDuplicate ? "ring-2 ring-amber-500" : ""
          }`}
        >
          {selected ? (
            <PokemonHoverCard
              pokemon={selected}
              triggerClassName="h-full w-full"
              disabled={isOpen}
              megaEnabled={megaEnabled}
              onMegaToggle={onMegaToggle}
              speedMode={speedMode}
            >
              {(displayPokemon) => (
                <div className="relative h-full w-full overflow-hidden rounded-lg bg-zinc-500/20">
                  <PokemonSprite
                    species={displayPokemon.species}
                    item={displayPokemon.item}
                    fill
                  />
                </div>
              )}
            </PokemonHoverCard>
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-zinc-500 transition-all hover:border-zinc-600 hover:bg-zinc-300/50 cursor-pointer">
              <Icon className="text-zinc-500" name={IconName.Add} size={24} />
            </span>
          )}
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t.slotPicker.clear(label)}
            title={t.slotPicker.clear(label)}
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-400 text-zinc-700 hover:bg-zinc-500 hover:text-zinc-200 cursor-pointer"
          >
            <Icon name={IconName.Close} size={12} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label={label}
          style={style}
          className="z-20 grid w-max grid-cols-3 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2 shadow-lg"
        >
          {myTeamPokemon.length === 0 ? (
            <p className="col-span-3 max-w-40 p-1 text-xs text-zinc-500">
              {t.slotPicker.addTeamFirst}
            </p>
          ) : (
            myTeamPokemon.map((mon, index) => {
              const otherSlot = value === index ? undefined : usedIn[index];
              const name = pokemonText.species(mon.species);
              return (
                <button
                  key={index}
                  type="button"
                  role="option"
                  aria-selected={value === index}
                  onClick={() => pick(index)}
                  title={otherSlot ? t.slotPicker.usedIn(name, otherSlot.label) : name}
                  className={`relative flex flex-col items-center gap-0.5 rounded-md p-1.5 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                    value === index ? "bg-zinc-200" : ""
                  }`}
                >
                  <span className={otherSlot ? "opacity-40" : ""}>
                    <PokemonSprite species={mon.species} size={48} />
                  </span>
                  {otherSlot && (
                    <span className="absolute right-0.5 top-0.5 rounded-full bg-zinc-600 px-1.5 py-px text-[10px] font-semibold text-white dark:bg-zinc-400">
                      {otherSlot.tag}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
