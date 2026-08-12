"use client";

import { useState } from "react";
import Image from "next/image";
import { resolveItemImage } from "@/lib/items/resolveItemImage";

interface ItemIconProps {
  item: string;
  size?: number;
}

export function ItemIcon({ item, size = 24 }: ItemIconProps) {
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const resolved = resolveItemImage(item);

  const useFallback = primaryFailed && Boolean(resolved?.fallbackImageUrl);
  const exhausted =
    !resolved ||
    (primaryFailed && (!resolved.fallbackImageUrl || fallbackFailed));

  if (exhausted) {
    return (
      <div
        role="img"
        aria-label={item}
        title={item}
        className="flex shrink-0 items-center justify-center rounded-full bg-mauve-200/90 text-mauve-500"
        style={{ width: size, height: size }}
      >
        <span aria-hidden="true" className="text-[8px] font-bold">
          ?
        </span>
      </div>
    );
  }

  const src = useFallback ? resolved.fallbackImageUrl! : resolved.imageUrl;

  return (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-mauve-200/90">
      <Image
        // Remounts the <Image> when switching from the PokeAPI URL to the
        // local fallback — otherwise Next can keep treating it as the same
        // errored image and never re-attempt a load.
        key={src}
        src={src}
        alt={item}
        title={item}
        width={size}
        height={size}
        unoptimized
        className="shrink-0 object-contain"
        onError={() =>
          useFallback ? setFallbackFailed(true) : setPrimaryFailed(true)
        }
      />
    </div>
  );
}
