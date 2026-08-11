import type { ParsedPokemon } from "@/types";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { PokemonHoverCard } from "../PokemonHoverCard";

interface TeamRosterProps {
  pokemon: ParsedPokemon[];
}

export function TeamRoster({ pokemon }: TeamRosterProps) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {pokemon.map((mon, index) => (
        <div
          key={`${mon.species}-${index}`}
          className="relative aspect-square w-full"
        >
          <PokemonHoverCard
            pokemon={mon}
            triggerClassName="h-full w-full cursor-pointer"
            trigger="click"
          >
            {(showMega) => (
              <div className="relative h-full w-full overflow-hidden rounded-lg bg-mauve-500/20">
                <PokemonSprite
                  species={mon.species}
                  item={showMega ? mon.item : undefined}
                  fill
                />
              </div>
            )}
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
