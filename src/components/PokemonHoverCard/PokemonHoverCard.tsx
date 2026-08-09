"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { calculateFinalStats } from "@/lib/stats/calculateFinalStats";
import type { ParsedPokemon, StatKey } from "@/types";

const SAFE_MARGIN = 8;

const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "ATK",
  def: "DEF",
  spa: "SPA",
  spd: "SPD",
  spe: "SPE",
};

interface PokemonHoverCardProps {
  pokemon: ParsedPokemon;
  children: ReactNode;
}

/**
 * Wraps a Pokémon sprite/trigger with a hover/focus popover showing whatever
 * ability/moves/nature/EVs were present in the pasted text, plus (when a
 * nature/EVs/species-with-known-base-stats combination resolves) computed
 * Level 50 stats — see src/lib/stats/calculateFinalStats.ts — with the
 * nature-boosted stat in red and the lowered one in blue. Renders just
 * `children` (no wrapper, no listeners) when none of ability/nature/evs/moves
 * were parsed, so there's nothing to hover.
 *
 * Position is measured (not just CSS-centered) so the popover stays within the
 * viewport for triggers near the page's left/right/bottom edges, rather than
 * spilling off-screen. It's re-measured on every animation frame while open
 * (not just once) because the page can still be reflowing shortly after
 * load — sprite/item images and the icon font loading in shift row heights —
 * and a one-shot measurement goes stale if that happens while the tooltip
 * is already open.
 */
export function PokemonHoverCard({ pokemon, children }: PokemonHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hasInfo = Boolean(
    pokemon.ability || pokemon.nature || pokemon.evs || pokemon.moves?.length,
  );
  const finalStats = hasInfo ? calculateFinalStats(pokemon) : null;

  useEffect(() => {
    if (!isOpen) return;

    let frameId: number;

    function updatePosition() {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (trigger && tooltip) {
        const triggerRect = trigger.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        const idealLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        const maxLeft = window.innerWidth - tooltipRect.width - SAFE_MARGIN;
        const left = Math.min(Math.max(idealLeft, SAFE_MARGIN), Math.max(maxLeft, SAFE_MARGIN));

        const fitsBelow =
          triggerRect.bottom + 4 + tooltipRect.height + SAFE_MARGIN <= window.innerHeight;
        const top = fitsBelow
          ? triggerRect.bottom + 4
          : triggerRect.top - tooltipRect.height - 4;

        setStyle((prev) =>
          prev.left === left && prev.top === top ? prev : { position: "fixed", left, top },
        );
      }
      frameId = requestAnimationFrame(updatePosition);
    }

    frameId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frameId);
  }, [isOpen]);

  if (!hasInfo) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
    >
      {children}
      {isOpen && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={style}
          className="pointer-events-none z-30 w-48 rounded-lg border border-zinc-200 bg-white p-2 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <p className="mb-1 truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">
            {pokemon.species}
          </p>
          {finalStats && (
            <dl className="mb-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 border-b border-zinc-100 pb-1.5 text-[11px] dark:border-zinc-800">
              {STAT_ORDER.map((stat) => {
                const colorClass =
                  stat === finalStats.increasedStat
                    ? "font-semibold text-red-600 dark:text-red-400"
                    : stat === finalStats.decreasedStat
                      ? "font-semibold text-blue-600 dark:text-blue-400"
                      : "text-zinc-700 dark:text-zinc-300";
                return (
                  <div key={stat} className="flex items-center justify-between">
                    <dt className={colorClass}>{STAT_LABELS[stat]}</dt>
                    <dd className={colorClass}>{finalStats[stat]}</dd>
                  </div>
                );
              })}
            </dl>
          )}
          <dl className="flex flex-col gap-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
            {pokemon.ability && (
              <div className="truncate">
                <dt className="inline font-medium text-zinc-500 dark:text-zinc-400">Ability: </dt>
                <dd className="inline">{pokemon.ability}</dd>
              </div>
            )}
            {pokemon.nature && (
              <div className="truncate">
                <dt className="inline font-medium text-zinc-500 dark:text-zinc-400">Nature: </dt>
                <dd className="inline">{pokemon.nature}</dd>
              </div>
            )}
            {pokemon.evs && (
              <div className="truncate">
                <dt className="inline font-medium text-zinc-500 dark:text-zinc-400">EVs: </dt>
                <dd className="inline">{pokemon.evs}</dd>
              </div>
            )}
            {pokemon.moves && pokemon.moves.length > 0 && (
              <div>
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">Moves:</dt>
                <dd>
                  <ul className="list-disc pl-4">
                    {pokemon.moves.map((move) => (
                      <li key={move} className="truncate">
                        {move}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
