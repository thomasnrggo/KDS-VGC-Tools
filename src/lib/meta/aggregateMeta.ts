import type { OfficialEvent } from "./officialTournament";

/** A name and the share (0–1) of a Pokémon's teams that have it. */
export interface Share {
  name: string;
  share: number;
}

export interface MetaSet {
  item?: string;
  ability?: string;
  nature?: string;
  /** Sorted, so the same four moves in another order are the same set. */
  moves: string[];
  share: number;
}

export interface MetaPokemon {
  species: string;
  /** Teams carrying it. */
  teams: number;
  /** Share of all teams. */
  usage: number;
  /** Share of the top teams (the top N placings of each event). */
  topUsage: number;
  /** Rounds won by teams carrying it — byes left out — or null with no rounds played. */
  winRate: number | null;
  /** The rounds the win rate is over, so a small sample reads as one. */
  rounds: number;
  items: Share[];
  abilities: Share[];
  natures: Share[];
  moves: Share[];
  sets: MetaSet[];
  /** The Pokémon most often on the same team. */
  teammates: Share[];
}

export interface MetaSummary {
  events: number;
  teams: number;
  topTeams: number;
  /** Most-used first. */
  pokemon: MetaPokemon[];
}

export interface AggregateOptions {
  /** Placings that count as "top" in each event. */
  top?: number;
  /** How many Pokémon to keep, most-used first. */
  limit?: number;
  /** How many items, moves, sets, … to keep per Pokémon. */
  listLength?: number;
}

function tally(counts: Map<string, number>, key: string | undefined) {
  if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
}

function topShares(counts: Map<string, number>, total: number, length: number): Share[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, length)
    .map(([name, count]) => ({ name, share: count / total }));
}

interface Accumulator {
  teams: number;
  topTeams: number;
  won: number;
  played: number;
  items: Map<string, number>;
  abilities: Map<string, number>;
  natures: Map<string, number>;
  moves: Map<string, number>;
  sets: Map<string, number>;
  teammates: Map<string, number>;
}

/**
 * What's used and what wins across official events — see PLANNING.md's
 * "Metagame data". A Pokémon counts once per team (two of the same species
 * can't be on a sheet anyway). Win rates come from the round results, not the
 * W-L record, which counts byes as wins.
 */
export function aggregateOfficialMeta(
  events: OfficialEvent[],
  { top = 32, limit = 60, listLength = 8 }: AggregateOptions = {},
): MetaSummary {
  const bySpecies = new Map<string, Accumulator>();
  let teams = 0;
  let topTeams = 0;

  for (const event of events) {
    for (const player of event.players) {
      const isTop = player.placing <= top;
      teams += 1;
      if (isTop) topTeams += 1;
      const played = player.rounds.filter((round) => round.result !== "bye");
      const won = played.filter((round) => round.result === "win").length;
      const species = [...new Set(player.team.map((mon) => mon.species))];

      for (const mon of player.team) {
        let entry = bySpecies.get(mon.species);
        if (!entry) {
          entry = {
            teams: 0,
            topTeams: 0,
            won: 0,
            played: 0,
            items: new Map(),
            abilities: new Map(),
            natures: new Map(),
            moves: new Map(),
            sets: new Map(),
            teammates: new Map(),
          };
          bySpecies.set(mon.species, entry);
        }
        entry.teams += 1;
        if (isTop) entry.topTeams += 1;
        entry.won += won;
        entry.played += played.length;
        tally(entry.items, mon.item);
        tally(entry.abilities, mon.ability);
        tally(entry.natures, mon.nature);
        const moves = [...new Set(mon.moves ?? [])].sort();
        for (const move of moves) tally(entry.moves, move);
        tally(
          entry.sets,
          JSON.stringify({ item: mon.item, ability: mon.ability, nature: mon.nature, moves }),
        );
        for (const other of species) if (other !== mon.species) tally(entry.teammates, other);
      }
    }
  }

  const pokemon = [...bySpecies.entries()]
    .sort((a, b) => b[1].teams - a[1].teams || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([species, entry]): MetaPokemon => ({
      species,
      teams: entry.teams,
      usage: entry.teams / teams,
      topUsage: topTeams ? entry.topTeams / topTeams : 0,
      winRate: entry.played ? entry.won / entry.played : null,
      rounds: entry.played,
      items: topShares(entry.items, entry.teams, listLength),
      abilities: topShares(entry.abilities, entry.teams, listLength),
      natures: topShares(entry.natures, entry.teams, listLength),
      moves: topShares(entry.moves, entry.teams, listLength),
      sets: topShares(entry.sets, entry.teams, Math.min(listLength, 5)).map(({ name, share }) => ({
        ...(JSON.parse(name) as Omit<MetaSet, "share">),
        share,
      })),
      teammates: topShares(entry.teammates, entry.teams, listLength),
    }));

  return { events: events.length, teams, topTeams, pokemon };
}
