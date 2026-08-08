import type { ParsedPokemon } from "@/lib/parseTeam";
import { PokemonSprite } from "./PokemonSprite";

interface TeamRosterProps {
  pokemon: ParsedPokemon[];
  /** Denser icon-only row, for listing many teams at once (e.g. the opponents list). */
  compact?: boolean;
}

export function TeamRoster({ pokemon, compact = false }: TeamRosterProps) {
  const spriteSize = compact ? 56 : 80;

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap gap-4"}>
      {pokemon.map((mon, index) => (
        <div
          key={`${mon.species}-${index}`}
          className={
            compact
              ? "flex flex-col items-center"
              : "flex w-24 flex-col items-center gap-1 text-center"
          }
        >
          <PokemonSprite species={mon.species} size={spriteSize} />
          {compact ? (
            mon.item && (
              <span
                className="max-w-14 truncate text-[10px] text-zinc-500 dark:text-zinc-400"
                title={mon.item}
              >
                {mon.item}
              </span>
            )
          ) : (
            <>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-50">
                {mon.species}
              </span>
              {mon.item && (
                <span
                  className="w-full truncate text-[11px] text-zinc-500 dark:text-zinc-400"
                  title={mon.item}
                >
                  {mon.item}
                </span>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
