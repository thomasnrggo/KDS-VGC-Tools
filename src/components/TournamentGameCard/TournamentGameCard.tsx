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
 *
 * Every slot defaults to its base form — no auto-guessing which pick is
 * "the" Mega, even when only one of the 4 has a Mega form at all, since a
 * pasted item doesn't confirm it actually got used that game. Mega'ing a
 * pick is always an explicit choice via the hover card's Mega toggle (see
 * PokemonHoverCard), and since only one Pokémon per side can actually Mega
 * Evolve in a real game, setMegaForSlot enforces that exclusivity itself —
 * turning one slot's Mega on always turns off whichever other slot on that
 * same side was on.
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
  // Once a result is set, the three Win/Loss/Tie buttons collapse down to
  // just the chosen one — clicking that single pill re-expands the group
  // (rather than clearing the result) so you can pick a different one.
  const [resultExpanded, setResultExpanded] = useState(false);
  const showAllResults = game.result === null || resultExpanded;

  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [game.notes]);

  function setResult(result: "win" | "loss" | "tie") {
    onUpdate((g) => ({ ...g, result: g.result === result ? null : result }));
    setResultExpanded(false);
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

  /** Marks `slot` as Mega'd (or not) for `side`, clearing any other slot on the same side that's currently Mega'd — VGC only allows one Mega Evolution per side per game, so turning one on always turns the previous one off. */
  function setMegaForSlot(side: "opponentPicks" | "myPicks", slot: number, enabled: boolean) {
    setMegaState((prev) => {
      const next = { ...prev };
      if (enabled) {
        for (let other = 0; other < 4; other++) {
          if (other !== slot) next[`${game.id}-${side}-${other}`] = false;
        }
      }
      next[`${game.id}-${side}-${slot}`] = enabled;
      return next;
    });
  }

  function pickerSlots(
    side: "opponentPicks" | "myPicks",
    roster: ParsedPokemon[],
    picks: TournamentGame["opponentPicks"],
  ) {
    return [0, 1, 2, 3].map((slot) => {
      const key = `${game.id}-${side}-${slot}`;
      const megaEnabled = megaState[key] === true;

      return (
        <PokemonSlotPicker
          key={slot}
          label={`${side === "opponentPicks" ? "Opponent" : "Your"} pick ${slot + 1}`}
          myTeamPokemon={roster}
          value={picks[slot]}
          onChange={(index) => setPick(side, slot as 0 | 1 | 2 | 3, index)}
          megaEnabled={megaEnabled}
          onMegaToggle={() => setMegaForSlot(side, slot, !megaEnabled)}
        />
      );
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      <div className="flex items-center justify-between gap-3 bg-zinc-800 px-4 py-3 dark:bg-zinc-200">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{label}</h3>
        <div className="flex gap-1">
          {showAllResults ? (
            <>
              <button
                type="button"
                onClick={() => setResult("win")}
                aria-pressed={game.result === "win"}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  game.result === "win"
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-zinc-500 text-zinc-300 dark:text-zinc-700 hover:bg-white/10"
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
                    : "border-zinc-500 text-zinc-300 dark:text-zinc-700 hover:bg-white/10"
                }`}
              >
                Loss
              </button>
              <button
                type="button"
                onClick={() => setResult("tie")}
                aria-pressed={game.result === "tie"}
                title="Double knockout — both sides' last Pokémon fainted the same turn"
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  game.result === "tie"
                    ? "border-zinc-600 bg-zinc-600 dark:border-zinc-400 dark:bg-zinc-400 text-white"
                    : "border-zinc-500 text-zinc-300 dark:text-zinc-700 hover:bg-white/10"
                }`}
              >
                Tie
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setResultExpanded(true)}
              title="Click to change the result"
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                game.result === "win"
                  ? "border-green-600 bg-green-600 text-white"
                  : game.result === "loss"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-zinc-600 bg-zinc-600 dark:border-zinc-400 dark:bg-zinc-400 text-white"
              }`}
            >
              {game.result === "win" ? "Win" : game.result === "loss" ? "Loss" : "Tie"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Opponent&apos;s picks
          </span>
          <div className="flex flex-wrap gap-2">
            {pickerSlots("opponentPicks", opponentTeam, game.opponentPicks)}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Your picks
          </span>
          <div className="flex flex-wrap gap-2">
            {pickerSlots("myPicks", myTeam, game.myPicks)}
          </div>
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
          className="min-h-16 max-h-40 w-full resize-none overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-100 p-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </div>
    </div>
  );
}
