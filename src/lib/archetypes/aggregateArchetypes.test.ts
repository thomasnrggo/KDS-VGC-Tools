import { describe, expect, it } from "vitest";
import type { OfficialPlayer } from "@/lib/meta/officialTournament";
import type { ParsedPokemon } from "@/types";
import { DEFAULT_ARCHETYPE_SET, aggregateArchetypes } from ".";

const sun: ParsedPokemon[] = [
  { species: "Torkoal", ability: "Drought", moves: ["Eruption", "Heat Wave", "Protect"] },
  { species: "Garchomp", moves: ["Earthquake", "Rock Slide", "Protect"] },
];
const tailwind: ParsedPokemon[] = [
  { species: "Tornadus", moves: ["Tailwind", "Bleakwind Storm", "Protect"] },
  { species: "Garchomp", moves: ["Earthquake", "Rock Slide", "Protect"] },
];

const player = (
  placing: number,
  team: ParsedPokemon[],
  rounds: OfficialPlayer["rounds"],
  madeTopCut = false,
): OfficialPlayer => ({
  placing,
  record: { wins: 0, losses: 0, ties: 0 },
  madeTopCut,
  dropped: false,
  team,
  rounds,
});

describe("aggregateArchetypes", () => {
  const summary = aggregateArchetypes(
    [
      {
        players: [
          player(
            1,
            sun,
            [
              { opponentPlacing: 2, result: "win" },
              { opponentPlacing: null, result: "bye" },
            ],
            true,
          ),
          player(2, tailwind, [{ opponentPlacing: 1, result: "loss" }]),
        ],
      },
      {
        players: [
          player(1, tailwind, [{ opponentPlacing: 2, result: "win" }]),
          player(2, sun, [
            { opponentPlacing: 1, result: "loss" },
            { opponentPlacing: 3, result: "tie" },
          ]),
          player(3, sun, [{ opponentPlacing: 2, result: "tie" }]),
        ],
      },
    ],
    DEFAULT_ARCHETYPE_SET,
  );

  it("counts teams, top cuts, games and the per-event trend per label", () => {
    expect(summary.teams).toBe(5);
    expect(summary.eventTeams).toEqual([2, 3]);
    expect(summary.labels[0]).toEqual({
      key: "sun",
      teams: 3,
      topCut: 1,
      wins: 1,
      losses: 1,
      ties: 2,
      byEvent: [1, 2],
    });
    expect(summary.labels[1]).toMatchObject({ key: "tailwind", teams: 2, wins: 1, losses: 1 });
  });

  it("stores each pairing once, from the first label's side, byes left out", () => {
    expect(summary.matchups).toEqual([
      // A mirror counts the game from both sides.
      { a: "sun", b: "sun", wins: 0, losses: 0, ties: 2 },
      // sun < tailwind: sun won one and lost one against Tailwind.
      { a: "sun", b: "tailwind", wins: 1, losses: 1, ties: 0 },
    ]);
  });
});
