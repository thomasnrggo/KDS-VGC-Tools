"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { calculateFinalStats } from "@/lib/stats/calculateFinalStats";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { isLikelyMegaStoneItem } from "@/constants";
import type { ParsedPokemon, StatKey } from "@/types";

const SAFE_MARGIN = 8;

// Two side-by-side stat columns, matching how VGC players read a stat screen.
const LEFT_STATS: StatKey[] = ["hp", "def", "spd"];
const RIGHT_STATS: StatKey[] = ["atk", "spa", "spe"];
const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "ATK",
  def: "DEF",
  spa: "SPA",
  spd: "SPD",
  spe: "SPE",
};

/**
 * Page-wide "which click-triggered card is open" store, so opening one closes
 * any other — a plain module-level singleton (via useSyncExternalStore) rather
 * than a Context, since there's no natural single provider all opponent cards
 * share and this needs to coordinate across all of them.
 */
let openId: symbol | null = null;
const listeners = new Set<() => void>();

function setOpenId(id: symbol | null) {
  openId = id;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

interface PokemonHoverCardProps {
  pokemon: ParsedPokemon;
  /**
   * Plain content, or a render function receiving whether the Mega form is
   * currently toggled on — only meaningful (and only ever passed `false`) for
   * a Pokémon holding a Mega Stone, so the trigger's own sprite can switch
   * forms together with the panel's stats. Non-mega holders always get `true`.
   */
  children: ReactNode | ((showMega: boolean) => ReactNode);
  /** Extra classes for the trigger wrapper — e.g. "h-full w-full" so it fills a responsive grid cell instead of shrink-wrapping to its (fixed-size) children. */
  triggerClassName?: string;
  /**
   * "hover" (default) opens on mouse enter/focus, closes on leave/blur —
   * used for my own lead/back picks. "click" opens/closes on click (toggle),
   * closes on outside click/Escape, and only ever has one instance open across
   * the whole page — used for opponent rosters, where hovering while scanning
   * several teams kept popping cards open unintentionally.
   */
  trigger?: "hover" | "click";
}

/**
 * Wraps a Pokémon sprite/trigger with a popover showing whatever
 * ability/moves/nature/EVs were present in the pasted text, plus (when a
 * nature/EVs/species-with-known-base-stats combination resolves) computed
 * Level 50 stats — see src/lib/stats/calculateFinalStats.ts — with the
 * nature-boosted stat in red and the lowered one in blue. Renders just
 * `children` (no wrapper, no listeners) when none of ability/nature/evs/moves
 * were parsed, so there's nothing to show.
 *
 * Position is measured (not just CSS-centered) so the popover stays within the
 * viewport for triggers near the page's left/right/bottom edges, rather than
 * spilling off-screen. It's re-measured on every animation frame while open
 * (not just once) because the page can still be reflowing shortly after
 * load — sprite/item images and the icon font loading in shift row heights —
 * and a one-shot measurement goes stale if that happens while the tooltip
 * is already open.
 */
export function PokemonHoverCard({
  pokemon,
  children,
  triggerClassName,
  trigger = "hover",
}: PokemonHoverCardProps) {
  const [id] = useState(() => Symbol("pokemon-hover-card"));

  const [hoverOpen, setHoverOpen] = useState(false);
  const currentOpenId = useSyncExternalStore(
    subscribe,
    () => openId,
    () => null,
  );
  const isOpen = trigger === "click" ? currentOpenId === id : hoverOpen;

  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hasInfo = Boolean(
    pokemon.ability || pokemon.nature || pokemon.evs || pokemon.moves?.length,
  );

  const hasMegaForm =
    candidateFormKeys(pokemon.species, pokemon.item).length > 1;
  const holdsUnsupportedMegaStone =
    !hasMegaForm &&
    Boolean(pokemon.item) &&
    isLikelyMegaStoneItem(pokemon.item!);
  const [showMega, setShowMega] = useState(true);
  const effectivePokemon =
    hasMegaForm && !showMega ? { ...pokemon, item: undefined } : pokemon;
  const finalStats = hasInfo ? calculateFinalStats(effectivePokemon) : null;
  const resolvedChildren =
    typeof children === "function"
      ? children(hasMegaForm ? showMega : true)
      : children;

  useEffect(() => {
    if (trigger !== "click" || !isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return;
      }
      setOpenId(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [trigger, isOpen]);

  useEffect(() => {
    if (trigger !== "click") return;
    return () => {
      if (openId === id) setOpenId(null);
    };
  }, [trigger, id]);

  useEffect(() => {
    if (!isOpen) return;

    let frameId: number;

    function updatePosition() {
      const triggerEl = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (triggerEl && tooltip) {
        const triggerRect = triggerEl.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        const idealLeft =
          triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        const maxLeft = window.innerWidth - tooltipRect.width - SAFE_MARGIN;
        const left = Math.min(
          Math.max(idealLeft, SAFE_MARGIN),
          Math.max(maxLeft, SAFE_MARGIN),
        );

        const fitsBelow =
          triggerRect.bottom + 4 + tooltipRect.height + SAFE_MARGIN <=
          window.innerHeight;
        const top = fitsBelow
          ? triggerRect.bottom + 4
          : triggerRect.top - tooltipRect.height - 4;

        setStyle((prev) =>
          prev.left === left && prev.top === top
            ? prev
            : { position: "fixed", left, top },
        );
      }
      frameId = requestAnimationFrame(updatePosition);
    }

    frameId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frameId);
  }, [isOpen]);

  if (!hasInfo) {
    return <>{resolvedChildren}</>;
  }

  function statClassName(stat: StatKey): string {
    const boosted = finalStats && stat === finalStats.increasedStat;
    const lowered = finalStats && stat === finalStats.decreasedStat;
    const scarfed = stat === "spe" && finalStats?.speedBoostedByChoiceScarf;
    return [
      boosted ? "text-red-600" : lowered ? "text-blue-600" : "text-mauve-800",
      boosted || lowered || scarfed ? "font-bold" : "font-medium",
    ].join(" ");
  }

  const interactionProps =
    trigger === "click"
      ? {
          role: "button" as const,
          tabIndex: 0,
          onClick: (event: React.MouseEvent) => {
            // The tooltip is a DOM child of this trigger, so a click on its
            // content (which now has pointer-events: auto, to stop clicks
            // passing through to whatever's underneath) bubbles up here too —
            // ignore that instead of toggling closed on every click inside it.
            if (tooltipRef.current?.contains(event.target as Node)) return;
            setOpenId(isOpen ? null : id);
          },
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpenId(isOpen ? null : id);
            } else if (event.key === "Escape") {
              setOpenId(null);
            }
          },
        }
      : {
          onMouseEnter: () => setHoverOpen(true),
          onMouseLeave: () => setHoverOpen(false),
          onFocus: () => setHoverOpen(true),
          onBlur: () => setHoverOpen(false),
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Escape") setHoverOpen(false);
          },
        };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${triggerClassName ?? ""}`}
      {...interactionProps}
    >
      {resolvedChildren}
      {isOpen && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={style}
          className={`${trigger === "click" ? "pointer-events-auto" : "pointer-events-none"} z-30 flex w-80 cursor-auto overflow-hidden rounded-xl border border-mauve-200 bg-white text-left shadow-lg`}
        >
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <p className="truncate text-base font-bold text-mauve-900">
                {pokemon.species}
              </p>
              {hasMegaForm && (
                // A real <button> here can end up nested inside another
                // <button> — PokemonSlotPicker's selected-slot trigger is a
                // <button> that wraps this whole card via PokemonHoverCard —
                // which is invalid HTML and causes a hydration mismatch. A
                // span with button semantics avoids that while staying
                // keyboard-accessible.
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowMega((value) => !value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      setShowMega((value) => !value);
                    }
                  }}
                  aria-pressed={showMega}
                  className={`shrink-0 cursor-pointer select-none rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                    showMega
                      ? "border-mauve-600 bg-mauve-600 text-white"
                      : "border-mauve-300 text-mauve-500 hover:bg-mauve-100"
                  }`}
                >
                  Mega
                </span>
              )}
              {holdsUnsupportedMegaStone && (
                <span
                  title={`Holding ${pokemon.item} — this Mega form isn't in our sprite/stats data yet`}
                  className="shrink-0 cursor-help rounded-full border border-mauve-200 px-2.5 py-0.5 text-xs font-semibold text-mauve-400"
                >
                  Mega?
                </span>
              )}
            </div>
            {pokemon.ability && (
              <p className="mb-2 truncate text-sm text-mauve-400">
                {pokemon.ability}
              </p>
            )}
            {finalStats && (
              <div className="flex text-sm">
                <dl className="flex flex-1 flex-col gap-1 pr-2">
                  {LEFT_STATS.map((stat) => (
                    <div
                      key={stat}
                      className="flex items-center justify-between gap-2"
                    >
                      <dt className={statClassName(stat)}>
                        {STAT_LABELS[stat]}
                      </dt>
                      <dd className={statClassName(stat)}>
                        {finalStats[stat]}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="w-px shrink-0 bg-mauve-200" />
                <dl className="flex flex-1 flex-col gap-1 pl-2">
                  {RIGHT_STATS.map((stat) => (
                    <div
                      key={stat}
                      className="flex items-center justify-between gap-2"
                    >
                      <dt
                        className={statClassName(stat)}
                        title={
                          stat === "spe" && finalStats.speedBoostedByChoiceScarf
                            ? "Includes Choice Scarf's ×1.5 Speed boost"
                            : undefined
                        }
                      >
                        {STAT_LABELS[stat]}
                      </dt>
                      <dd className={statClassName(stat)}>
                        {finalStats[stat]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {/* {(pokemon.nature || pokemon.evs) && (
              <div className="mt-2 flex flex-col gap-0.5 border-t border-mauve-100 pt-2 text-[11px] text-mauve-400">
                {pokemon.nature && <p className="truncate">{pokemon.nature} Nature</p>}
                {pokemon.evs && <p className="truncate">EVs: {pokemon.evs}</p>}
              </div>
            )} */}
          </div>
          {pokemon.moves && pokemon.moves.length > 0 && (
            <>
              <div className="w-px shrink-0 bg-mauve-200" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                {pokemon.moves.map((move) => (
                  <div
                    key={move}
                    className="rounded-md bg-mauve-100 px-2.5 py-1.5 text-xs text-mauve-700"
                  >
                    {move}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
