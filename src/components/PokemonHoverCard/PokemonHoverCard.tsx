"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { calculateFinalStats } from "@/lib/stats/calculateFinalStats";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { speciesNamesMegaForm, stripMegaSuffix } from "@/lib/species/megaForm";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import {
  isLikelyMegaStoneItem,
  NATURE_MODIFIERS,
  WEATHER_SPEED_DOUBLING_ABILITIES,
} from "@/constants";
import {
  estimateOpponentSpeedRange,
  type SpeedRange,
} from "@/lib/stats/estimateOpponentSpeedRange";
import { useViewportSafePosition } from "@/hooks/useViewportSafePosition";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { TypeIcon } from "../TypeIcon";
import movesData from "@/data/moves.json";
import type { ParsedPokemon } from "@/types";
import type { MoveData } from "@/types/damage";
import { cn } from "@/lib/utils";

const MOVES = movesData as unknown as Record<string, MoveData>;

type Weather = keyof typeof WEATHER_SPEED_DOUBLING_ABILITIES;

/** An ability that doubles Speed — in its weather, or Unburden once its item is gone. */
function speedDoublerFor(ability: string | undefined): { weather?: Weather } | null {
  if (!ability) return null;
  if (ability === "Unburden") return {};
  const weather = (Object.keys(WEATHER_SPEED_DOUBLING_ABILITIES) as Weather[]).find(
    (key) => WEATHER_SPEED_DOUBLING_ABILITIES[key] === ability,
  );
  return weather ? { weather } : null;
}

function formatSpeed({ min, max }: SpeedRange): string {
  return min === max ? String(min) : `${min}–${max}`;
}

function doubled({ min, max }: SpeedRange): SpeedRange {
  return { min: min * 2, max: max * 2 };
}

/**
 * Page-wide "which card is open" store, so opening one — by click or by
 * hover — closes any other — a plain module-level singleton (via useSyncExternalStore) rather
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
   * Plain content, or a render function receiving the Pokémon as it should
   * currently be displayed — the original `pokemon` prop when its Mega form
   * (if it has one) is toggled on, or a base-form copy (species/item both
   * reverted) when toggled off, so the trigger's own sprite switches forms
   * together with the panel's stats. A Pokémon with no Mega form always
   * just gets the original `pokemon` back, unchanged.
   */
  children: ReactNode | ((displayPokemon: ParsedPokemon) => ReactNode);
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
  /** Forces the popover closed regardless of hover/click state — used by PokemonSlotPicker so this card can't overlap its own swap dropdown while that's open. */
  disabled?: boolean;
  /**
   * Controls the Mega toggle from outside instead of this component tracking
   * it internally — pass both together (or neither). Used by PokemonSlotPicker
   * to persist each Lead/Back slot's Mega preference across reloads instead of
   * it resetting to "on" every time. Without these, the toggle still works but
   * only for the current render (e.g. TeamRoster's opponent-roster sprites).
   */
  megaEnabled?: boolean;
  onMegaToggle?: () => void;
  /**
   * "exact" (default): Speed from the paste — your own Pokémon. "range": an
   * opponent's, whose real Stat Points aren't known — a best-guess range.
   */
  speedMode?: "exact" | "range";
}

/**
 * Wraps a Pokémon sprite/trigger with a quick-look popover: what you need
 * at a glance about a Pokémon in a matchup — its ability (the Mega's, when
 * shown as a Mega) and item, its nature as the stat it raises (red) and
 * lowers (blue), its Speed, and its moves. Speed is exact for your own
 * Pokémon and a best-guess range for an opponent's (`speedMode`), with a
 * note when its ability doubles it (weather abilities, Unburden). The full
 * stat spread lives on the Team Report cards, not here. Renders just
 * `children` (no wrapper, no listeners) when none of ability/nature/evs/moves
 * were parsed, so there's nothing to show.
 *
 * Position comes from useViewportSafePosition, so the popover stays within
 * the viewport for triggers near the page's left/right/bottom edges instead
 * of spilling off-screen — see that hook (shared with PokemonSlotPicker's
 * dropdown) for why it's re-measured every frame rather than once.
 */
