import { BALANCE_KEY } from "./classify";
import type { MetaArchetypes } from "./aggregateArchetypes";

/**
 * How teams like yours did in the regulation's official events, and against
 * which archetypes (docs/archetypes.md — "On the team page"), from the
 * metagame job's archetype summary.
 *
 * - Your side: your exact label ("balance-setup+tailwind") when enough teams
 *   share it, else every team with your primary archetype ("balance-setup").
 * - Their side: grouped by primary archetype, so each matchup has games.
 */

/** Fewer teams on your exact label than this, and your primary archetype's teams stand in. */
export const MIN_LABEL_TEAMS = 20;
/** A matchup needs this many games to be listed as hard or good. */
export const MIN_MATCHUP_GAMES = 15;
const HARD_BELOW = 0.48;
const GOOD_ABOVE = 0.52;
const LISTED = 3;

export interface Record3 {
  wins: number;
  losses: number;
  ties: number;
}

export interface VersusArchetype extends Record3 {
  /** The opponents' primary archetype id, or "balance". */
  opponent: string;
  games: number;
  winRate: number;
}

export interface ArchetypeMatchupReport extends Record3 {
  /** "label": your exact label; "primary": everything with your primary archetype. */
  scope: "label" | "primary";
  /** The label key, or the primary archetype id (scope "primary"). */
  key: string;
  teams: number;
  topCut: number;
  games: number;
  winRate: number | null;
  /** Every opponent archetype with games, most games first. */
  versus: VersusArchetype[];
  /** The worst matchups (enough games, under 48%), worst first. */
  hard: VersusArchetype[];
  /** The best (enough games, over 52%), best first. */
  good: VersusArchetype[];
}

export const primaryOfKey = (key: string) => key.split("+")[0];

const winRate = ({ wins, losses, ties }: Record3) => {
  const games = wins + losses + ties;
  return games ? (wins + ties / 2) / games : null;
};

/** `labelKey` is the team's classificationKey; null when there's no data for it at all. */
export function archetypeMatchups(
  meta: MetaArchetypes,
  labelKey: string,
): ArchetypeMatchupReport | null {
  const exact = meta.labels.find((label) => label.key === labelKey);
  const primary = primaryOfKey(labelKey);
  const useLabel = !!exact && exact.teams >= MIN_LABEL_TEAMS;
  const mine = new Set(
    useLabel
      ? [labelKey]
      : meta.labels.filter((label) => primaryOfKey(label.key) === primary).map((l) => l.key),
  );
  const own = meta.labels.filter((label) => mine.has(label.key));
  if (own.length === 0) return null;

  const total = own.reduce(
    (sum, label) => ({
      teams: sum.teams + label.teams,
      topCut: sum.topCut + label.topCut,
      wins: sum.wins + label.wins,
      losses: sum.losses + label.losses,
      ties: sum.ties + label.ties,
    }),
    { teams: 0, topCut: 0, wins: 0, losses: 0, ties: 0 },
  );

  const byOpponent = new Map<string, Record3>();
  const add = (opponentKey: string, wins: number, losses: number, ties: number) => {
    const opponent = primaryOfKey(opponentKey);
    const entry = byOpponent.get(opponent) ?? { wins: 0, losses: 0, ties: 0 };
    entry.wins += wins;
    entry.losses += losses;
    entry.ties += ties;
    byOpponent.set(opponent, entry);
  };
  for (const pair of meta.matchups) {
    // Stored once from `a`'s side (a mirror already holds both sides).
    if (mine.has(pair.a)) add(pair.b, pair.wins, pair.losses, pair.ties);
    if (mine.has(pair.b) && pair.a !== pair.b) add(pair.a, pair.losses, pair.wins, pair.ties);
  }

  const versus: VersusArchetype[] = [...byOpponent].map(([opponent, record]) => ({
    opponent,
    ...record,
    games: record.wins + record.losses + record.ties,
    winRate: winRate(record) ?? 0,
  }));
  versus.sort((x, y) => y.games - x.games || x.opponent.localeCompare(y.opponent));
  const listable = versus.filter(
    (v) => v.games >= MIN_MATCHUP_GAMES && v.opponent !== primary && v.opponent !== BALANCE_KEY,
  );

  return {
    scope: useLabel ? "label" : "primary",
    key: useLabel ? labelKey : primary,
    ...total,
    games: total.wins + total.losses + total.ties,
    winRate: winRate(total),
    versus,
    hard: listable
      .filter((v) => v.winRate < HARD_BELOW)
      .sort((x, y) => x.winRate - y.winRate)
      .slice(0, LISTED),
    good: listable
      .filter((v) => v.winRate > GOOD_ABOVE)
      .sort((x, y) => y.winRate - x.winRate)
      .slice(0, LISTED),
  };
}
