"use client";

import { useEffect, useRef, useState } from "react";
import type { ParsedPokemon, PokemonSlot } from "@/types";
import { PokemonSprite } from "../PokemonSprite";
import { PokemonHoverCard } from "../PokemonHoverCard";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useViewportSafePosition } from "@/hooks/useViewportSafePosition";

interface PokemonSlotPickerProps {
  label: string;
  myTeamPokemon: ParsedPokemon[];
  value: PokemonSlot;
  onChange: (index: PokemonSlot) => void;
}

export function PokemonSlotPicker({
  label,
  myTeamPokemon,
  value,
  onChange,
}: PokemonSlotPickerProps) {
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
      <div ref={triggerRef} className="relative flex h-14 w-14 items-center justify-center">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={
            selected
              ? `${label}: ${selected.species}. Click to change.`
              : `${label}: none picked. Click to choose.`
          }
          className="flex h-14 w-14 items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-mauve-600"
        >
          {selected ? (
            <PokemonHoverCard
              pokemon={selected}
              triggerClassName="h-full w-full"
            >
              <div className="relative h-full w-full overflow-hidden rounded-lg bg-mauve-500/20">
                <PokemonSprite species={selected.species} fill />
              </div>
            </PokemonHoverCard>
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-mauve-500 transition-all hover:border-mauve-600 hover:bg-mauve-300/50 cursor-pointer">
              <Icon className="text-mauve-500" name={IconName.Add} size={24} />
            </span>
          )}
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Clear ${label}`}
            title={`Clear ${label}`}
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-mauve-400 text-mauve-700 hover:bg-mauve-500 hover:text-mauve-200 cursor-pointer"
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
          className="z-20 grid w-max grid-cols-3 gap-1 rounded-lg border border-mauve-200 bg-white p-2 shadow-lg"
        >
          {myTeamPokemon.length === 0 ? (
            <p className="col-span-3 max-w-40 p-1 text-xs text-mauve-500">
              Add your own team first.
            </p>
          ) : (
            myTeamPokemon.map((mon, index) => (
              <button
                key={index}
                type="button"
                role="option"
                aria-selected={value === index}
                onClick={() => pick(index)}
                title={mon.species}
                className={`flex flex-col items-center gap-0.5 rounded-md p-1.5 hover:bg-mauve-100 focus:outline-none focus:ring-2 focus:ring-mauve-400 ${
                  value === index ? "bg-mauve-200" : ""
                }`}
              >
                <PokemonSprite species={mon.species} size={48} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
