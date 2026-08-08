"use client";

import { useEffect, useRef, useState } from "react";
import type { PokemonSlot } from "@/lib/opponent";
import type { ParsedPokemon } from "@/lib/parseTeam";
import { PokemonSprite } from "./PokemonSprite";

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
  const selected = value !== null ? myTeamPokemon[value] : undefined;

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

  function pick(index: number) {
    onChange(index);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex flex-col items-center gap-1">
      <div className="relative flex h-14 w-14 items-center justify-center">
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
          className="flex h-14 w-14 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
        >
          {selected ? (
            <PokemonSprite species={selected.species} size={56} />
          ) : (
            <span className="block h-14 w-14 rounded-full border border-dashed border-zinc-300 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800" />
          )}
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Clear ${label}`}
            title={`Clear ${label}`}
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-white hover:bg-red-600 dark:bg-zinc-600 dark:hover:bg-red-600"
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <span
        className="max-w-[4.5rem] truncate text-center text-xs text-zinc-700 dark:text-zinc-300"
        title={selected?.species}
      >
        {selected ? selected.species : "—"}
      </span>

      {isOpen && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute top-full z-20 mt-2 grid w-max grid-cols-3 gap-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {myTeamPokemon.length === 0 ? (
            <p className="col-span-3 max-w-[10rem] p-1 text-xs text-zinc-500 dark:text-zinc-400">
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
                className={`flex flex-col items-center gap-0.5 rounded-md p-1.5 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:hover:bg-zinc-800 dark:focus:ring-zinc-500 ${
                  value === index ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <PokemonSprite species={mon.species} size={36} />
                <span className="max-w-[3.5rem] truncate text-[10px] text-zinc-700 dark:text-zinc-300">
                  {mon.species}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
