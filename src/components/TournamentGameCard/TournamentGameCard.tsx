"use client";

import { useEffect, useRef, useState } from "react";
import { PokemonSlotPicker } from "../PokemonSlotPicker";
import type { ParsedPokemon, TeamPokemonSlot, TournamentGame } from "@/types";
import { useMessages } from "@/hooks/useLanguage";
import {
  duplicateSlots,
  pickIntoSlot,
  toggleSlotMega,
  usedInOtherSlots,
  type SlotTag,
} from "@/lib/slotPicks";
import { cn } from "@/lib/utils";

type Side = "opponentPicks" | "myPicks";

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
 * Evolve in a real game, toggleSlotMega enforces that exclusivity —
 * turning one slot's Mega on always turns off whichever other slot on that
 * same side was on. Each side's 4 picks are different Pokémon: picking one
 * that's already in another slot swaps the two (pickIntoSlot).
 */
export function TournamentGameCard({
  label,
  game,
  opponentTeam,
  myTeam,
  onUpdate,
}: TournamentGameCardProps) {
  const t = useMessages();
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [megas, setMegas] = useState<Record<Side, boolean[]>>({
    opponentPicks: [false, false, false, false],
    myPicks: [false, false, false, false],
  });
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

  /** Puts `index` into `slot` on `side` — the 4 picks hold different Pokémon, so one already picked swaps places (see pickIntoSlot). */
  function setPick(side: Side, roster: ParsedPokemon[], slot: number, index: TeamPokemonSlot) {
    const next = pickIntoSlot(
      { picks: game[side], megas: megas[side] },
      slot,
      index,
      roster,
      false,
    );
    onUpdate((g) => ({ ...g, [side]: next.picks as TournamentGame[Side] }));
    setMegas((prev) => ({ ...prev, [side]: next.megas }));
  }

  /** Only one Pokémon per side can Mega Evolve in a game — turning one on turns the others off. */
  function toggleMega(side: Side, slot: number) {
    setMegas((prev) => ({
      ...prev,
      [side]: toggleSlotMega({ picks: game[side], megas: prev[side] }, slot).megas,
    }));
  }

  function pickerSlots(side: Side, roster: ParsedPokemon[], picks: TournamentGame[Side]) {
    const label = side === "opponentPicks" ? t.game.opponentPick : t.game.yourPick;
    const tags: SlotTag[] = [1, 2, 3, 4].map((n) => ({ label: label(n), tag: t.game.pickTag(n) }));
    const duplicates = duplicateSlots(picks);
    return [0, 1, 2, 3].map((slot) => {
      return (
        <PokemonSlotPicker
          key={slot}
          label={tags[slot].label}
          myTeamPokemon={roster}
          value={picks[slot]}
          onChange={(index) => setPick(side, roster, slot, index)}
          megaEnabled={megas[side][slot]}
          onMegaToggle={() => toggleMega(side, slot)}
          usedIn={usedInOtherSlots(picks, slot, tags)}
          isDuplicate={duplicates.has(slot)}
          speedMode={side === "opponentPicks" ? "range" : "exact"}
        />
      );
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      <div className="flex items-center justify-between gap-3 bg-chrome-800 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-wide text-white uppercase">{label}</h3>
        <div className="flex gap-1">
          {showAllResults ? (
            <>
              <button
                type="button"
                onClick={() => setResult("win")}
                aria-pressed={game.result === "win"}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  game.result === "win"
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-zinc-500 text-chrome-300 hover:bg-white/10",
                )}
              >
                {t.game.win}
              </button>
              <button
                type="button"
                onClick={() => setResult("loss")}
                aria-pressed={game.result === "loss"}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  game.result === "loss"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-zinc-500 text-chrome-300 hover:bg-white/10",
                )}
              >
                {t.game.loss}
              </button>
              <button
                type="button"
                onClick={() => setResult("tie")}
                aria-pressed={game.result === "tie"}
                title={t.game.tieHint}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  game.result === "tie"
                    ? "border-chrome-600 bg-chrome-600 text-white"
                    : "border-zinc-500 text-chrome-300 hover:bg-white/10",
                )}
              >
                {t.game.tie}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setResultExpanded(true)}
              title={t.game.changeResult}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                game.result === "win"
                  ? "border-green-600 bg-green-600 text-white"
                  : game.result === "loss"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-chrome-600 bg-chrome-600 text-white",
              )}
            >
              {game.result === "win"
                ? t.game.win
                : game.result === "loss"
                  ? t.game.loss
                  : t.game.tie}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {t.game.opponentPicks}
          </span>
          <div className="flex flex-wrap gap-2">
            {pickerSlots("opponentPicks", opponentTeam, game.opponentPicks)}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {t.game.yourPicks}
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
          placeholder={t.game.notesPlaceholder}
          aria-label={t.game.notesLabel(label)}
          className="max-h-40 min-h-16 w-full resize-none overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-100 p-2 text-sm text-zinc-800 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
        />
      </div>
    </div>
  );
}
