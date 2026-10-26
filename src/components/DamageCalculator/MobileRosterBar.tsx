"use client";

import { useLayoutEffect, useRef } from "react";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { MAX_SIDEBAR_POKEMON, type SidebarEntry } from "./RosterPokemonPicker";
import { cn } from "@/lib/utils";

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
 * Publishes its height as --calc-bar-height, which layout.tsx's <body> adds
 * to its bottom padding, so the end of the page scrolls out from under the
 * fixed bar. (It used to leave a spacer at the end of the calculator, which
 * put the footer after it, behind the bar, with a gap above it; the footer
 * is now hidden on this page below lg, see Footer.) 0 from lg up, where the
 * bar is hidden.
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

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const setHeight = () => root.style.setProperty("--calc-bar-height", `${el.offsetHeight}px`);
    setHeight();
    // Also fires on every size change (rotating, crossing lg).
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty("--calc-bar-height", "0px");
    };
  }, []);

  return (
    <>
      <nav
        ref={barRef}
        aria-label={t.calcPanel.sidebar(title)}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-chrome-700 bg-chrome-800 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div
          role="listbox"
          aria-label={t.calcPanel.sidebar(title)}
          className="flex items-center justify-center gap-2 px-3 py-3"
        >
          {sidebar.map((entry, index) => {
            const isSelected = selectedIndex === index;
            const name = text.species(entry.pokemon.species);
            return (
              <div key={index} className="relative aspect-square max-w-16 min-w-0 flex-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={
                    entry.pokemon.item ? `${name} @ ${text.item(entry.pokemon.item)}` : name
                  }
                  onClick={() => onSelectIndex(index)}
                  className={cn(
                    "relative block h-full w-full overflow-hidden rounded-lg border-2 bg-chrome-100/50 transition-colors",
                    isSelected ? "border-chrome-100" : "border-transparent",
                  )}
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
                  <span className="pointer-events-none absolute -right-1 -bottom-1">
                    <ItemIcon item={entry.pokemon.item} size={18} />
                  </span>
                )}
                {isSelected && (
                  <button
                    type="button"
                    onClick={() => onRemovePokemon(index)}
                    aria-label={t.calcPanel.remove(name)}
                    title={t.calcPanel.remove(name)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-chrome-100 text-chrome-700 shadow hover:text-red-600"
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
              className="flex aspect-square max-w-16 min-w-0 flex-1 items-center justify-center rounded-lg border-2 border-dashed border-chrome-500 text-chrome-400 transition-colors hover:border-chrome-300 hover:text-chrome-200"
            >
              <Icon name={IconName.Add} size={20} />
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
