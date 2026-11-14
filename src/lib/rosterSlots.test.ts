import { describe, expect, it } from "vitest";
import {
  matchupPlanWithoutSlot,
  moveMap,
  teamWithPokemonMoved,
  notesWithoutSlot,
  shiftSlot,
  teamWithoutSlot,
  tournamentWithoutSlot,
} from "./rosterSlots";
import { createTeam } from "./team";
import type { MatchupPlan, Tournament, TournamentGame } from "@/types";

const PASTE = ["Garchomp", "Pelipper", "Raichu", "Sneasler"]
  .map((species) => `${species}\nAbility: Pressure\n- Protect`)
  .join("\n\n");

describe("shiftSlot", () => {
  it("clears the removed slot and shifts later ones down", () => {
    expect(shiftSlot(1, 1)).toBeNull();
    expect(shiftSlot(0, 1)).toBe(0);
    expect(shiftSlot(3, 1)).toBe(2);
    expect(shiftSlot(null, 1)).toBeNull();
  });
});

describe("notesWithoutSlot", () => {
  it("re-keys notes and drops the removed Pokémon's", () => {
    expect(notesWithoutSlot({ 0: "a", 1: "b", 3: "d" }, 1)).toEqual({ 0: "a", 2: "d" });
  });
});

describe("teamWithoutSlot", () => {
  it("removes the Pokémon and keeps combinations pointing at the same ones", () => {
    const team = {
      ...createTeam(PASTE, "Rain", "regulation-m-c"),
      combinations: [
        {
          id: "c1",
          leadPair: [0, 2] as [number, number],
          backPair: [1, 3] as [number, number],
          leadMega: [true, true] as [boolean, boolean],
          backMega: [true, true] as [boolean, boolean],
          notes: "",
        },
      ],
    };
    const next = teamWithoutSlot(team, 1);
    expect(next.pokemon.map((mon) => mon.species)).toEqual(["Garchomp", "Raichu", "Sneasler"]);
    expect(next.rawPaste).toContain("Sneasler");
    expect(next.rawPaste).not.toContain("Pelipper");
    expect(next.combinations?.[0].leadPair).toEqual([0, 1]);
    expect(next.combinations?.[0].backPair).toEqual([null, 2]);
  });
});

describe("matchupPlanWithoutSlot", () => {
  it("shifts your picks in every plan but not theirs", () => {
    const picks = {
      leadPair: [2, 3] as [number, number],
      backPair: [0, 1] as [number, number],
      leadMega: [true, true] as [boolean, boolean],
      backMega: [true, true] as [boolean, boolean],
    };
    const plan: MatchupPlan = {
      ...picks,
      backAlt: 4,
      notes: "",
      theirs: picks,
      morePlans: [{ id: "b", notes: "", ...picks }],
    };
    const next = matchupPlanWithoutSlot(plan, 2);
    expect(next.leadPair).toEqual([null, 2]);
    expect(next.backAlt).toBe(3);
    expect(next.theirs?.leadPair).toEqual([2, 3]);
    expect(next.morePlans?.[0].leadPair).toEqual([null, 2]);
  });
});

describe("tournamentWithoutSlot", () => {
  const game = (myPicks: TournamentGame["myPicks"]): TournamentGame => ({
    id: "g",
    result: null,
    opponentPicks: [0, 1, 2, 3],
    myPicks,
    notes: "",
  });
  const tournament = {
    id: "t",
    teamId: "team",
    rounds: [
      { games: [game([0, 1, 2, 3]), game([4, 5, null, null]), game([null, null, null, null])] },
    ],
  } as unknown as Tournament;

  it("shifts your picks in games played with the team", () => {
    const next = tournamentWithoutSlot(tournament, "team", 1);
    expect(next.rounds[0].games[0].myPicks).toEqual([0, null, 1, 2]);
    expect(next.rounds[0].games[0].opponentPicks).toEqual([0, 1, 2, 3]);
    expect(next.rounds[0].games[1].myPicks).toEqual([3, 4, null, null]);
  });

  it("leaves other teams' tournaments alone", () => {
    expect(tournamentWithoutSlot(tournament, "other", 1)).toBe(tournament);
  });
});

describe("moving a Pokémon", () => {
  it("maps every slot to where its Pokémon ends up", () => {
    // [A, B, C, D]: A to the third place → [B, C, A, D].
    const right = moveMap(0, 2);
    expect([0, 1, 2, 3].map(right)).toEqual([2, 0, 1, 3]);
    // D to the front → [D, A, B, C].
    const left = moveMap(3, 0);
    expect([0, 1, 2, 3].map(left)).toEqual([1, 2, 3, 0]);
  });

  it("reorders the roster, its paste, notes and combinations together", () => {
    const team = {
      ...createTeam(PASTE, "Rain", "regulation-m-c"),
      pokemonNotes: { 0: "chomp", 3: "sneasler" },
      combinations: [
        {
          id: "c1",
          leadPair: [0, 1] as [number, number],
          backPair: [2, 3] as [number, number],
          leadMega: [true, true] as [boolean, boolean],
          backMega: [true, true] as [boolean, boolean],
          notes: "",
        },
      ],
    };
    const next = teamWithPokemonMoved(team, 0, 2);
    expect(next.pokemon.map((mon) => mon.species)).toEqual([
      "Pelipper",
      "Raichu",
      "Garchomp",
      "Sneasler",
    ]);
    expect(next.rawPaste.indexOf("Raichu")).toBeLessThan(next.rawPaste.indexOf("Garchomp"));
    expect(next.pokemonNotes).toEqual({ 2: "chomp", 3: "sneasler" });
    // Still Garchomp + Pelipper in front, Raichu + Sneasler behind.
    expect(next.combinations?.[0].leadPair).toEqual([2, 0]);
    expect(next.combinations?.[0].backPair).toEqual([1, 3]);
    expect(teamWithPokemonMoved(team, 1, 1)).toBe(team);
  });
});
