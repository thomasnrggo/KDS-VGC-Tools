"use client";

import { leadBackSlotProps, PokemonSlotPicker } from "../PokemonSlotPicker";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import type { ParsedPokemon, TeamCombination } from "@/types";

interface TeamCombinationCardProps {
  combination: TeamCombination;
  teamPokemon: ParsedPokemon[];
  onUpdate: (updater: (combination: TeamCombination) => TeamCombination) => void;
  onRemove: () => void;
}

/**
 * One "common combination" block on the Team Report page — a Lead pair +
 * Back pair (picked from this team's own roster, reusing the same
 * PokemonSlotPicker the Matchup Planner's opponent cards already use) plus
 * free-text notes. The four slots hold different Pokémon (picking one
 * already used swaps them) and at most one Mega — see leadBackSlotProps.
 * The page renders as many of these as the team has;
 * "Add combination" creates a new one, this card's own trash icon removes it.
 */
export function TeamCombinationCard({
  combination,
  teamPokemon,
  onUpdate,
  onRemove,
}: TeamCombinationCardProps) {
  const t = useMessages();
  const slotProps = leadBackSlotProps(combination, teamPokemon, onUpdate, t);

  return (
    <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 last:border-b-0 last:pb-0 md:flex-row md:items-stretch md:gap-6">
      {/* Leads above Back; the notes beside them stretch to the same height. */}
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t.combination.leads}
          </h3>
          <div className="flex gap-2">
            <PokemonSlotPicker {...slotProps(0)} />
            <PokemonSlotPicker {...slotProps(1)} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t.combination.back}
          </h3>
          <div className="flex gap-2">
            <PokemonSlotPicker {...slotProps(2)} />
            <PokemonSlotPicker {...slotProps(3)} />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t.combination.notes}
          </h3>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t.combination.remove}
            title={t.combination.remove}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600"
          >
            <Icon name={IconName.Delete} size={14} />
          </button>
        </div>
        <textarea
          value={combination.notes}
          onChange={(event) => {
            const notes = event.target.value;
            onUpdate((c) => ({ ...c, notes }));
          }}
          rows={4}
          placeholder={t.combination.notesPlaceholder}
          aria-label={t.combination.notesLabel}
          className="min-h-24 w-full flex-1 resize-none overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-100 p-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </div>
    </div>
  );
}
