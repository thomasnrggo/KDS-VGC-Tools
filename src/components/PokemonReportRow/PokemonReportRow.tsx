"use client";

import { useEffect, useRef } from "react";
import { calculateStatBreakdown } from "@/lib/stats/calculateFinalStats";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { TypeIcon } from "../TypeIcon";
import { NATURE_MODIFIERS } from "@/constants/natures";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import movesData from "@/data/moves.json";
import type { ParsedPokemon, StatKey } from "@/types";
import type { MoveData } from "@/types/damage";

const MOVES = movesData as unknown as Record<string, MoveData>;

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
 * One card on the Team Report page: a Base/SP/Final stat table (reusing
 * calculateStatBreakdown — same source as the Damage Calculator's editable
 * version, just rendered plain here since this page isn't a battle
 * calculator), the Pokémon's own moveset as pasted, and a free-text notes
 * box the caller persists via onNoteChange.
 *
 * Shares OpponentPokemonCard's layout — always-dark header bar carrying the
 * sprite, species, and item/ability/nature, over a light body — since the
 * two are the same kind of thing (one Pokémon's sheet, plus your notes on
 * it) viewed from either side of a matchup. The stat table is the one part
 * the opponent's version can't have: a real tournament team sheet rarely
 * reveals Stat Points, so there's nothing to compute a Final stat from
 * there.
 *
 * The header bar stays dark in both themes — like the main nav header, it's
 * chrome rather than a themed surface, so it (and everything on it) carries
 * a `dark:` override cancelling out the app-wide zinc swap rather than
 * participating in it; see MyTeamHeader for the same pattern.
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

  const natureModifier = pokemon.nature
    ? NATURE_MODIFIERS[pokemon.nature.toLowerCase()]
    : undefined;

  const hasDetails = Boolean(pokemon.item || pokemon.ability || pokemon.nature);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      <div className="flex items-center gap-3 bg-zinc-800 px-4 py-3 dark:bg-zinc-200">
        <span className="relative h-12 w-12 shrink-0">
          <span className="absolute inset-0 overflow-hidden rounded-lg bg-zinc-700 dark:bg-zinc-300">
            <PokemonSprite species={pokemon.species} item={pokemon.item} fill />
          </span>
          {pokemon.item && (
            <span className="absolute -bottom-1 -right-1">
              <ItemIcon item={pokemon.item} size={18} />
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-bold text-white">{pokemon.species}</span>
          {hasDetails && (
            <div className="flex min-w-0 items-center justify-between gap-4 text-sm text-zinc-100 dark:text-zinc-900">
              {pokemon.item && <span className="min-w-0 truncate">{pokemon.item}</span>}
              {pokemon.ability && (
                <span className="min-w-0 truncate">
                  Ability: <span className="font-medium text-white">{pokemon.ability}</span>
                </span>
              )}
              {pokemon.nature && (
                <span className="min-w-0 truncate">
                  {pokemon.nature} nature
                  {natureModifier && (natureModifier.increased || natureModifier.decreased) && (
                    <>
                      {" "}
                      (
                      {natureModifier.increased && (
                        <span className="font-medium text-red-400">
                          +{natureModifier.increased}
                        </span>
                      )}
                      {natureModifier.increased && natureModifier.decreased && " "}
                      {natureModifier.decreased && (
                        <span className="font-medium text-blue-400">
                          -{natureModifier.decreased}
                        </span>
                      )}
                      )
                    </>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[150px_1fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-zinc-900">Stats</h3>
          {breakdown ? (
            <table className="w-full text-[11px] leading-tight text-zinc-700">
              <thead>
                <tr className="text-zinc-500">
                  <th className="py-0.5 text-left font-normal">Stat</th>
                  <th className="text-right font-normal">Base</th>
                  <th className="text-right font-normal">Pts</th>
                  <th className="text-right font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {STAT_ORDER.map((stat) => {
                  const boosted = breakdown.final.increasedStat === stat;
                  const lowered = breakdown.final.decreasedStat === stat;
                  const highlight = boosted ? "text-red-600" : lowered ? "text-blue-600" : "";
                  return (
                    <tr key={stat}>
                      <td className={`py-0.5 ${highlight}`}>{STAT_LABELS[stat]}</td>
                      <td className="text-right">{breakdown.base[stat]}</td>
                      <td className="text-right">{breakdown.statPoints[stat]}</td>
                      <td className={`text-right font-medium ${highlight}`}>
                        {breakdown.final[stat]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-zinc-400">No stat data for this species.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-zinc-900">Moveset</h3>
          {pokemon.moves && pokemon.moves.length > 0 ? (
            <div className="flex flex-col gap-1">
              {pokemon.moves.map((move, index) => {
                const type = MOVES[normalizeSpeciesKey(move)]?.type;
                return (
                  <div
                    key={`${move}-${index}`}
                    className="flex h-8 items-center overflow-hidden rounded-md bg-zinc-100 text-sm text-zinc-800"
                  >
                    {type ? (
                      <TypeIcon type={type} size={32} />
                    ) : (
                      <span className="h-8 w-8 shrink-0 bg-zinc-300" />
                    )}
                    <span className="truncate px-3">{move}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-400">No moves parsed for this Pokémon.</p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-zinc-900">Notes</h3>
          <textarea
            ref={notesRef}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            placeholder="How does this Pokémon work in this team?"
            aria-label={`${pokemon.species} notes`}
            className="min-h-24 max-h-40 w-full flex-1 resize-none overflow-y-auto rounded-lg bg-zinc-100 p-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>
      </div>
    </div>
  );
}
