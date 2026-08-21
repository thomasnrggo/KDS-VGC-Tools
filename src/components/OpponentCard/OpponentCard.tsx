"use client";

import { useEffect, useRef } from "react";
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
  isMatch?: (mon: ParsedPokemon) => boolean;
}

const COLUMN_CLASSES = "flex min-w-0 flex-col border-r-1 border-mauve-300";
// h-7 + items-center: matches the roster column's edit/delete icon buttons
// (also h-7) so every column header — icons or not — centers on the same
// line, instead of icon-less headers sitting a few px higher.
const COLUMN_TITLE_CLASSES =
  "flex h-7 items-center text-xs font-semibold uppercase tracking-wide text-mauve-500";

export function OpponentCard({
  opponent,
  myTeamPokemon,
  activeTeamId,
  onEdit,
  onRemove,
  onUpdatePlan,
  isMatch,
}: OpponentCardProps) {
  const plan = getPlanForTeam(opponent, activeTeamId);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Grow the notes textarea to fit its content, up to a cap — re-measured on
  // every value change. `min-h-16`/`max-h-32` (below) bound it: starts at
  // roughly two rows, grows with content, then scrolls internally past that
  // instead of growing the whole card indefinitely.
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [plan.notes]);

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

  function setLeadMega(slot: 0 | 1, value: boolean) {
    const next: [boolean, boolean] = [...plan.leadMega];
    next[slot] = value;
    onUpdatePlan((p) => ({ ...p, leadMega: next }));
  }

  function setBackMega(slot: 0 | 1, value: boolean) {
    const next: [boolean, boolean] = [...plan.backMega];
    next[slot] = value;
    onUpdatePlan((p) => ({ ...p, backMega: next }));
  }

  return (
    <li className="grid grid-cols-1 md:grid-cols-[auto_auto_1fr] lg:grid-cols-[auto_auto_1fr]">
      <div className={COLUMN_CLASSES}>
        <div className="p-4">
          <div className="mb-1 flex h-7 items-center gap-1">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <span
                title={opponent.label}
                className="max-w-48 truncate text-xs font-semibold uppercase tracking-wide text-mauve-600 md:max-w-36 lg:max-w-xs"
              >
                {opponent.label}
              </span>
              {opponent.pokepasteUrl && (
                <a
                  href={opponent.pokepasteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Poképaste"
                  title="Open Poképaste"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700"
                >
                  <Icon name={IconName.OpenInNew} size={16} />
                </a>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={`/damage-calc?opponentId=${opponent.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in Damage Calculator"
                title="Open in Damage Calculator"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700"
              >
                <Icon name={IconName.Calculate} size={16} />
              </a>
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
          </div>
          <TeamRoster pokemon={opponent.team.pokemon} isMatch={isMatch} />
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
              <div className="flex flex-col gap-1">
                <h3 className={COLUMN_TITLE_CLASSES}>Lead</h3>
                <div className="flex gap-2">
                  <PokemonSlotPicker
                    label="Lead 1"
                    myTeamPokemon={myTeamPokemon}
                    value={plan.leadPair[0]}
                    onChange={(index) => setLeadSlot(0, index)}
                    megaEnabled={plan.leadMega[0]}
                    onMegaToggle={() => setLeadMega(0, !plan.leadMega[0])}
                  />
                  <PokemonSlotPicker
                    label="Lead 2"
                    myTeamPokemon={myTeamPokemon}
                    value={plan.leadPair[1]}
                    onChange={(index) => setLeadSlot(1, index)}
                    megaEnabled={plan.leadMega[1]}
                    onMegaToggle={() => setLeadMega(1, !plan.leadMega[1])}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className={COLUMN_TITLE_CLASSES}>Back</h3>
                <div className="flex gap-2">
                  <PokemonSlotPicker
                    label="Back 1"
                    myTeamPokemon={myTeamPokemon}
                    value={plan.backPair[0]}
                    onChange={(index) => setBackSlot(0, index)}
                    megaEnabled={plan.backMega[0]}
                    onMegaToggle={() => setBackMega(0, !plan.backMega[0])}
                  />
                  <PokemonSlotPicker
                    label="Back 2"
                    myTeamPokemon={myTeamPokemon}
                    value={plan.backPair[1]}
                    onChange={(index) => setBackSlot(1, index)}
                    megaEnabled={plan.backMega[1]}
                    onMegaToggle={() => setBackMega(1, !plan.backMega[1])}
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
            ref={notesRef}
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
            className="min-h-16 max-h-32 w-full flex-1 resize-none overflow-y-auto rounded-lg bg-transparent p-2 text-sm text-mauve-800 focus:outline-none focus:ring-2 focus:ring-transparent disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>
    </li>
  );
}
