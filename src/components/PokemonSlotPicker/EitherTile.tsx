import type { ReactNode } from "react";

/**
 * A pick slot holding "A or B": the tile split corner to corner, the first
 * Pokémon in the top-left half and the alternative in the bottom-right, a
 * thin diagonal line between. `first`/`second` fill their corner (e.g. a
 * PokemonSprite with `fill`).
 */
export function EitherTile({ first, second }: { first: ReactNode; second: ReactNode }) {
  return (
    <span className="relative block h-full w-full overflow-hidden rounded-lg bg-zinc-500/20">
      <span className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]">
        <span className="absolute top-0 left-0 h-[68%] w-[68%]">{first}</span>
      </span>
      <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
        <span className="absolute right-0 bottom-0 h-[68%] w-[68%]">{second}</span>
      </span>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-zinc-400/70"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line
          x1="100"
          y1="0"
          x2="0"
          y2="100"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
