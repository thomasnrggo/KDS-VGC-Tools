import type { ParsedPokemon } from "@/types";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { PokemonHoverCard } from "../PokemonHoverCard";

interface TeamRosterProps {
  pokemon: ParsedPokemon[];
}

export function TeamRoster({ pokemon }: TeamRosterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {pokemon.map((mon, index) => (
        <div key={`${mon.species}-${index}`} className="relative h-14 w-14 shrink-0">
          <PokemonHoverCard pokemon={mon}>
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-zinc-900">
              <PokemonSprite species={mon.species} size={50} />
            </div>
          </PokemonHoverCard>
          {mon.item && (
            <span className="absolute -bottom-1 -right-1">
              <ItemIcon item={mon.item} size={24} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
