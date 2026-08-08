"use client";

import type { Opponent, PokemonSlot } from "@/lib/opponent";
import type { ParsedPokemon } from "@/lib/parseTeam";
import { TeamRoster } from "./TeamRoster";
import { PokemonSlotPicker } from "./PokemonSlotPicker";

interface OpponentCardProps {
  opponent: Opponent;
  myTeamPokemon: ParsedPokemon[];
  hasMyTeam: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onUpdate: (updater: (opponent: Opponent) => Opponent) => void;
}

const COLUMN_CLASSES =
  "flex min-w-0 flex-col gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-950/40";
const COLUMN_TITLE_CLASSES =
  "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

export function OpponentCard({
  opponent,
  myTeamPokemon,
  hasMyTeam,
  onEdit,
  onRemove,
  onUpdate,
}: OpponentCardProps) {
  function setLeadSlot(slot: 0 | 1, index: PokemonSlot) {
    const next: [PokemonSlot, PokemonSlot] = [...opponent.leadPair];
    next[slot] = index;
    onUpdate((o) => ({ ...o, leadPair: next }));
  }

  function setBackSlot(slot: 0 | 1, index: PokemonSlot) {
    const next: [PokemonSlot, PokemonSlot] = [...opponent.backPair];
    next[slot] = index;
    onUpdate((o) => ({ ...o, backPair: next }));
  }

  return (
    <li className="relative grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-[26rem_auto_1fr]">
      <div className="absolute right-3 top-3 flex gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit opponent team"
          title="Edit team"
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove opponent"
          title="Remove opponent"
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>

      <div className={COLUMN_CLASSES}>
        <div className="flex flex-col gap-1 pr-16">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {opponent.label}
            {opponent.pokepasteUrl && (
              <a
                href={opponent.pokepasteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 ml-1.5"
              >
                Poképaste
              </a>
            )}
          </span>
        </div>
        <TeamRoster pokemon={opponent.team.pokemon} compact />
      </div>

      <div className={COLUMN_CLASSES}>
        {!hasMyTeam ? (
          <p className="max-w-48 text-sm text-amber-600 dark:text-amber-400">
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
                  value={opponent.leadPair[0]}
                  onChange={(index) => setLeadSlot(0, index)}
                />
                <PokemonSlotPicker
                  label="Lead 2"
                  myTeamPokemon={myTeamPokemon}
                  value={opponent.leadPair[1]}
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
                  value={opponent.backPair[0]}
                  onChange={(index) => setBackSlot(0, index)}
                />
                <PokemonSlotPicker
                  label="Back 2"
                  myTeamPokemon={myTeamPokemon}
                  value={opponent.backPair[1]}
                  onChange={(index) => setBackSlot(1, index)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={COLUMN_CLASSES}>
        <h3 className={COLUMN_TITLE_CLASSES}>Notes</h3>
        <textarea
          value={opponent.notes}
          onChange={(event) => {
            const notes = event.target.value;
            onUpdate((o) => ({ ...o, notes }));
          }}
          rows={3}
          placeholder="Gameplan notes…"
          aria-label="Notes"
          className="w-full flex-1 resize-y rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>
    </li>
  );
}
