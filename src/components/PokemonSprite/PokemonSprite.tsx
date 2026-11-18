"use client";

import { createContext, useContext, type ReactNode } from "react";
import Image from "next/image";
import { resolveSpeciesImage } from "@/lib/species/resolveSpeciesImage";
import { usePokemonText } from "@/hooks/useLanguage";

interface PokemonSpriteProps {
  species: string;
  /** Held item — only used to infer a Mega Evolution sprite via resolveSpeciesImage. */
  item?: string;
  size?: number;
  /**
   * Fill the parent element instead of using an intrinsic pixel size — the
   * parent must be positioned (e.g. `relative`) and sized (e.g. `aspect-square`).
   * Lets the sprite scale proportionally with a responsive grid cell.
   */
  fill?: boolean;
}

/**
 * `unoptimized` on both <Image>s below: these are our own pre-compressed
 * static PNGs (see PLANNING.md's sprite pipeline) — running them through
 * Next's Image Optimization again is pure overhead (extra serverless
 * invocations per unique size, subject to Vercel's optimization rate limits),
 * and was the main cause of slow-to-appear sprites in production.
 */
/** Whether sprites show their name on hover (the browser's tooltip) — off inside a Pokémon card's trigger. */
const SpriteTitleContext = createContext(true);

/**
 * Sprites inside it don't show their name on hover: they open a Pokémon card
 * that already names it (PokemonHoverCard, the watch-outs' threat tiles), and
 * the browser's tooltip would sit on top of it.
 */
export function NoSpriteTitles({ children }: { children: ReactNode }) {
  return <SpriteTitleContext.Provider value={false}>{children}</SpriteTitleContext.Provider>;
}

export function PokemonSprite({ species, item, size = 96, fill = false }: PokemonSpriteProps) {
  const resolved = resolveSpeciesImage(species, item);
  // Only the label is translated — `species` itself stays the English name the sprite lookup needs.
  const label = usePokemonText().species(species);
  const title = useContext(SpriteTitleContext) ? label : undefined;

  if (!resolved) {
    return (
      <div
        role="img"
        aria-label={label}
        className={
          fill
            ? "absolute inset-0 flex items-center justify-center rounded-full bg-zinc-200 text-zinc-500"
            : "flex shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500"
        }
        style={fill ? undefined : { width: size, height: size }}
        title={title}
      >
        <span aria-hidden="true" className="text-xs">
          ?
        </span>
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={resolved.imageUrl}
        alt={label}
        title={title}
        fill
        unoptimized
        sizes="(max-width: 768px) 15vw, 80px"
        className="object-contain p-1"
      />
    );
  }

  return (
    <Image
      src={resolved.imageUrl}
      alt={label}
      title={title}
      width={size}
      height={size}
      unoptimized
      className="shrink-0 object-contain"
    />
  );
}
