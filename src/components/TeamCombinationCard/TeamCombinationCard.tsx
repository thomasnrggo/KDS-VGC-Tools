"use client";

import { useEffect, useRef } from "react";
import { PokemonSlotPicker } from "../PokemonSlotPicker";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import type { ParsedPokemon, TeamCombination, TeamPokemonSlot } from "@/types";

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
 * free-text notes. The page renders as many of these as the team has;
 * "Add combination" creates a new one, this card's own trash icon removes it.
 */
export function TeamCombinationCard({
  combination,
  teamPokemon,
  onUpdate,
  onRemove,
}: TeamCombinationCardProps) {
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [combination.notes]);

  function setLeadSlot(slot: 0 | 1, index: TeamPokemonSlot) {
    const next: [TeamPokemonSlot, TeamPokemonSlot] = [...combination.leadPair];
    next[slot] = index;
    onUpdate((c) => ({ ...c, leadPair: next }));
  }

  function setBackSlot(slot: 0 | 1, index: TeamPokemonSlot) {
    const next: [TeamPokemonSlot, TeamPokemonSlot] = [...combination.backPair];
    next[slot] = index;
    onUpdate((c) => ({ ...c, backPair: next }));
  }

  function setLeadMega(slot: 0 | 1, value: boolean) {
    const next: [boolean, boolean] = [...combination.leadMega];
    next[slot] = value;
    onUpdate((c) => ({ ...c, leadMega: next }));
  }

  function setBackMega(slot: 0 | 1, value: boolean) {
    const next: [boolean, boolean] = [...combination.backMega];
    next[slot] = value;
    onUpdate((c) => ({ ...c, backMega: next }));
  }

  return (
    <div className="flex flex-col gap-3 border-b border-mauve-200 pb-4 last:border-b-0 last:pb-0 md:flex-row md:items-start md:gap-6">
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
            Leads
          </h3>
          <div className="flex gap-2">
            <PokemonSlotPicker
              label="Lead 1"
              myTeamPokemon={teamPokemon}
              value={combination.leadPair[0]}
              onChange={(index) => setLeadSlot(0, index)}
              megaEnabled={combination.leadMega[0]}
              onMegaToggle={() => setLeadMega(0, !combination.leadMega[0])}
            />
            <PokemonSlotPicker
              label="Lead 2"
              myTeamPokemon={teamPokemon}
              value={combination.leadPair[1]}
              onChange={(index) => setLeadSlot(1, index)}
              megaEnabled={combination.leadMega[1]}
              onMegaToggle={() => setLeadMega(1, !combination.leadMega[1])}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
            Back
          </h3>
          <div className="flex gap-2">
            <PokemonSlotPicker
              label="Back 1"
              myTeamPokemon={teamPokemon}
              value={combination.backPair[0]}
              onChange={(index) => setBackSlot(0, index)}
              megaEnabled={combination.backMega[0]}
              onMegaToggle={() => setBackMega(0, !combination.backMega[0])}
            />
            <PokemonSlotPicker
              label="Back 2"
              myTeamPokemon={teamPokemon}
              value={combination.backPair[1]}
              onChange={(index) => setBackSlot(1, index)}
              megaEnabled={combination.backMega[1]}
              onMegaToggle={() => setBackMega(1, !combination.backMega[1])}
            />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
            Notes
          </h3>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove combination"
            title="Remove combination"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-mauve-500 hover:bg-red-50 hover:text-red-600"
          >
            <Icon name={IconName.Delete} size={14} />
          </button>
        </div>
        <textarea
          ref={notesRef}
          value={combination.notes}
          onChange={(event) => {
            const notes = event.target.value;
            onUpdate((c) => ({ ...c, notes }));
          }}
          rows={2}
          placeholder="When would you use this combination?"
          aria-label="Combination notes"
          className="min-h-16 max-h-32 w-full flex-1 resize-none overflow-y-auto rounded-lg border border-mauve-200 bg-mauve-100 p-2 text-sm text-mauve-800 focus:outline-none focus:ring-2 focus:ring-mauve-400"
        />
      </div>
    </div>
  );
}
