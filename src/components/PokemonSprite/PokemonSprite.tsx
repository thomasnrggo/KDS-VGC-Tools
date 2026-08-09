import Image from "next/image";
import { resolveSpeciesImage } from "@/lib/species/resolveSpeciesImage";

interface PokemonSpriteProps {
  species: string;
  size?: number;
}

export function PokemonSprite({ species, size = 96 }: PokemonSpriteProps) {
  const resolved = resolveSpeciesImage(species);

  if (!resolved) {
    return (
      <div
        role="img"
        aria-label={species}
        className="flex shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
        style={{ width: size, height: size }}
        title={species}
      >
        <span aria-hidden="true" className="text-xs">
          ?
        </span>
      </div>
    );
  }

  return (
    <Image
      src={resolved.imageUrl}
      alt={species}
      title={species}
      width={size}
      height={size}
      className="shrink-0 object-contain"
    />
  );
}
