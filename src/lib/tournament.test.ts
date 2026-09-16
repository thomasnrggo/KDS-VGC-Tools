import { describe, expect, it } from "vitest";
import {
  completeTournament,
  computeTeamUsageStats,
  createRound,
  createTournament,
  getRoundResult,
  getTournamentRecord,
  isTournamentCompleted,
  parseRoundOpponentTeam,
  reopenTournament,
} from "./tournament";
import { REGULATIONS } from "@/data/regulations";
import type { Team, Tournament, TournamentRound } from "@/types";

const REG_ID = REGULATIONS[0].id;

function teamWith(pokemon: string[]): Team {
  return {
    id: "team-1",
    name: "Test Team",
    rawPaste: "",
    pokemon: pokemon.map((species) => ({ species })),
    regulationIds: [REG_ID],
    sortOrder: 0,
    updatedAt: new Date().toISOString(),
  };
}

/** A round with the given per-game results (in order), rest left unplayed. */
function roundWithGameResults(
  results: ("win" | "loss" | "tie")[],
  myPicksPerGame: number[][] = [],
): TournamentRound {
  const round = createRound("Round 1");
  round.games = round.games.map((game, i) => {
    if (i >= results.length) return game;
    const picks = myPicksPerGame[i] ?? [];
    return {
      ...game,
      result: results[i],
      myPicks: [picks[0] ?? null, picks[1] ?? null, picks[2] ?? null, picks[3] ?? null],
    };
  }) as TournamentRound["games"];
  return round;
}

/** A round with `wins` game wins and `losses` game losses set, rest left unplayed. */
function roundWithResults(wins: number, losses: number, myPicksPerGame: number[][] = []): TournamentRound {
  return roundWithGameResults(
    [...Array(wins).fill("win" as const), ...Array(losses).fill("loss" as const)],
    myPicksPerGame,
  );
}

