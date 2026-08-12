import type { ParsedPokemon } from "@/types";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { PokemonHoverCard } from "../PokemonHoverCard";

interface TeamRosterProps {
  pokemon: ParsedPokemon[];
  /** When set, non-matching Pokémon dim and matching ones get a highlight ring — used by the Opponents search. */
  isMatch?: (mon: ParsedPokemon) => boolean;
}

export function TeamRoster({ pokemon, isMatch }: TeamRosterProps) {
  return (
    <div className="grid grid-cols-6 gap-2 md:grid-cols-3 lg:grid-cols-6">
      {pokemon.map((mon, index) => {
        const matched = isMatch?.(mon) ?? false;
        return (
          <div
            key={`${mon.species}-${index}`}
            className="relative aspect-square w-full md:aspect-auto md:h-16 md:w-16"
          >
            <PokemonHoverCard
              pokemon={mon}
              triggerClassName="h-full w-full cursor-pointer"
              trigger="click"
            >
              {(showMega) => (
                <div
                  className={`relative h-full w-full overflow-hidden rounded-lg bg-mauve-500/20 ${matched ? "ring-2 ring-amber-400" : ""}`}
                >
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
        );
      })}
    </div>
  );
}
