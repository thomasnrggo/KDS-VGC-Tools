"use client";

import { useEffect, useRef } from "react";
import { calculateStatBreakdown } from "@/lib/stats/calculateFinalStats";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import type { ParsedPokemon, StatKey } from "@/types";

interface PokemonReportRowProps {
  pokemon: ParsedPokemon;
  note: string;
  onNoteChange: (note: string) => void;
}

const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

/**
 * One read-only row on the Team Report page: sprite/ability/item, a Base/SP/
 * Final stat table (reusing calculateStatBreakdown — same source as the
 * Damage Calculator's editable version, just rendered plain here since this
 * page isn't a battle calculator), the Pokémon's own moveset as pasted, and
 * a free-text notes box the caller persists via onNoteChange.
 */
export function PokemonReportRow({ pokemon, note, onNoteChange }: PokemonReportRowProps) {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const breakdown = calculateStatBreakdown(pokemon);

  // Same auto-grow-to-content pattern as OpponentCard's game-plan textarea.
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [note]);

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-mauve-300/60 p-4 last:border-b-0 md:grid-cols-2">
      <div className="flex items-center gap-2">
        <span className="relative h-14 w-14 shrink-0">
          <PokemonSprite species={pokemon.species} item={pokemon.item} fill />
          {pokemon.item && (
            <span className="absolute -bottom-1 -right-1">
              <ItemIcon item={pokemon.item} size={18} />
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-mauve-900">{pokemon.species}</span>
          {pokemon.ability && (
            <span className="truncate text-xs text-mauve-500">{pokemon.ability}</span>
          )}
          {pokemon.item && (
            <span className="truncate text-xs text-mauve-400">{pokemon.item}</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        {breakdown ? (
          <table className="w-full min-w-[150px] text-xs text-mauve-700">
            <thead>
              <tr className="text-mauve-500">
                <th className="py-0.5 text-left font-normal">Stat</th>
                <th className="text-right font-normal">Base</th>
                <th className="text-right font-normal">Points</th>
                <th className="text-right font-normal">Final</th>
              </tr>
            </thead>
            <tbody>
              {STAT_ORDER.map((stat) => {
                const boosted = breakdown.final.increasedStat === stat;
                const lowered = breakdown.final.decreasedStat === stat;
                return (
                  <tr key={stat}>
                    <td className="py-0.5">{STAT_LABELS[stat]}</td>
                    <td className="text-right">{breakdown.base[stat]}</td>
                    <td className="text-right">{breakdown.statPoints[stat]}</td>
                    <td
                      className={`text-right font-medium ${
                        boosted ? "text-red-600" : lowered ? "text-blue-600" : ""
                      }`}
                    >
                      {breakdown.final[stat]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-mauve-400">No stat data for this species.</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
          Moveset
        </span>
        {pokemon.moves && pokemon.moves.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {pokemon.moves.map((move) => (
              <li
                key={move}
                className="rounded-md bg-white px-2.5 py-1 text-xs text-mauve-700"
              >
                {move}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-mauve-400">No moves parsed for this Pokémon.</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
          Notes
        </span>
        <textarea
          ref={notesRef}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          rows={2}
          placeholder="How does this Pokémon work in this team?"
          aria-label={`${pokemon.species} notes`}
          className="min-h-16 max-h-40 w-full resize-none overflow-y-auto rounded-lg bg-white/60 p-2 text-sm text-mauve-800 focus:outline-none focus:ring-2 focus:ring-mauve-400"
        />
      </div>
    </div>
  );
}
