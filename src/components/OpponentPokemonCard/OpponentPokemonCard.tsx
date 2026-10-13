"use client";

import { useEffect, useRef } from "react";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { TypeIcon } from "../TypeIcon";
import { NATURE_MODIFIERS } from "@/constants/natures";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import movesData from "@/data/moves.json";
import type { ParsedPokemon } from "@/types";
import type { MoveData } from "@/types/damage";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";

const MOVES = movesData as unknown as Record<string, MoveData>;

interface OpponentPokemonCardProps {
  pokemon: ParsedPokemon;
  note: string;
  onNoteChange: (note: string) => void;
}

/**
 * One entry in a Round's simplified opponent "team sheet" — species/ability/
 * item/nature and moveset, whatever the paste happened to include (a real
 * tournament team sheet rarely reveals Stat Points, so unlike
 * the Team Report's PokemonReportCard there are no stats here — nothing to compute a Final
 * stat from without EVs, and showing one anyway would be misleading), plus
 * a free-text notes box for anything you observe about this specific
 * Pokémon across the round's games.
 *
 * The header bar is always dark, in both themes — like the main nav header,
 * it's chrome rather than a themed surface, so it (and everything sitting on
 * it: item text, "Ability", nature) carries a `dark:` override that cancels
 * out the app-wide zinc swap instead of participating in it — see
 * MyTeamHeader for the same pattern and the general reasoning.
 */
export function OpponentPokemonCard({ pokemon, note, onNoteChange }: OpponentPokemonCardProps) {
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [note]);

  const t = useMessages();
  const text = usePokemonText();
  const natureModifier = pokemon.nature
    ? NATURE_MODIFIERS[pokemon.nature.toLowerCase()]
    : undefined;

  // The sprite shows the Mega form when it holds its stone, so the ability does too.
  const ability = resolveEffectiveAbility(pokemon.species, pokemon.item, pokemon.ability);
  const hasDetails = Boolean(pokemon.item || ability || pokemon.nature);

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
          <span className="truncate text-base font-bold text-white">{text.species(pokemon.species)}</span>
          {hasDetails && (
            <div className="flex min-w-0 items-center justify-between gap-4 text-sm text-zinc-100 dark:text-zinc-900">
              {pokemon.item && <span className="min-w-0 truncate">{text.item(pokemon.item)}</span>}
              {ability && (
                <span className="min-w-0 truncate">
                  {t.pokemonCard.ability}{" "}
                  <span className="font-medium text-white">{text.ability(ability)}</span>
                </span>
              )}
              {pokemon.nature && (
                <span className="min-w-0 truncate">
                  {t.pokemonCard.natureTitle(text.nature(pokemon.nature))}
                  {natureModifier && (natureModifier.increased || natureModifier.decreased) && (
                    <>
                      {" "}
                      (
                      {natureModifier.increased && (
                        <span className="font-medium text-red-400">
                          +{t.stats.short[natureModifier.increased]}
                        </span>
                      )}
                      {natureModifier.increased && natureModifier.decreased && " "}
                      {natureModifier.decreased && (
                        <span className="font-medium text-blue-400">
                          -{t.stats.short[natureModifier.decreased]}
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

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        {pokemon.moves && pokemon.moves.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold text-zinc-900">{t.opponentPokemon.moveset}</h3>
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
                    <span className="truncate px-3">{text.move(move)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-zinc-900">{t.opponentPokemon.notes}</h3>
          <textarea
            ref={notesRef}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            placeholder={t.opponentPokemon.notesPlaceholder}
            aria-label={t.opponentPokemon.notesLabel(text.species(pokemon.species))}
            className="min-h-24 max-h-40 w-full flex-1 resize-none overflow-y-auto rounded-lg bg-zinc-100 p-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>
      </div>
    </div>
  );
}
