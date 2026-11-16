import type { OfficialPlayer } from "@/lib/meta/officialTournament";
import { classificationKey, classifyTeam } from "./classify";
import type { ArchetypeSet } from "./types";

/**
 * Archetypes across a regulation's official events, for the public metagame
 * summary (scripts/update-meta.mjs → meta/{regulationId}). Every team is
 * classified (classifyTeam) only to be counted: what's published is totals
 * per label (classificationKey — "balance-setup+tailwind") and label vs label
 * results from the round records. Never a team, never a player.
 */

export interface ArchetypeLabelStat {
  /** classificationKey: archetype ids joined by "+", or "balance". */
  key: string;
  teams: number;
  /** Teams that made the top cut. */
  topCut: number;
  /** Its games (byes left out), from its teams' side. */
  wins: number;
  losses: number;
  ties: number;
  /** Teams per event, in the summary's event order — the trend. */
  byEvent: number[];
}

/**
 * Games between two labels, from `a`'s side; `a` ≤ `b` (string order), so
 * each pairing is stored once — read it the other way round by swapping
 * wins and losses. A mirror (a = b) counts each game from both sides.
 */
export interface ArchetypeMatchup {
  a: string;
  b: string;
  wins: number;
  losses: number;
  ties: number;
}

export interface MetaArchetypes {
  /** The archetype set's version these were classified with (ArchetypeSet.version). */
  version: number;
  teams: number;
  /** Teams per event, in event order — the denominators for `byEvent`. */
  eventTeams: number[];
  /** Most teams first. */
  labels: ArchetypeLabelStat[];
  matchups: ArchetypeMatchup[];
}

interface ArchetypeEvent {
  players: OfficialPlayer[];
}

export function aggregateArchetypes(
  events: ArchetypeEvent[],
  set: ArchetypeSet,
  regulationId?: string,
): MetaArchetypes {
  const labels = new Map<string, ArchetypeLabelStat>();
  const matchups = new Map<string, ArchetypeMatchup>();
  const stat = (key: string) => {
    let entry = labels.get(key);
    if (!entry) {
      entry = {
        key,
        teams: 0,
        topCut: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        byEvent: events.map(() => 0),
      };
      labels.set(key, entry);
    }
    return entry;
  };

  events.forEach((event, eventIndex) => {
    const keyByPlacing = new Map<number, string>();
    for (const player of event.players) {
      const key = classificationKey(classifyTeam(player.team, set, regulationId));
      keyByPlacing.set(player.placing, key);
      const entry = stat(key);
      entry.teams += 1;
      entry.byEvent[eventIndex] += 1;
      if (player.madeTopCut) entry.topCut += 1;
    }
    for (const player of event.players) {
      const mine = keyByPlacing.get(player.placing)!;
      const entry = stat(mine);
      for (const round of player.rounds) {
        if (round.result === "bye" || round.opponentPlacing == null) continue;
        const theirs = keyByPlacing.get(round.opponentPlacing);
        if (!theirs) continue;
        const result = round.result;
        if (result === "win") entry.wins += 1;
        else if (result === "loss") entry.losses += 1;
        else entry.ties += 1;
        // Each game is seen from both players; keep only `a`'s view (both views for a mirror).
        if (mine > theirs) continue;
        const id = `${mine}|${theirs}`;
        let pair = matchups.get(id);
        if (!pair) {
          pair = { a: mine, b: theirs, wins: 0, losses: 0, ties: 0 };
          matchups.set(id, pair);
        }
        if (result === "win") pair.wins += 1;
        else if (result === "loss") pair.losses += 1;
        else pair.ties += 1;
      }
    }
  });

  const total = [...labels.values()].reduce((sum, entry) => sum + entry.teams, 0);
  return {
    version: set.version,
    teams: total,
    eventTeams: events.map((event) => event.players.length),
    labels: [...labels.values()].sort((x, y) => y.teams - x.teams || x.key.localeCompare(y.key)),
    matchups: [...matchups.values()].sort(
      (x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b),
    ),
  };
}
