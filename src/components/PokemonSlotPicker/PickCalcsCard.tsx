"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TeamCalcRow } from "../TeamCalcs";
import { PokemonSprite } from "../PokemonSprite";
import { useViewportSafePosition } from "@/hooks/useViewportSafePosition";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { megaDisplay } from "@/lib/species/megaDisplay";
import type { CalcsBetween } from "@/lib/teamCalcs";
import type { ParsedPokemon, TeamCalc } from "@/types";
import { cn } from "@/lib/utils";

/** What a lead/back slot's calcs card shows — see GamePlanCard. */
export interface SlotCalcs extends CalcsBetween {
  /** The Pokémon on the other side of a calc — rows are grouped under it. */
  counterpart: (calc: TeamCalc) => { key: string; species: string } | undefined;
  /** The other side has no picks yet, so these are against its whole team. */
  wholeTeam: boolean;
  /** The calcs of the slot's alternative ("A or B"), when it has one. */
  alternative?: CalcsBetween;
}

/**
 * Wraps a picked lead/back slot with its calcs against the other side's
 * picks: offensive and defensive side by side, each grouped by the other
 * Pokémon (calcsBetween sorts them). Mouse hover only — on touch screens a
 * tap opens the picker, and the matchup page's Calcs tab has them all. The
 * Mega toggle lives here too, since this replaces the slot's Pokémon card.
 */
export function PickCalcsCard({
  pokemon,
  alternative,
  alternativeMega = false,
  calcs,
  disabled,
  megaEnabled,
  onMegaToggle,
  children,
}: {
  pokemon: ParsedPokemon;
  /** The slot's alternative ("A or B") — its calcs follow the pick's. */
  alternative?: ParsedPokemon;
  alternativeMega?: boolean;
  calcs: SlotCalcs;
  /** Forces it closed — while the slot's picker is open. */
  disabled: boolean;
  megaEnabled: boolean;
  onMegaToggle: () => void;
  children: ReactNode;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const [hovered, setHovered] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isOpen = !disabled && hovered;
  const style = useViewportSafePosition(isOpen, rootRef, cardRef);

  const { hasMegaForm, displayPokemon } = megaDisplay(pokemon, megaEnabled);
  const alternativeName =
    alternative && text.species(megaDisplay(alternative, alternativeMega).displayPokemon.species);
  const name = alternativeName
    ? `${text.species(displayPokemon.species)} / ${alternativeName}`
    : text.species(displayPokemon.species);
  // One block per Pokémon in the slot: the pick, then (titled) its alternative.
  const blocks = [
    {
      key: "pick",
      title: alternativeName ? text.species(displayPokemon.species) : undefined,
      calcs: calcs as CalcsBetween,
    },
    ...(alternativeName && calcs.alternative
      ? [
          {
            key: "alternative",
            title: t.matchupPage.pickCalcsOr(alternativeName),
            calcs: calcs.alternative,
          },
        ]
      : []),
  ];
  const count = blocks.reduce(
    (sum, block) => sum + block.calcs.offensive.length + block.calcs.defensive.length,
    0,
  );

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Mouse only: a tap fires pointerenter too, and would leave the card open
  // behind the picker. The short close delay lets the mouse cross the gap
  // into the card (a DOM child, so being over it still counts as inside).
  function handlePointerEnter(event: React.PointerEvent) {
    if (event.pointerType !== "mouse") return;
    if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
    setHovered(true);
  }
  function handlePointerLeave(event: React.PointerEvent) {
    if (event.pointerType !== "mouse") return;
    if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => setHovered(false), 200);
  }

  return (
    <div
      ref={rootRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className="relative flex h-full w-full items-center justify-center"
    >
      {children}
      {isOpen && (
        <div
          ref={cardRef}
          role="dialog"
          aria-label={t.matchupPage.pickCalcsTitle(name)}
          style={style}
          className="z-30 flex max-h-[min(28rem,70dvh)] w-[min(36rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 text-left shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-900">
              {t.matchupPage.pickCalcsTitle(name)}
            </p>
            {hasMegaForm && (
              <button
                type="button"
                onClick={onMegaToggle}
                aria-pressed={megaEnabled}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                  megaEnabled
                    ? "border-zinc-600 bg-chrome-600 text-white"
                    : "border-zinc-300 text-zinc-500 hover:bg-zinc-100",
                )}
              >
                {t.pokemonCard.mega}
              </button>
            )}
          </div>
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-3 py-2">
            {calcs.wholeTeam && (
              <p className="text-xs text-zinc-500">{t.matchupPage.pickCalcsWholeTeam}</p>
            )}
            {count === 0 ? (
              <p className="py-1 text-xs text-zinc-500">{t.matchupPage.pickCalcsNone}</p>
            ) : (
              blocks.map((block) => (
                <div key={block.key} className="flex flex-col gap-1">
                  {block.title && <p className="text-xs font-bold text-zinc-900">{block.title}</p>}
                  <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                    {[
                      { label: t.calc.offensive, entries: block.calcs.offensive },
                      { label: t.calc.defensive, entries: block.calcs.defensive },
                    ].map(({ label, entries }) => (
                      <section key={label} className="flex min-w-0 flex-col">
                        <h4 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                          {label} · {entries.length}
                        </h4>
                        {entries.length === 0 ? (
                          <p className="py-1.5 text-xs text-zinc-400">—</p>
                        ) : (
                          groupByCounterpart(entries, calcs.counterpart).map((group) => (
                            <div key={group.key} className="flex flex-col pt-1.5">
                              {group.species && (
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                                  <PokemonSprite species={group.species} size={24} />
                                  {text.species(group.species)}
                                </p>
                              )}
                              <ul className="flex flex-col divide-y divide-zinc-200">
                                {group.calcs.map((calc) => (
                                  <TeamCalcRow key={calc.id} calc={calc} sprite={null} />
                                ))}
                              </ul>
                            </div>
                          ))
                        )}
                      </section>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Consecutive calcs against the same Pokémon, in order (they come sorted by it). */
function groupByCounterpart(
  calcs: TeamCalc[],
  counterpart: SlotCalcs["counterpart"],
): { key: string; species?: string; calcs: TeamCalc[] }[] {
  const groups: { key: string; species?: string; calcs: TeamCalc[] }[] = [];
  for (const calc of calcs) {
    const other = counterpart(calc);
    const key = other?.key ?? "";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.calcs.push(calc);
    else groups.push({ key, species: other?.species, calcs: [calc] });
  }
  return groups;
}
