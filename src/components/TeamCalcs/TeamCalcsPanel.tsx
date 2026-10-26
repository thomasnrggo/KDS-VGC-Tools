"use client";

import { useState } from "react";
import { Modal, ModalDescription, ModalTitle } from "../Modal";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { parseCalcPaste } from "@/lib/teamCalcs";
import type { ParsedPokemon, TeamCalc } from "@/types";
import { TeamCalcsList } from "./TeamCalcsList";
import { Button } from "@/components/Button";

interface TeamCalcsPanelProps {
  calcs: TeamCalc[];
  teamPokemon: ParsedPokemon[];
  onAdd: (calcs: TeamCalc[]) => void;
  onRemove: (id: string) => void;
}

const PLACEHOLDER = `Charizard
Defensive
32+ Atk Tough Claws Lycanroc-Dusk Accelerock vs. 16 HP / 18 Def Mega Charizard Y: 192-228 (113.6 - 134.9%) -- guaranteed OHKO
Garchomp
Offensive
19+ SpA Mega Garchomp Z Power Gem vs. 16 HP / 0 SpD Mega Charizard Y: 180-212 (106.5 - 125.4%) -- guaranteed OHKO`;

/** The Team Report's Calcs tab: the team's benchmark calcs, and a paste box to add more (see docs/team-report.md). */
export function TeamCalcsPanel({ calcs, teamPokemon, onAdd, onRemove }: TeamCalcsPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [paste, setPaste] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function closeAdd() {
    setIsAdding(false);
    setPaste("");
  }

  function submit() {
    const { calcs: added, calcCount } = parseCalcPaste(paste, teamPokemon);
    if (added.length === 0) return;
    onAdd(added);
    const notes = added.length - calcCount;
    setNotice(
      `Added ${calcCount} calc${calcCount === 1 ? "" : "s"}${
        notes > 0 ? ` and ${notes} note${notes === 1 ? "" : "s"}` : ""
      }.`,
    );
    closeAdd();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          Benchmark damage calcs for each of your Pokémon, offensive and defensive.
        </p>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setIsAdding(true);
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-chrome-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-chrome-700"
        >
          <Icon name={IconName.Add} size={18} />
          Add calcs
        </button>
      </div>

      {notice && <p className="text-sm text-zinc-600">{notice}</p>}

      {calcs.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          No calcs yet. Paste calcs from a damage calculator — put a Pokémon&apos;s name on its own
          line to start its section, and &ldquo;Offensive&rdquo; or &ldquo;Defensive&rdquo; before
          its calcs. Calcs without a section are filed under whichever of your Pokémon they involve.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <TeamCalcsList calcs={calcs} teamPokemon={teamPokemon} onRemove={onRemove} />
        </div>
      )}

      {isAdding && (
        <Modal onClose={closeAdd} labelledBy="add-calcs-title" size="wide">
          <ModalTitle id="add-calcs-title">Add calcs</ModalTitle>
          <ModalDescription className="mb-3">
            Paste calc lines (&ldquo;… vs. …: … -- …&rdquo;). A Pokémon&apos;s name on its own line
            starts its section, &ldquo;Offensive&rdquo;/&ldquo;Defensive&rdquo; set the side, and
            any other line is kept as a note.
          </ModalDescription>
          <textarea
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            rows={12}
            placeholder={PLACEHOLDER}
            aria-label="Calcs to add"
            autoFocus
            className="w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={submit}
              disabled={!paste.trim()}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </Button>
            <Button variant="outline" onClick={closeAdd}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
