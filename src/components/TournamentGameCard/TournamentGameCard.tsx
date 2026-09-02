"use client";

import { useEffect, useRef, useState } from "react";
import { PokemonSlotPicker } from "../PokemonSlotPicker";
import type { ParsedPokemon, TeamPokemonSlot, TournamentGame } from "@/types";

interface TournamentGameCardProps {
  label: string;
  game: TournamentGame;
  opponentTeam: ParsedPokemon[];
  myTeam: ParsedPokemon[];
  onUpdate: (updater: (game: TournamentGame) => TournamentGame) => void;
}

/**
 * One Bo3 game: Win/Loss, which 4 of the opponent's (revealed) 6 they
 * brought, which 4 of your own team you brought (both via the same
 * PokemonSlotPicker the Matchup Planner's Lead/Back columns already use —
 * just "which 4", not lead/back-ordered, since VGC bring-4 doesn't have
 * that structure), and free-text notes.
 *
 * Mega-toggle state per pick slot is deliberately local-only (not persisted
 * to TournamentGame) — PokemonSlotPicker requires *some* megaEnabled/
 * onMegaToggle to stay functional, but which pick got Mega'd in a given
 * game isn't part of what this feature tracks (usage stats only care
 * *which* Pokémon was brought, not its Mega state that game), so there's
 * nothing worth widening the data model for here.
 */
export function TournamentGameCard({
  label,
  game,
  opponentTeam,
  myTeam,
  onUpdate,
}: TournamentGameCardProps) {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [megaState, setMegaState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [game.notes]);

  function setResult(result: "win" | "loss") {
    onUpdate((g) => ({ ...g, result: g.result === result ? null : result }));
  }

  function setPick(
    side: "opponentPicks" | "myPicks",
    slot: 0 | 1 | 2 | 3,
    index: TeamPokemonSlot,
  ) {
    onUpdate((g) => {
      const next = [...g[side]] as TournamentGame["opponentPicks"];
      next[slot] = index;
      return { ...g, [side]: next };
    });
  }

  function pickerSlots(
    side: "opponentPicks" | "myPicks",
    roster: ParsedPokemon[],
    picks: TournamentGame["opponentPicks"],
  ) {
    return [0, 1, 2, 3].map((slot) => {
      const key = `${game.id}-${side}-${slot}`;
      return (
        <PokemonSlotPicker
          key={slot}
          label={`${side === "opponentPicks" ? "Opponent" : "Your"} pick ${slot + 1}`}
          myTeamPokemon={roster}
          value={picks[slot]}
          onChange={(index) => setPick(side, slot as 0 | 1 | 2 | 3, index)}
          megaEnabled={megaState[key] ?? true}
          onMegaToggle={() => setMegaState((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }))}
        />
      );
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-mauve-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-mauve-900">{label}</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setResult("win")}
            aria-pressed={game.result === "win"}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              game.result === "win"
                ? "border-green-600 bg-green-600 text-white"
                : "border-mauve-300 text-mauve-500 hover:bg-mauve-100"
            }`}
          >
            Win
          </button>
          <button
            type="button"
            onClick={() => setResult("loss")}
            aria-pressed={game.result === "loss"}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              game.result === "loss"
                ? "border-red-600 bg-red-600 text-white"
                : "border-mauve-300 text-mauve-500 hover:bg-mauve-100"
            }`}
          >
            Loss
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
          Opponent&apos;s picks
        </span>
        <div className="flex flex-wrap gap-2">
          {pickerSlots("opponentPicks", opponentTeam, game.opponentPicks)}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
          Your picks
        </span>
        <div className="flex flex-wrap gap-2">{pickerSlots("myPicks", myTeam, game.myPicks)}</div>
      </div>

      <textarea
        ref={notesRef}
        value={game.notes}
        onChange={(event) => {
          const notes = event.target.value;
          onUpdate((g) => ({ ...g, notes }));
        }}
        rows={2}
        placeholder="Add comments here…"
        aria-label={`${label} notes`}
        className="min-h-16 max-h-40 w-full resize-none overflow-y-auto rounded-lg border border-mauve-200 bg-mauve-100 p-2 text-sm text-mauve-800 focus:outline-none focus:ring-2 focus:ring-mauve-400"
      />
    </div>
  );
}