export function PokemonHoverCard({
  pokemon,
  children,
  triggerClassName,
  trigger = "hover",
  disabled = false,
  megaEnabled,
  onMegaToggle,
  speedMode = "exact",
}: PokemonHoverCardProps) {
  const t = useMessages();
  const text = usePokemonText();
  const [id] = useState(() => Symbol("pokemon-hover-card"));

  const [hoverOpen, setHoverOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentOpenId = useSyncExternalStore(
    subscribe,
    () => openId,
    () => null,
  );
  // Hover cards take part in the page-wide "one card open" store too —
  // otherwise hovering a lead/back pick while an opponent's card is open
  // (by click) shows both.
  const isOpen = !disabled && currentOpenId === id && (trigger === "click" || hoverOpen);

  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const style = useViewportSafePosition(isOpen, triggerRef, tooltipRef);
  const hasInfo = Boolean(
    pokemon.ability || pokemon.nature || pokemon.evs || pokemon.moves?.length,
  );

  // A Mega form shows up in a paste two ways: the far more common "base
  // species + Mega Stone item" (candidateFormKeys below), or the species
  // name *itself* already naming the Mega form (e.g. "Golisopod-Mega") —
  // what Showdown exports when a team was built with the Mega pre-evolved,
  // common enough in real pasted opponent sheets to need its own check (see
  // megaForm.ts). Both need to count toward hasMegaForm, and the
  // already-suffixed case needs its OWN species name stripped when toggled
  // off — stripping just the item (the old, only, behavior here) is a
  // no-op for a species string that names the Mega form directly, since
  // that string alone still resolves straight to the Mega sprite/stats
  // regardless of item.
  const speciesIsMegaForm = speciesNamesMegaForm(pokemon.species);
  const hasMegaForm =
    speciesIsMegaForm || candidateFormKeys(pokemon.species, pokemon.item).length > 1;
  const holdsUnsupportedMegaStone =
    !hasMegaForm && Boolean(pokemon.item) && isLikelyMegaStoneItem(pokemon.item!);
  const [internalShowMega, setInternalShowMega] = useState(true);
  const isMegaControlled = onMegaToggle !== undefined;
  const showMega = isMegaControlled ? (megaEnabled ?? true) : internalShowMega;
  function toggleMega() {
    if (isMegaControlled) {
      onMegaToggle!();
    } else {
      setInternalShowMega((value) => !value);
    }
  }
  const baseSpecies = speciesIsMegaForm ? stripMegaSuffix(pokemon.species) : pokemon.species;
  const effectivePokemon: ParsedPokemon =
    hasMegaForm && !showMega ? { ...pokemon, species: baseSpecies, item: undefined } : pokemon;
  const finalStats = hasInfo ? calculateFinalStats(effectivePokemon) : null;
  const nature = pokemon.nature ? NATURE_MODIFIERS[pokemon.nature.toLowerCase()] : undefined;
  // Your own Pokémon's Speed is known from its paste; an opponent's real
  // Stat Points aren't, so theirs is a best-guess range (see
  // estimateOpponentSpeedRange).
  const speed: SpeedRange | null =
    speedMode === "range"
      ? estimateOpponentSpeedRange(effectivePokemon)
      : finalStats
        ? { min: finalStats.spe, max: finalStats.spe }
        : null;
  const speedBoostedByScarf = finalStats?.speedBoostedByChoiceScarf ?? false;
  // A Mega's ability replaces the pasted one (Mega Raichu X has Electric
  // Surge, not Lightning Rod) — same lookup as PokemonReportCard.
  const ability = resolveEffectiveAbility(
    effectivePokemon.species,
    effectivePokemon.item,
    pokemon.ability,
  );
  const speedDoubler = speedDoublerFor(ability);
  const resolvedChildren = typeof children === "function" ? children(effectivePokemon) : children;

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
    return () => {
      if (openId === id) setOpenId(null);
    };
  }, [id]);

  // Cancel any pending hover-close on unmount so it can't fire setState after
  // the component's gone.
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // A Mega-eligible Pokémon still needs its popover even with nothing else
  // parsed (ability/nature/evs/moves) — that's exactly the common case for a
  // Round's opponent roster, which often reveals only species + item — since
  // the Mega toggle below is the only way to mark it as the side's Mega for
  // that game (see TournamentGameCard's single-Mega-per-side logic).
  if (!hasInfo && !hasMegaForm) {
    return <>{resolvedChildren}</>;
  }

  function openHover() {
    setHoverOpen(true);
    setOpenId(id);
  }

  function closeHover() {
    setHoverOpen(false);
    if (openId === id) setOpenId(null);
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
          // The tooltip renders below/above the trigger with a small gap
          // (see useViewportSafePosition) — moving the mouse from the trigger
          // into the tooltip crosses that gap, which briefly isn't over
          // either, so a same-tick close would unmount the tooltip before the
          // cursor arrives. Closing on a short delay (cancelled by
          // re-entering, whether that's back onto the trigger or onto the
          // tooltip itself, since it's a DOM child of this same wrapper) lets
          // the mouse actually reach and interact with the tooltip's content
          // (e.g. the Mega toggle) instead of it vanishing mid-transit.
          onMouseEnter: () => {
            if (closeTimeoutRef.current !== null) {
              clearTimeout(closeTimeoutRef.current);
              closeTimeoutRef.current = null;
            }
            openHover();
          },
          onMouseLeave: () => {
            if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = setTimeout(closeHover, 200);
          },
          onFocus: openHover,
          onBlur: closeHover,
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Escape") closeHover();
          },
        };

  return (
    <div
      ref={triggerRef}
      className={cn("relative inline-flex", triggerClassName ?? "")}
      {...interactionProps}
    >
      {resolvedChildren}
      {isOpen && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={style}
          className="pointer-events-auto z-30 flex w-[22rem] cursor-auto overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 text-left shadow-lg"
        >
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <p className="truncate text-base font-bold text-zinc-900">
                {text.species(effectivePokemon.species)}
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
                    toggleMega();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleMega();
                    }
                  }}
                  aria-pressed={showMega}
                  className={cn(
                    "shrink-0 cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors select-none",
                    showMega
                      ? "border-zinc-600 bg-chrome-600 text-white"
                      : "border-zinc-300 text-zinc-500 hover:bg-zinc-100",
                  )}
                >
                  {t.pokemonCard.mega}
                </span>
              )}
              {holdsUnsupportedMegaStone && (
                <span
                  title={t.hoverCard.unsupportedMega(text.item(pokemon.item ?? ""))}
                  className="shrink-0 cursor-help rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-400"
                >
                  Mega?
                </span>
              )}
            </div>
            {ability && <p className="truncate text-sm text-zinc-500">{text.ability(ability)}</p>}
            {pokemon.item && (
              <p className="truncate text-sm text-zinc-500">{text.item(pokemon.item)}</p>
            )}
            {pokemon.nature && (
              <p className="truncate text-sm text-zinc-700">
                {text.nature(pokemon.nature)}
                {nature?.increased && nature.decreased && (
                  <>
                    {"  "}
                    <span className="font-semibold text-red-600">
                      +{t.stats.short[nature.increased]}
                    </span>{" "}
                    <span className="font-semibold text-blue-600">
                      −{t.stats.short[nature.decreased]}
                    </span>
                  </>
                )}
              </p>
            )}
            {speed && (
              <div
                title={
                  speedMode === "range"
                    ? t.quickCard.rangeHint
                    : speedBoostedByScarf
                      ? t.hoverCard.choiceScarfSpeed(text.item("Choice Scarf"))
                      : undefined
                }
                className="mt-2 flex flex-col"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {t.quickCard.speed}
                  </span>
                  <span className="text-lg font-bold text-zinc-900 tabular-nums">
                    {formatSpeed(speed)}
                  </span>
                </span>
                {speedDoubler && (
                  <span className="text-xs text-zinc-500">
                    {speedDoubler.weather
                      ? t.quickCard.doubledInWeather(
                          t.quickCard.weather[speedDoubler.weather],
                          formatSpeed(doubled(speed)),
                        )
                      : t.quickCard.doubledByAbility(
                          text.ability("Unburden"),
                          formatSpeed(doubled(speed)),
                        )}
                  </span>
                )}
              </div>
            )}
          </div>
          {pokemon.moves && pokemon.moves.length > 0 && (
            <>
              <div className="w-px shrink-0 bg-zinc-200" />
              <div className="flex w-40 shrink-0 flex-col gap-1.5 p-3">
                {pokemon.moves.map((move) => {
                  const type = MOVES[normalizeSpeciesKey(move)]?.type;
                  return (
                    <div
                      key={move}
                      className="flex h-7 min-w-0 items-center overflow-hidden rounded-md bg-zinc-100 text-xs text-zinc-700"
                    >
                      {type ? (
                        <TypeIcon type={type} size={28} />
                      ) : (
                        <span className="h-7 w-7 shrink-0 bg-zinc-300" />
                      )}
                      <span className="min-w-0 truncate px-2">{text.move(move)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