describe("createTournament", () => {
  it("wires up name/teamId/regulationId with an empty rounds list", () => {
    const tournament = createTournament("Regionals", "team-1", REG_ID);
    expect(tournament.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(tournament.name).toBe("Regionals");
    expect(tournament.teamId).toBe("team-1");
    expect(tournament.regulationId).toBe(REG_ID);
    expect(tournament.rounds).toEqual([]);
  });
});

describe("createRound", () => {
  it("starts with an empty opponent roster and exactly 3 unplayed games", () => {
    const round = createRound("Round 1");
    expect(round.label).toBe("Round 1");
    expect(round.opponentTeam).toEqual([]);
    expect(round.games).toHaveLength(3);
    for (const game of round.games) {
      expect(game.result).toBeNull();
      expect(game.opponentPicks).toEqual([null, null, null, null]);
      expect(game.myPicks).toEqual([null, null, null, null]);
    }
  });
});

describe("parseRoundOpponentTeam", () => {
  it("tolerates a block with no EVs line, same as any other pasted team", () => {
    const parsed = parseRoundOpponentTeam("Ditto @ Choice Scarf\nAbility: Imposter\nHardy Nature");
    expect(parsed).toEqual([
      { species: "Ditto", item: "Choice Scarf", ability: "Imposter", nature: "Hardy" },
    ]);
  });
});

describe("getRoundResult", () => {
  it("is in-progress with no games played", () => {
    expect(getRoundResult(createRound("Round 1"))).toBe("in-progress");
  });

  it("is in-progress after only 1 win", () => {
    expect(getRoundResult(roundWithResults(1, 0))).toBe("in-progress");
  });

  it("is win after 2 game wins (best of 3)", () => {
    expect(getRoundResult(roundWithResults(2, 0))).toBe("win");
  });

  it("is loss after 2 game losses", () => {
    expect(getRoundResult(roundWithResults(0, 2))).toBe("loss");
  });

  it("is win after a 2-1 game 3", () => {
    expect(getRoundResult(roundWithResults(2, 1))).toBe("win");
  });

  it("is tie once all 3 games are played without either side reaching 2 (a double-knockout game)", () => {
    expect(getRoundResult(roundWithGameResults(["win", "loss", "tie"]))).toBe("tie");
  });

  it("is still in-progress with only 2 games played and no 2-0/2-1 decision yet", () => {
    expect(getRoundResult(roundWithGameResults(["win", "tie"]))).toBe("in-progress");
  });

  it("is win when roundOutcome is 'walkover', even with no games played", () => {
    const round = { ...createRound("Round 1"), roundOutcome: "walkover" as const };
    expect(getRoundResult(round)).toBe("win");
  });

  it("is win when roundOutcome is 'bye', even with no games played", () => {
    const round = { ...createRound("Round 1"), roundOutcome: "bye" as const };
    expect(getRoundResult(round)).toBe("win");
  });

  it("roundOutcome overrides an already-decided game count", () => {
    const round = { ...roundWithResults(0, 2), roundOutcome: "walkover" as const };
    expect(getRoundResult(round)).toBe("win");
  });
});

describe("getTournamentRecord", () => {
  it("only counts decided rounds, and separates ties from losses", () => {
    const tournament: Tournament = {
      ...createTournament("Regionals", "team-1", REG_ID),
      rounds: [
        roundWithResults(2, 0),
        roundWithResults(0, 2),
        roundWithResults(1, 0),
        roundWithGameResults(["win", "loss", "tie"]),
      ],
    };
    expect(getTournamentRecord(tournament)).toEqual({ wins: 1, losses: 1, ties: 1 });
  });
});

describe("completeTournament / reopenTournament / isTournamentCompleted", () => {
  it("sets and clears completedAt reversibly", () => {
    const tournament = createTournament("Regionals", "team-1", REG_ID);
    expect(isTournamentCompleted(tournament)).toBe(false);

    const completed = completeTournament(tournament);
    expect(isTournamentCompleted(completed)).toBe(true);
    expect(() => new Date(completed.completedAt!).toISOString()).not.toThrow();

    const reopened = reopenTournament(completed);
    expect(isTournamentCompleted(reopened)).toBe(false);
    expect(reopened).not.toHaveProperty("completedAt");
  });
});

describe("computeTeamUsageStats", () => {
  it("tallies times picked and win/loss split per roster slot, ignoring other teams' tournaments", () => {
    const team = teamWith(["Incineroar", "Rillaboom", "Grimmsnarl"]);
    const tournament: Tournament = {
      ...createTournament("Regionals", team.id, REG_ID),
      rounds: [
        roundWithResults(2, 0, [[0, 1], [0, 2]]),
        roundWithResults(0, 2, [[0, 1], [1]]),
      ],
    };
    const otherTeamTournament: Tournament = {
      ...createTournament("Locals", "other-team", REG_ID),
      rounds: [roundWithResults(2, 0, [[0]])],
    };

    const stats = computeTeamUsageStats([tournament, otherTeamTournament], team);

    // Incineroar (index 0): round 1 games 1+2 (both wins), round 2 game 1 only (a loss).
    expect(stats[0]).toMatchObject({ timesPicked: 3, wins: 2, losses: 1 });
    // Rillaboom (index 1): round 1 game 1 (a win), round 2 games 1+2 (both losses).
    expect(stats[1]).toMatchObject({ timesPicked: 3, wins: 1, losses: 2 });
    // Grimmsnarl (index 2): round 1 game 2 only, a win.
    expect(stats[2]).toMatchObject({ timesPicked: 1, wins: 1, losses: 0 });
  });

  it("returns a zeroed entry for every roster Pokémon when nothing's been logged", () => {
    const team = teamWith(["Ditto"]);
    expect(computeTeamUsageStats([], team)).toEqual([
      { index: 0, pokemon: { species: "Ditto" }, timesPicked: 0, wins: 0, losses: 0 },
    ]);
  });

  it("counts a tied game's picks toward timesPicked but not wins or losses", () => {
    const team = teamWith(["Ditto"]);
    const tournament: Tournament = {
      ...createTournament("Regionals", team.id, REG_ID),
      rounds: [roundWithGameResults(["win", "loss", "tie"], [[0], [0], [0]])],
    };
    const stats = computeTeamUsageStats([tournament], team);
    expect(stats[0]).toMatchObject({ timesPicked: 3, wins: 1, losses: 1 });
  });
});
