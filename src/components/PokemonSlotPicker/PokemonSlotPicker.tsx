"use client";

import { useEffect, useRef, useState } from "react";
import type { ParsedPokemon, PokemonSlot } from "@/types";
import type { SlotTag } from "@/lib/slotPicks";
import { PokemonSprite } from "../PokemonSprite";
import { PokemonHoverCard } from "../PokemonHoverCard";
import { PickCalcsCard, type SlotCalcs } from "./PickCalcsCard";
import { EitherTile } from "./EitherTile";
import { Icon } from "../Icon";
import { TogglePill } from "../Button";
import { IconName } from "@/enums";
import { useViewportSafePosition } from "@/hooks/useViewportSafePosition";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { megaDisplay } from "@/lib/species/megaDisplay";
import { cn } from "@/lib/utils";

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
  /**
   * The picked Pokémon's calcs against the other side (a matchup plan) —
   * shown instead of its Pokémon card, with a count badge (see PickCalcsCard).
   */
  calcs?: SlotCalcs;
  /**
   * A flexible slot (Back 2 of your own picks): it can hold an alternative —
   * "A or B" — picked from the same dropdown once its "A or B" toggle is on.
   * `onChange` sets both at once (see withBackAlt in src/lib/slotPicks.ts).
   */
  flex?: {
    alternative: PokemonSlot;
    /** Whether the alternative shows as its Mega (Mega flag on and no other slot's Mega in use). */
    alternativeMega: boolean;
    onChange: (value: PokemonSlot, alternative: PokemonSlot) => void;
  };
  /** Empty while the rest of the group is picked: shows "+1" — any of the rest fits. */
  anyWhenEmpty?: boolean;
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
  calcs,
  flex,
  anyWhenEmpty = false,
}: PokemonSlotPickerProps) {
  const t = useMessages();
  const pokemonText = usePokemonText();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const style = useViewportSafePosition(isOpen, triggerRef, dropdownRef);
  const selected = value !== null ? myTeamPokemon[value] : undefined;
  const alternativeIndex = flex?.alternative ?? null;
  const alternative =
    selected && alternativeIndex !== null ? myTeamPokemon[alternativeIndex] : undefined;
  // As the tile shows them — each in its Mega form or not.
  const shown = selected && megaDisplay(selected, megaEnabled).displayPokemon;
  const alternativeShown =
    alternative && megaDisplay(alternative, flex?.alternativeMega ?? false).displayPokemon;
  // The dropdown's "A or B" toggle: on, a tap adds or removes a Pokémon
  // instead of replacing the pick. Starts on when there's an alternative.
  const [eitherMode, setEitherMode] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  function toggleOpen() {
    if (!isOpen) setEitherMode(alternativeIndex !== null);
    setIsOpen((open) => !open);
  }

  function pick(index: number) {
    if (!flex || !eitherMode) {
      onChange(index);
      setIsOpen(false);
      return;
    }
    // Either mode: tapping a picked one removes it (the alternative moves
    // up); tapping another fills whichever of the two is free, replacing
    // the alternative when both are set. Closes once both are set.
    if (index === value) flex.onChange(alternativeIndex, null);
    else if (index === alternativeIndex) flex.onChange(value, null);
    else if (value === null) flex.onChange(index, alternativeIndex);
    else {
      flex.onChange(value, index);
      setIsOpen(false);
    }
  }

  function toggleEitherMode() {
    if (eitherMode && flex && alternativeIndex !== null) flex.onChange(value, null);
    setEitherMode((on) => !on);
  }

  const sprite = (displayPokemon: ParsedPokemon) => (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-zinc-500/20">
      <PokemonSprite species={displayPokemon.species} item={displayPokemon.item} fill />
    </div>
  );
  const tile = (
    <>
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={
          selected && alternative
            ? t.slotPicker.pickedEither(
                label,
                pokemonText.species(selected.species),
                pokemonText.species(alternative.species),
              )
            : selected
              ? t.slotPicker.picked(label, pokemonText.species(selected.species))
              : anyWhenEmpty
                ? t.slotPicker.any(label)
                : t.slotPicker.empty(label)
        }
        title={isDuplicate ? t.slotPicker.duplicate : undefined}
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-lg focus:ring-2 focus:ring-zinc-600 focus:outline-none",
          isDuplicate && "ring-2 ring-amber-500",
        )}
      >
        {shown && alternativeShown ? (
          // Split corner to corner: the pick top-left, its alternative bottom-right. The
          // pick keeps its Pokémon card (and Mega toggle) unless calcs replace it.
          <EitherTile
            first={
              calcs ? (
                <PokemonSprite species={shown.species} item={shown.item} fill />
              ) : (
                <PokemonHoverCard
                  pokemon={selected}
                  triggerClassName="h-full w-full"
                  disabled={isOpen}
                  megaEnabled={megaEnabled}
                  onMegaToggle={onMegaToggle}
                  speedMode={speedMode}
                >
                  {(mon) => <PokemonSprite species={mon.species} item={mon.item} fill />}
                </PokemonHoverCard>
              )
            }
            second={
              <PokemonSprite species={alternativeShown.species} item={alternativeShown.item} fill />
            }
          />
        ) : shown && calcs ? (
          sprite(shown)
        ) : selected ? (
          <PokemonHoverCard
            pokemon={selected}
            triggerClassName="h-full w-full"
            disabled={isOpen}
            megaEnabled={megaEnabled}
            onMegaToggle={onMegaToggle}
            speedMode={speedMode}
          >
            {sprite}
          </PokemonHoverCard>
        ) : (
          <span className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-500 transition-all hover:border-zinc-600 hover:bg-zinc-300/50">
            {anyWhenEmpty ? (
              <span className="text-lg font-semibold text-zinc-500">+1</span>
            ) : (
              <Icon className="text-zinc-500" name={IconName.Add} size={24} />
            )}
          </span>
        )}
      </button>
      {selected && (
        <button
          type="button"
          onClick={() => (alternative && flex ? flex.onChange(null, null) : onChange(null))}
          aria-label={t.slotPicker.clear(label)}
          title={t.slotPicker.clear(label)}
          className="absolute -top-1 -right-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-zinc-400 text-zinc-700 hover:bg-zinc-500 hover:text-zinc-200"
        >
          <Icon name={IconName.Close} size={12} />
        </button>
      )}
    </>
  );

  return (
    <div ref={containerRef} className="relative flex flex-col items-center gap-1">
      <div ref={triggerRef} className="relative flex h-16 w-16 items-center justify-center">
        {selected && calcs ? (
          <PickCalcsCard
            pokemon={selected}
            alternative={alternative}
            alternativeMega={flex?.alternativeMega ?? false}
            calcs={calcs}
            disabled={isOpen}
            megaEnabled={megaEnabled}
            onMegaToggle={onMegaToggle}
          >
            {tile}
          </PickCalcsCard>
        ) : (
          tile
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
              const isPicked = value === index || (eitherMode && alternativeIndex === index);
              const otherSlot = isPicked ? undefined : usedIn[index];
              // Either mode only adds or removes, so another slot's Pokémon can't be swapped in.
              const locked = !!otherSlot && eitherMode;
              const name = pokemonText.species(mon.species);
              return (
                <button
                  key={index}
                  type="button"
                  role="option"
                  aria-selected={isPicked}
                  aria-disabled={locked || undefined}
                  onClick={() => !locked && pick(index)}
                  title={
                    otherSlot
                      ? locked
                        ? t.slotPicker.inSlot(name, otherSlot.label)
                        : t.slotPicker.usedIn(name, otherSlot.label)
                      : name
                  }
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-md p-1.5 hover:bg-zinc-100 focus:ring-2 focus:ring-zinc-400 focus:outline-none",
                    isPicked && "bg-zinc-200",
                    locked && "cursor-not-allowed hover:bg-transparent",
                  )}
                >
                  <span className={otherSlot ? "opacity-40" : ""}>
                    <PokemonSprite species={mon.species} size={48} />
                  </span>
                  {otherSlot && (
                    <span className="absolute top-0.5 right-0.5 rounded-full bg-chrome-600 px-1.5 py-px text-[10px] font-semibold text-white">
                      {otherSlot.tag}
                    </span>
                  )}
                </button>
              );
            })
          )}
          {flex && myTeamPokemon.length > 1 && (
            <div className="col-span-3 flex items-center gap-2 border-t border-zinc-200 pt-2">
              <TogglePill active={eitherMode} onClick={toggleEitherMode}>
                {t.slotPicker.either}
              </TogglePill>
              <span className="max-w-36 text-[11px] leading-tight text-zinc-500">
                {t.slotPicker.eitherHint}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
