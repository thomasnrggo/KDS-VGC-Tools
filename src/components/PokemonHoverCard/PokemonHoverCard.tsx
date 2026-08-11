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

const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
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

  const hasMegaForm = candidateFormKeys(pokemon.species, pokemon.item).length > 1;
  const holdsUnsupportedMegaStone =
    !hasMegaForm && Boolean(pokemon.item) && isLikelyMegaStoneItem(pokemon.item!);
  const [showMega, setShowMega] = useState(true);
  const effectivePokemon =
    hasMegaForm && !showMega ? { ...pokemon, item: undefined } : pokemon;
  const finalStats = hasInfo ? calculateFinalStats(effectivePokemon) : null;
  const resolvedChildren =
    typeof children === "function" ? children(hasMegaForm ? showMega : true) : children;

  useEffect(() => {
    if (trigger !== "click" || !isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || tooltipRef.current?.contains(target)) {
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
    return <>{resolvedChildren}</>;
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
          className={`${trigger === "click" ? "pointer-events-auto" : "pointer-events-none"} z-30 w-48 cursor-auto rounded-lg border border-mauve-200 bg-white p-2 text-left shadow-lg`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-mauve-900">
              {pokemon.species}
            </p>
            {hasMegaForm && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowMega((value) => !value);
                }}
                aria-pressed={showMega}
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  showMega
                    ? "border-mauve-600 bg-mauve-600 text-white"
                    : "border-mauve-300 text-mauve-500 hover:bg-mauve-100"
                }`}
              >
                Mega
              </button>
            )}
            {holdsUnsupportedMegaStone && (
              <span
                title={`Holding ${pokemon.item} — this Mega form isn't in our sprite/stats data yet`}
                className="shrink-0 cursor-help rounded-full border border-mauve-200 px-2 py-0.5 text-[10px] font-semibold text-mauve-400"
              >
                Mega?
              </span>
            )}
          </div>
          {finalStats && (
            <dl className="mb-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 border-b border-mauve-100 pb-1.5 text-[11px]">
              {STAT_ORDER.map((stat) => {
                const colorClass =
                  stat === finalStats.increasedStat
                    ? "font-semibold text-red-600"
                    : stat === finalStats.decreasedStat
                      ? "font-semibold text-blue-600"
                      : "text-mauve-700";
                return (
                  <div key={stat} className="flex items-center justify-between">
                    <dt className={colorClass}>{STAT_LABELS[stat]}</dt>
                    <dd className={colorClass}>{finalStats[stat]}</dd>
                  </div>
                );
              })}
            </dl>
          )}
          <dl className="flex flex-col gap-0.5 text-[11px] text-mauve-600">
            {pokemon.ability && (
              <div className="truncate">
                <dt className="inline font-medium text-mauve-500">Ability: </dt>
                <dd className="inline">{pokemon.ability}</dd>
              </div>
            )}
            {pokemon.nature && (
              <div className="truncate">
                <dt className="inline font-medium text-mauve-500">Nature: </dt>
                <dd className="inline">{pokemon.nature}</dd>
              </div>
            )}
            {pokemon.evs && (
              <div className="truncate">
                <dt className="inline font-medium text-mauve-500">EVs: </dt>
                <dd className="inline">{pokemon.evs}</dd>
              </div>
            )}
            {pokemon.moves && pokemon.moves.length > 0 && (
              <div>
                <dt className="font-medium text-mauve-500">Moves:</dt>
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
