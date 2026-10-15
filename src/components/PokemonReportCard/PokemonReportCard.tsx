"use client";

import { useState } from "react";
import { calculateStatBreakdown } from "@/lib/stats/calculateFinalStats";
import { resolveTypes } from "@/lib/damage/calculateDamage";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { speciesNamesMegaForm, stripMegaSuffix } from "@/lib/species/megaForm";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { TypeIcon } from "../TypeIcon";
import { NATURE_MODIFIERS } from "@/constants/natures";
import movesData from "@/data/moves.json";
import type { ParsedPokemon, StatKey, TeamSheetMode } from "@/types";
import type { MoveData } from "@/types/damage";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

const MOVES = movesData as unknown as Record<string, MoveData>;

const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
// Stat Points cap per stat in Pokémon Champions — the bar's full width.
const MAX_STAT_POINTS = 32;

interface PokemonReportCardProps {
  pokemon: ParsedPokemon;
  /** "open" (a shared open team sheet) leaves out nature and stats — the shared copy has no Stat Points or nature to compute them from. */
  sheet?: TeamSheetMode;
  /** Starts collapsed to just its sprite header; clicking the header expands the rest (the Calcs tab). */
  collapsible?: boolean;
}


/**
 * One Pokémon on the Team Report — a compact card (six fit in a row on
 * desktop): sprite with its types, held item and a Mega toggle, then
 * ability, moves, and stats. With Stat Points pasted, the stats are a table
 * — a bar per stat for its points, a +/− nature marker, and the Final
 * value — which carries the nature on its own. Without them, the nature
 * line and a one-line Final stat strip show instead (base and points in
 * each stat's tooltip).
 *
 * A Pokémon holding its own Mega Stone (or pasted as its Mega form) shows
 * the Mega by default, like PokemonHoverCard; the "Mega" pill switches the
 * sprite, types, ability and stats to the base form and back.
 */
