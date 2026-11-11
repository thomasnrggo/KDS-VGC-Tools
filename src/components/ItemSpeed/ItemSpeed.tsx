"use client";

import { useState, type MouseEvent } from "react";
import { ItemIcon } from "../ItemIcon";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

interface ItemSpeedProps {
  /** The stat screen's Speed (before the item). */
  speed: number;
  /** The in-battle Speed with the item. */
  withItem: number;
  item: string;
  /**
   * Not switchable: the stat screen's value with the in-battle one on hover —
   * inside something with its own click (the Team Builder's Stats box, which
   * opens the Stat Points table, where it does switch).
   */
  static?: boolean;
  className?: string;
}

/**
 * Speed changed by a held item (Choice Scarf, Iron Ball): the stat screen's
 * value marked *, and a click switches to the in-battle value (with the
 * item's icon) and back — on the Overview's cards and the Team Builder's Stat
 * Points table. `static` only shows it (the Team Builder's Stats box).
 */
export function ItemSpeed({
  speed,
  withItem,
  item,
  static: isStatic = false,
  className,
}: ItemSpeedProps) {
  const t = useMessages();
  const text = usePokemonText();
  const [showItem, setShowItem] = useState(false);
  const itemName = text.item(item);
  const label = showItem
    ? t.pokemonCard.speedWithoutItemHint(itemName, speed)
    : t.pokemonCard.speedWithItemHint(itemName, withItem);

  function toggle(event: MouseEvent) {
    // It sits on a card that opens the Pokémon, or in the Stats box that opens the table.
    event.preventDefault();
    event.stopPropagation();
    setShowItem((on) => !on);
  }

  // Both states take the same room — a fixed slot for the * or the item's
  // icon, and exactly one line of text — so switching never shifts the row.
  const content = (
    <>
      <span aria-hidden="true" className="flex w-3.5 shrink-0 items-center justify-center">
        {showItem ? <ItemIcon item={item} size={12} /> : <span className="text-zinc-400">*</span>}
      </span>
      {showItem ? withItem : speed}
    </>
  );
  const classes = cn(
    "relative z-10 inline-flex h-lh cursor-pointer items-center justify-end rounded align-top leading-[inherit] tabular-nums hover:bg-zinc-200",
    className,
  );

  if (isStatic) {
    const hint = t.pokemonCard.speedWithItem(itemName, withItem);
    return (
      <span
        title={hint}
        aria-label={hint}
        className={cn(
          "inline-flex h-lh cursor-help items-center justify-end align-top leading-[inherit] tabular-nums",
          className,
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={showItem}
      title={label}
      aria-label={label}
      className={cn(
        classes,
        "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none",
      )}
    >
      {content}
    </button>
  );
}
