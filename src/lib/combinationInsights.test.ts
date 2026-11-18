import { describe, expect, it } from "vitest";
import { combinationRecord } from "./combinationInsights";
import type { TeamCombination, Tournament } from "@/types";

const combination: TeamCombination = {
  id: "c1",
  leadPair: [0, 4],
  backPair: [2, 3],
  leadMega: [true, true],
  backMega: [true, true],
  backAlt: 5,
  notes: "",
};

const game = (myPicks: (number | null)[], result: "win" | "loss" | "tie" | null) => ({
  result,
  myPicks,
  opponentPicks: [null, null, null, null],
  notes: "",
});

const tournament = (teamId: string, games: ReturnType<typeof game>[]) =>
  ({ id: "t", teamId, rounds: [{ games }] }) as unknown as Tournament;

describe("combinationRecord", () => {
  it("counts the logged games that brought its four, in any order, either Back 2", () => {
    const record = combinationRecord(
      combination,
      [
        tournament("team", [
          game([3, 2, 4, 0], "win"),
          game([0, 4, 2, 5], "loss"),
          game([0, 4, 2, 1], "win"), // a different four
          game([0, 4, 2, 3], null), // not played
          game([0, 4, 2, null], "win"), // not all picks logged
        ]),
        tournament("other team", [game([0, 4, 2, 3], "win")]),
      ],
      "team",
    );
    expect(record).toEqual({ played: 2, wins: 1, losses: 1, ties: 0 });
  });
});
