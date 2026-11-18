import type { TeamCombination, Tournament } from "@/types";

/**
 * What a team's "common combination" (Strategy tab) is about, from what the
 * app already knows: how it did in the games you logged.
 */

/** The four Pokémon a combination brings — two sets when Back 2 is "A or B". Null slots left out. */
export function combinationFours(combination: TeamCombination): number[][] {
  const [lead1, lead2] = combination.leadPair;
  const [back1, back2] = combination.backPair;
  const fours = [[lead1, lead2, back1, back2]];
  if (combination.backAlt !== undefined && combination.backAlt !== null) {
    fours.push([lead1, lead2, back1, combination.backAlt]);
  }
  return fours.map((four) => four.filter((slot): slot is number => slot !== null));
}

export interface CombinationRecord {
  played: number;
  wins: number;
  losses: number;
  ties: number;
}

/**
 * How the combination did in logged tournament games with this team: the
 * games where the four you brought are its four (logged picks aren't
 * lead/back-ordered — any order counts; with "A or B", either).
 */
export function combinationRecord(
  combination: TeamCombination,
  tournaments: Tournament[],
  teamId: string,
): CombinationRecord {
  const keys = combinationFours(combination)
    .filter((four) => four.length === 4)
    .map((four) => [...four].sort().join(","));
  const record: CombinationRecord = { played: 0, wins: 0, losses: 0, ties: 0 };
  if (keys.length === 0) return record;
  for (const tournament of tournaments) {
    if (tournament.teamId !== teamId) continue;
    for (const round of tournament.rounds) {
      for (const game of round.games) {
        if (game.result === null || game.myPicks.some((pick) => pick === null)) continue;
        const key = [...(game.myPicks as number[])].sort().join(",");
        if (!keys.includes(key)) continue;
        record.played += 1;
        if (game.result === "win") record.wins += 1;
        else if (game.result === "loss") record.losses += 1;
        else record.ties += 1;
      }
    }
  }
  return record;
}
