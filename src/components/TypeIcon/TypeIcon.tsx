"use client";

import { useState } from "react";
import Image from "next/image";

interface TypeIconProps {
  type: string;
  size?: number;
}

/**
 * One of the 18 standard Pokémon types — filenames are the type name
 * lowercased (e.g. "Water" -> water.png), matching MoveData.type exactly.
 * `moves.json` also has one non-standard 19th type, "Shadow" (Pokémon
 * Colosseum/XD-exclusive moves, e.g. Shadow Rush — never legal in any real
 * VGC format and not covered by the icon set), so this still needs a
 * fallback rather than assuming a fully closed set.
 */
export function TypeIcon({ type, size = 16 }: TypeIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        role="img"
        aria-label={type}
        title={type}
        className="flex shrink-0 items-center justify-center rounded bg-mauve-200 text-[8px] font-bold text-mauve-500"
        style={{ width: size, height: size }}
      >
        ?
      </span>
    );
  }

  return (
    <Image
      src={`/resources/types-icons/${type.toLowerCase()}.png`}
      alt={type}
      title={type}
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded"
      onError={() => setFailed(true)}
    />
  );
}
