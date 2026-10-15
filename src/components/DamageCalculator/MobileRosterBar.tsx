"use client";

import { useEffect, useRef, useState } from "react";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { MAX_SIDEBAR_POKEMON, type SidebarEntry } from "./RosterPokemonPicker";

interface MobileRosterBarProps {
  /** The open side's name ("Attacker"), for labels. */
  title: string;
  sidebar: SidebarEntry[];
  selectedIndex: number | null;
  /** That side's Mega toggle — the open entry's sprite follows it, like the roster strip's. */
  mega: boolean;
  onSelectIndex: (index: number) => void;
  onRemovePokemon: (index: number) => void;
  /** Adds a blank Pokémon (the default species) and opens it — the "+" tile, while there's room. */
  onAddBlank: () => void;
}

/**
 * Phones and tablets (below lg, where the sides are tabs): the open side's
 * roster as a bar fixed to the bottom of the screen — styled like the
 * Matchup Planner's mobile team bar — replacing the roster strip inside the
 * side's panel. Switching side tabs switches which roster it shows. Copying
 * a set stays in the panel ("Export Set"); the open Pokémon's × removes it.
 *
 * Renders a spacer of its own height in the page flow, so the bottom of the
 * page can still scroll out from under the fixed bar.
 */
export function MobileRosterBar({
  title,
  sidebar,
  selectedIndex,
  mega,
  onSelectIndex,
  onRemovePokemon,
  onAddBlank,
}: MobileRosterBarProps) {
  const t = useMessages();
  const text = usePokemonText();
  const barRef = useRef<HTMLElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    // Fires once on observe(), then on every size change (e.g. rotating).
    const observer = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden="true" className="lg:hidden" style={{ height: barHeight }} />
      <nav
        ref={barRef}
        aria-label={t.calcPanel.sidebar(title)}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-700 bg-zinc-800 pb-[env(safe-area-inset-bottom)] dark:border-zinc-300 dark:bg-zinc-200 lg:hidden"
      >
        <div role="listbox" aria-label={t.calcPanel.sidebar(title)} className="flex items-center justify-center gap-2 px-3 py-3">
          {sidebar.map((entry, index) => {
            const isSelected = selectedIndex === index;
            const name = text.species(entry.pokemon.species);
            return (
              <div key={index} className="relative aspect-square min-w-0 max-w-16 flex-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={entry.pokemon.item ? `${name} @ ${text.item(entry.pokemon.item)}` : name}
                  onClick={() => onSelectIndex(index)}
                  className={`relative block h-full w-full overflow-hidden rounded-lg border-2 bg-zinc-100/50 transition-colors dark:bg-zinc-900/50 ${
                    isSelected ? "border-zinc-100 dark:border-zinc-900" : "border-transparent"
                  }`}
                >
                  <span className="absolute inset-0.5">
                    <PokemonSprite
                      species={entry.pokemon.species}
                      item={isSelected && !mega ? undefined : entry.pokemon.item}
                      fill
                    />
                  </span>
                </button>
                {entry.pokemon.item && (
                  <span className="pointer-events-none absolute -bottom-1 -right-1">
                    <ItemIcon item={entry.pokemon.item} size={18} />
                  </span>
                )}
                {isSelected && (
                  <button
                    type="button"
                    onClick={() => onRemovePokemon(index)}
                    aria-label={t.calcPanel.remove(name)}
                    title={t.calcPanel.remove(name)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 shadow hover:text-red-600 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <Icon name={IconName.Close} size={12} />
                  </button>
                )}
              </div>
            );
          })}
          {sidebar.length < MAX_SIDEBAR_POKEMON && (
            <button
              type="button"
              onClick={onAddBlank}
              aria-label={t.calcPanel.addBlank(title)}
              className="flex aspect-square min-w-0 max-w-16 flex-1 items-center justify-center rounded-lg border-2 border-dashed border-zinc-500 text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-200 dark:border-zinc-500 dark:text-zinc-600 dark:hover:border-zinc-700 dark:hover:text-zinc-800"
            >
              <Icon name={IconName.Add} size={20} />
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
