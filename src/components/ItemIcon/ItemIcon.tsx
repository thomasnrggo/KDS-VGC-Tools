"use client";

import { useState } from "react";
import Image from "next/image";
import { resolveItemImage } from "@/lib/items/resolveItemImage";

interface ItemIconProps {
  item: string;
  size?: number;
}

export function ItemIcon({ item, size = 24 }: ItemIconProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveItemImage(item);

  if (!resolved || failed) {
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

  return (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-mauve-200/90">
      <Image
        src={resolved.imageUrl}
        alt={item}
        title={item}
        width={size}
        height={size}
        className="shrink-0 object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
