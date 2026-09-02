"use client";

import { useEffect, useRef } from "react";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import type { ParsedPokemon } from "@/types";

interface OpponentPokemonCardProps {
  pokemon: ParsedPokemon;
  note: string;
  onNoteChange: (note: string) => void;
}

/**
 * One entry in a Round's simplified opponent "team sheet" — species/ability/
 * item/nature and moveset, whatever the paste happened to include (a real
 * tournament team sheet rarely reveals Stat Points, so unlike
 * PokemonReportRow there's no stat table here — nothing to compute a Final
 * stat from without EVs, and showing one anyway would be misleading), plus
 * a free-text notes box for anything you observe about this specific
 * Pokémon across the round's games.
 */
export function OpponentPokemonCard({ pokemon, note, onNoteChange }: OpponentPokemonCardProps) {
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [note]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-mauve-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="relative h-12 w-12 shrink-0">
          <PokemonSprite species={pokemon.species} item={pokemon.item} fill />
          {pokemon.item && (
            <span className="absolute -bottom-1 -right-1">
              <ItemIcon item={pokemon.item} size={16} />
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-mauve-900">{pokemon.species}</span>
          <span className="truncate text-xs text-mauve-500">
            {[pokemon.ability, pokemon.item].filter(Boolean).join(" · ") || "—"}
          </span>
          {pokemon.nature && <span className="truncate text-xs text-mauve-400">{pokemon.nature} Nature</span>}
        </div>
      </div>

      {pokemon.moves && pokemon.moves.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pokemon.moves.map((move) => (
            <span
              key={move}
              className="rounded-md bg-mauve-100 px-2 py-0.5 text-xs text-mauve-700"
            >
              {move}
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={notesRef}
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        rows={2}
        placeholder="Anything you notice about this Pokémon…"
        aria-label={`${pokemon.species} notes`}
        className="min-h-12 max-h-32 w-full resize-none overflow-y-auto rounded-lg border border-mauve-200 bg-mauve-100 p-2 text-sm text-mauve-800 focus:outline-none focus:ring-2 focus:ring-mauve-400"
      />
    </div>
  );
}
