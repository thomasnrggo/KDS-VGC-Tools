import { parseTeam } from "./parseTeam";
import { generateId } from "./id";
import type { ParsedPokemon, Team, Tournament, TournamentGame, TournamentRound } from "@/types";

function createEmptyGame(): TournamentGame {
  return {
    id: generateId(),
    result: null,
    opponentPicks: [null, null, null, null],
    myPicks: [null, null, null, null],
    notes: "",
  };
}

/** A fresh round — always exactly 3 (empty, unplayed) games; the opponent roster starts empty until pasted. */
export function createRound(label: string): TournamentRound {
  return {
    id: generateId(),
    label,
    opponentRawPaste: "",
    opponentTeam: [],
    games: [createEmptyGame(), createEmptyGame(), createEmptyGame()],
  };
}

/** Re-parses a round's opponent roster from a raw paste — same parseTeam path every other pasted team uses, which already tolerates a block with no EVs line (a real tournament team sheet rarely reveals Stat Points). */
export function parseRoundOpponentTeam(rawPaste: string): ParsedPokemon[] {
  return parseTeam(rawPaste);
}

export function createTournament(name: string, teamId: string, regulationId: string): Tournament {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name,
    teamId,
    regulationId,
    rounds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** First to 2 game wins decides a Bo3 round; "in-progress" until then (including a round with no games played yet). */
export function getRoundResult(round: TournamentRound): "win" | "loss" | "in-progress" {
  const wins = round.games.filter((g) => g.result === "win").length;
  const losses = round.games.filter((g) => g.result === "loss").length;
  if (wins >= 2) return "win";
  if (losses >= 2) return "loss";
  return "in-progress";
}

/** Overall round record across a tournament, e.g. "3-1" — only counts decided rounds. */
export function getTournamentRecord(tournament: Tournament): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  for (const round of tournament.rounds) {
    const result = getRoundResult(round);
    if (result === "win") wins++;
    else if (result === "loss") losses++;
  }
  return { wins, losses };
}

export interface PokemonUsageStat {
  index: number;
  pokemon: ParsedPokemon;
  timesPicked: number;
  wins: number;
  losses: number;
}

/**
 * Rolls up every game, across every round of every given tournament, into a
 * per-roster-slot usage count — how often each of this team's own Pokémon
 * was brought to a game, and the win/loss split of those games specifically
 * (not the team's overall record — a Pokémon sat out of a game doesn't
 * count toward or against it). `tournaments` should already be filtered to
 * ones using this team; a Pokémon's index is stable across a team's
 * lifetime (edits keep the roster order), same assumption Combinations and
 * MatchupPlan's leadPair/backPair already make.
 */
export function computeTeamUsageStats(tournaments: Tournament[], team: Team): PokemonUsageStat[] {
  const stats = team.pokemon.map(
    (pokemon, index): PokemonUsageStat => ({
      index,
      pokemon,
      timesPicked: 0,
      wins: 0,
      losses: 0,
    }),
  );

  for (const tournament of tournaments) {
    if (tournament.teamId !== team.id) continue;
    for (const round of tournament.rounds) {
      for (const game of round.games) {
        if (game.result !== "win" && game.result !== "loss") continue;
        for (const pick of game.myPicks) {
          if (pick === null || !stats[pick]) continue;
          stats[pick].timesPicked++;
          if (game.result === "win") stats[pick].wins++;
          else stats[pick].losses++;
        }
      }
    }
  }

  return stats;
}
