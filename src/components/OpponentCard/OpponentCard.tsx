"use client";

import { getPlanForTeam } from "@/lib/opponent";
import type {
  MatchupPlan,
  Opponent,
  ParsedPokemon,
  PokemonSlot,
} from "@/types";
import { TeamRoster } from "../TeamRoster";
import { PokemonSlotPicker } from "../PokemonSlotPicker";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

interface OpponentCardProps {
  opponent: Opponent;
  myTeamPokemon: ParsedPokemon[];
  activeTeamId: string | null;
  onEdit: () => void;
  onRemove: () => void;
  onUpdatePlan: (updater: (plan: MatchupPlan) => MatchupPlan) => void;
}

const COLUMN_CLASSES = "flex min-w-0 flex-col border-r-1 border-mauve-300";
const COLUMN_TITLE_CLASSES =
  "text-xs font-semibold uppercase tracking-wide text-mauve-500";

export function OpponentCard({
  opponent,
  myTeamPokemon,
  activeTeamId,
  onEdit,
  onRemove,
  onUpdatePlan,
}: OpponentCardProps) {
  const plan = getPlanForTeam(opponent, activeTeamId);

  function setLeadSlot(slot: 0 | 1, index: PokemonSlot) {
    const next: [PokemonSlot, PokemonSlot] = [...plan.leadPair];
    next[slot] = index;
    onUpdatePlan((p) => ({ ...p, leadPair: next }));
  }

  function setBackSlot(slot: 0 | 1, index: PokemonSlot) {
    const next: [PokemonSlot, PokemonSlot] = [...plan.backPair];
    next[slot] = index;
    onUpdatePlan((p) => ({ ...p, backPair: next }));
  }

  return (
    <li className="relative grid grid-cols-1 md:grid-cols-[26rem_auto_1fr] ">
      <div className="absolute right-3 top-3 flex gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit opponent team"
          title="Edit team"
          className="flex h-7 w-7 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700"
        >
          <Icon name={IconName.Edit} size={16} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove opponent"
          title="Remove opponent"
          className="flex h-7 w-7 items-center justify-center rounded-full text-mauve-500 hover:bg-red-50 hover:text-red-600"
        >
          <Icon name={IconName.Delete} size={16} />
        </button>
      </div>

      <div className={COLUMN_CLASSES}>
        <div className="p-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide mb-1 text-mauve-600 ">
              {opponent.label}
              {opponent.pokepasteUrl && (
                <a
                  href={opponent.pokepasteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-mauve-500 underline hover:text-mauve-700 ml-1.5"
                >
                  Poképaste
                </a>
              )}
            </span>
          </div>
          <TeamRoster pokemon={opponent.team.pokemon} />
        </div>
      </div>

      <div className={COLUMN_CLASSES}>
        <div className="p-4">
          {!activeTeamId ? (
            <p className="max-w-48 text-sm text-amber-600">
              Add your own team above to pick lead/back Pokémon.
            </p>
          ) : (
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col gap-2">
                <h3 className={COLUMN_TITLE_CLASSES}>Lead</h3>
                <div className="flex gap-2">
                  <PokemonSlotPicker
                    label="Lead 1"
                    myTeamPokemon={myTeamPokemon}
                    value={plan.leadPair[0]}
                    onChange={(index) => setLeadSlot(0, index)}
                  />
                  <PokemonSlotPicker
                    label="Lead 2"
                    myTeamPokemon={myTeamPokemon}
                    value={plan.leadPair[1]}
                    onChange={(index) => setLeadSlot(1, index)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className={COLUMN_TITLE_CLASSES}>Back</h3>
                <div className="flex gap-2">
                  <PokemonSlotPicker
                    label="Back 1"
                    myTeamPokemon={myTeamPokemon}
                    value={plan.backPair[0]}
                    onChange={(index) => setBackSlot(0, index)}
                  />
                  <PokemonSlotPicker
                    label="Back 2"
                    myTeamPokemon={myTeamPokemon}
                    value={plan.backPair[1]}
                    onChange={(index) => setBackSlot(1, index)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={COLUMN_CLASSES}>
        <div className="p-4">
          <h3 className={COLUMN_TITLE_CLASSES}>Game plan</h3>
          <textarea
            value={plan.notes}
            onChange={(event) => {
              const notes = event.target.value;
              onUpdatePlan((p) => ({ ...p, notes }));
            }}
            disabled={!activeTeamId}
            rows={2}
            placeholder={
              activeTeamId
                ? "What would you do against this team?"
                : "Add your own team above to add notes."
            }
            aria-label="Notes"
            className="w-full flex-1 resize-y rounded-lg bg-transparent p-2 text-sm text-mauve-800 focus:outline-none focus:ring-2 focus:ring-transparent disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>
    </li>
  );
}