export function PokemonReportCard({
  pokemon,
  sheet = "closed",
  collapsible = false,
}: PokemonReportCardProps) {
  const t = useMessages();
  const text = usePokemonText();
  const STAT_LABELS = t.stats.short;
  const speciesIsMegaForm = speciesNamesMegaForm(pokemon.species);
  const hasMegaForm =
    speciesIsMegaForm || candidateFormKeys(pokemon.species, pokemon.item).length > 1;
  const [showMega, setShowMega] = useState(true);
  const [isExpanded, setIsExpanded] = useState(!collapsible);
  // The form everything below is resolved from: dropping the item (and any
  // "-Mega" in the species) gives the base form.
  const formPokemon: ParsedPokemon =
    hasMegaForm && !showMega
      ? {
          ...pokemon,
          species: speciesIsMegaForm ? stripMegaSuffix(pokemon.species) : pokemon.species,
          item: undefined,
        }
      : pokemon;

  const types = resolveTypes(formPokemon.species, formPokemon.item) ?? [];
  const ability = resolveEffectiveAbility(formPokemon.species, formPokemon.item, pokemon.ability);
  const breakdown = calculateStatBreakdown(formPokemon);
  const nature = pokemon.nature ? NATURE_MODIFIERS[pokemon.nature.toLowerCase()] : undefined;
  const hasStatPoints =
    !!breakdown && STAT_ORDER.some((stat) => breakdown.statPoints[stat] > 0);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
      {/* No visible name header (trying the card without one) — the sprite
          and its tooltip identify the Pokémon; screen readers still get it. */}
      <h3 className="sr-only">{text.species(pokemon.species)}</h3>

      <div className="relative h-32 bg-zinc-100">
        {/* Collapsible: the whole header toggles the details, behind the
            item and Mega controls (which keep their own clicks). */}
        {collapsible && (
          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            aria-expanded={isExpanded}
            aria-label={`${text.species(pokemon.species)}: ${
              isExpanded ? t.pokemonCard.hideDetails : t.pokemonCard.showDetails
            }`}
            className="absolute inset-0 z-0 hover:bg-zinc-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400"
          />
        )}
        {collapsible && (
          <Icon
            name={isExpanded ? IconName.ExpandLess : IconName.ExpandMore}
            size={20}
            className="pointer-events-none absolute right-2 top-2 z-10 text-zinc-500"
          />
        )}
        {types.length > 0 && (
          <span className="pointer-events-none absolute left-2 top-2 z-10 flex gap-1">
            {types.map((type) => (
              <span key={type} className="overflow-hidden rounded">
                <TypeIcon type={type} size={22} />
              </span>
            ))}
          </span>
        )}
        <div className="pointer-events-none absolute inset-y-2 left-1/2 w-28 -translate-x-1/2">
          <div className="relative h-full w-full">
            <PokemonSprite species={formPokemon.species} item={formPokemon.item} fill />
          </div>
        </div>
        {pokemon.item && (
          <span
            title={text.item(pokemon.item)}
            className="absolute bottom-2 left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 shadow-sm"
          >
            <ItemIcon item={pokemon.item} size={24} />
          </span>
        )}
        {hasMegaForm && (
          <button
            type="button"
            onClick={() => setShowMega((value) => !value)}
            aria-pressed={showMega}
            title={showMega ? t.pokemonCard.showingMega : t.pokemonCard.showMega}
            className={`absolute bottom-2 right-2 z-10 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
              showMega
                ? "border-zinc-600 bg-zinc-600 text-white dark:bg-zinc-400"
                : "border-zinc-300 bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            {t.pokemonCard.mega}
          </button>
        )}
      </div>

      <div
        className={`flex-1 flex-col gap-2.5 p-3 text-sm text-zinc-800 ${isExpanded ? "flex" : "hidden"}`}
      >
        {ability && (
          <p className="truncate">
            <span className="text-zinc-500">{t.pokemonCard.ability}</span> {text.ability(ability)}
          </p>
        )}

        {pokemon.moves && pokemon.moves.length > 0 && (
          <ul className="flex flex-col gap-2">
            {pokemon.moves.map((move, index) => {
              const type = MOVES[normalizeSpeciesKey(move)]?.type;
              // A pill per move, its type icon filling the left edge.
              return (
                <li
                  key={`${move}-${index}`}
                  className="flex h-[22px] min-w-0 items-center overflow-hidden rounded bg-zinc-100"
                >
                  {type ? (
                    <TypeIcon type={type} size={22} />
                  ) : (
                    <span className="h-[22px] w-[22px] shrink-0 bg-zinc-300" />
                  )}
                  <span className="truncate px-2 text-[13px]">{text.move(move)}</span>
                </li>
              );
            })}
          </ul>
        )}

        {sheet === "open" ? null : breakdown && hasStatPoints ? (
          <div
            title={pokemon.nature ? t.pokemonCard.natureTitle(text.nature(pokemon.nature)) : undefined}
            // No row gap, so the Final column's left border reads as one
            // continuous divider; rows get their spacing from padding.
            className="mt-auto grid grid-cols-[2.25rem_1fr_1.25rem_0.75rem_2.5rem] items-center gap-x-1.5 text-sm tabular-nums"
          >
            {STAT_ORDER.map((stat) => {
              const boosted = breakdown.final.increasedStat === stat;
              const lowered = breakdown.final.decreasedStat === stat;
              const tone = boosted ? "text-red-600" : lowered ? "text-blue-600" : "";
              const points = breakdown.statPoints[stat];
              return (
                <div key={stat} title={t.pokemonCard.base(breakdown.base[stat])} className="contents">
                  <span className={`py-0.5 ${tone}`}>{STAT_LABELS[stat]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-zinc-200">
                    <span
                      className="block h-full rounded-full bg-zinc-400"
                      style={{ width: `${(Math.min(points, MAX_STAT_POINTS) / MAX_STAT_POINTS) * 100}%` }}
                    />
                  </span>
                  <span className="text-right">{points}</span>
                  <span className={`text-center ${tone}`}>{boosted ? "+" : lowered ? "-" : ""}</span>
                  <span className="self-stretch border-l border-zinc-300 py-0.5 text-right text-zinc-600">
                    {breakdown.final[stat]}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {pokemon.nature && (
              <p className="truncate">
                {text.nature(pokemon.nature)}
                {nature?.increased && nature.decreased && (
                  <>
                    {" "}(<span className="text-red-600">+{STAT_LABELS[nature.increased]}</span>,{" "}
                    <span className="text-blue-600">-{STAT_LABELS[nature.decreased]}</span>)
                  </>
                )}
              </p>
            )}

            {breakdown && (
              <div className="mt-auto grid grid-cols-6 border-t border-zinc-200 pt-2 text-center">
                {STAT_ORDER.map((stat) => {
                  const tone =
                    breakdown.final.increasedStat === stat
                      ? "text-red-600"
                      : breakdown.final.decreasedStat === stat
                        ? "text-blue-600"
                        : "";
                  return (
                    <div
                      key={stat}
                      title={t.pokemonCard.statTooltip(
                        STAT_LABELS[stat],
                        breakdown.base[stat],
                        breakdown.statPoints[stat],
                      )}
                      className="flex flex-col"
                    >
                      <span className={`text-[10px] text-zinc-500 ${tone}`}>{STAT_LABELS[stat]}</span>
                      <span className={`text-xs font-medium ${tone}`}>{breakdown.final[stat]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
