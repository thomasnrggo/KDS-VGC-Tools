import { PokemonSprite } from "../PokemonSprite";
import type { ParsedPokemon } from "@/types";

interface OpponentTeamPreviewProps {
  pokemon: ParsedPokemon[];
}

/**
 * A bare-bones roster preview for the Tournament page's rounds list — just
 * the six sprites, no item badge and no name/tooltip, unlike every other
 * sprite-tile component in the app (TeamRoster, OpponentPokemonCard). This
 * is a glance-at-a-list-of-rounds context, not a "look closely at one
 * opponent" context, so the extra detail those add would be noise here.
 */
export function OpponentTeamPreview({ pokemon }: OpponentTeamPreviewProps) {
  if (pokemon.length === 0) return null;

  return (
    <div className="flex gap-1">
      {pokemon.map((mon, index) => (
        <div
          key={`${mon.species}-${index}`}
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-zinc-500/20"
        >
          {/* item is passed only so a held Mega Stone renders the correct Mega
              art — no item badge is shown here, per this component's whole point. */}
          <PokemonSprite species={mon.species} item={mon.item} fill />
        </div>
      ))}
    </div>
  );
}
