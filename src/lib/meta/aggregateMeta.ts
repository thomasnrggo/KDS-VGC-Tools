import { megaFormSpecies, stripMegaSuffix } from "@/lib/species/megaForm";
import type { OfficialEvent, OfficialPlayer } from "./officialTournament";

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
  /** Its usage and top usage at each event, in the order the events were given. */
  history: { usage: number; topUsage: number }[];
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
  /** Teams and top teams carrying it at each event. */
  perEvent: { teams: number; topTeams: number }[];
}

/**
 * What's used and what wins across official events — see PLANNING.md's
 * "Metagame data". A Pokémon counts once per team (two of the same species
 * can't be on a sheet anyway), and a Mega — the species holding its own
 * stone — is its own entry ("Garchomp-Mega-Z" apart from "Garchomp"). Win rates come from the round results, not the
 * W-L record, which counts byes as wins.
 */
export function aggregateOfficialMeta(
  events: OfficialEvent[],
  { top = 32, limit = 80, listLength = 8 }: AggregateOptions = {},
): MetaSummary {
  const bySpecies = new Map<string, Accumulator>();
  let teams = 0;
  let topTeams = 0;

  const eventTeams = events.map(() => 0);
  const eventTopTeams = events.map(() => 0);

  events.forEach((event, eventIndex) => {
    for (const player of event.players) {
      const isTop = player.placing <= top;
      teams += 1;
      eventTeams[eventIndex] += 1;
      if (isTop) {
        topTeams += 1;
        eventTopTeams[eventIndex] += 1;
      }
      const played = player.rounds.filter((round) => round.result !== "bye");
      const won = played.filter((round) => round.result === "win").length;
      // Teammates are counted by species: Mega or not, it's the same partner.
      const species = baseSpeciesOf(player);

      for (const mon of player.team) {
        // A Mega is its own entry: Mega Garchomp Z isn't Garchomp.
        const form = megaFormSpecies(mon.species, mon.item) ?? mon.species;
        const base = stripMegaSuffix(mon.species);
        let entry = bySpecies.get(form);
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
            perEvent: events.map(() => ({ teams: 0, topTeams: 0 })),
          };
          bySpecies.set(form, entry);
        }
        entry.teams += 1;
        entry.perEvent[eventIndex].teams += 1;
        if (isTop) {
          entry.topTeams += 1;
          entry.perEvent[eventIndex].topTeams += 1;
        }
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
        for (const other of species) if (other !== base) tally(entry.teammates, other);
      }
    }
  });

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
      history: entry.perEvent.map((counts, index) => ({
        usage: eventTeams[index] ? counts.teams / eventTeams[index] : 0,
        topUsage: eventTopTeams[index] ? counts.topTeams / eventTopTeams[index] : 0,
      })),
    }));

  return { events: events.length, teams, topTeams, pokemon };
}

/** A team's species, sorted, Mega or not — what cores and full teams are made of. */
function baseSpeciesOf(player: OfficialPlayer): string[] {
  return [...new Set(player.team.map((mon) => stripMegaSuffix(mon.species)))].sort();
}

function* combinations(items: string[], size: number, start = 0): Generator<string[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let index = start; index <= items.length - size; index += 1) {
    for (const rest of combinations(items, size - 1, index + 1)) yield [items[index], ...rest];
  }
}

/** A group of Pokémon on the same team — a pair, trio, quad or a full team. */
export interface MetaCombo {
  /** Sorted. */
  species: string[];
  teams: number;
  usage: number;
  topUsage: number;
  winRate: number | null;
  rounds: number;
}

/** A full team: also its best finish. */
export interface MetaTeam extends MetaCombo {
  best: { placing: number; tournament: string };
}

export interface MetaCombos {
  pairs: MetaCombo[];
  trios: MetaCombo[];
  quads: MetaCombo[];
  teams: MetaTeam[];
}

/**
 * The most common pairs, trios and quads of Pokémon on the same team, and
 * the most common full teams (at least two of them), by species — a Mega
 * counts as its species, so the same core isn't split by which Mega a
 * player brought. Win rates come from round results, byes left out.
 */
export function aggregateCombinations(
  events: OfficialEvent[],
  { top = 32, limit = 20 }: { top?: number; limit?: number } = {},
): MetaCombos {
  type Tally = {
    species: string[];
    teams: number;
    topTeams: number;
    won: number;
    played: number;
    best?: { placing: number; tournament: string };
  };
  const tallies = [2, 3, 4, 6].map(() => new Map<string, Tally>());
  let teams = 0;
  let topTeams = 0;

  for (const event of events) {
    for (const player of event.players) {
      const isTop = player.placing <= top;
      teams += 1;
      if (isTop) topTeams += 1;
      const played = player.rounds.filter((round) => round.result !== "bye");
      const won = played.filter((round) => round.result === "win").length;
      const species = baseSpeciesOf(player);
      [2, 3, 4, 6].forEach((size, index) => {
        if (species.length < size) return;
        const groups = size === 6 ? [species] : combinations(species, size);
        for (const group of groups) {
          const key = group.join("|");
          const tally = tallies[index].get(key) ?? {
            species: group,
            teams: 0,
            topTeams: 0,
            won: 0,
            played: 0,
          };
          tally.teams += 1;
          if (isTop) tally.topTeams += 1;
          tally.won += won;
          tally.played += played.length;
          if (size === 6 && (!tally.best || player.placing < tally.best.placing)) {
            tally.best = { placing: player.placing, tournament: event.title };
          }
          tallies[index].set(key, tally);
        }
      });
    }
  }

  const ranked = (map: Map<string, Tally>, minTeams = 1) =>
    [...map.values()]
      .filter((tally) => tally.teams >= minTeams)
      .sort((a, b) => b.teams - a.teams || a.species.join().localeCompare(b.species.join()))
      .slice(0, limit)
      .map((tally) => ({
        species: tally.species,
        teams: tally.teams,
        usage: teams ? tally.teams / teams : 0,
        topUsage: topTeams ? tally.topTeams / topTeams : 0,
        winRate: tally.played ? tally.won / tally.played : null,
        rounds: tally.played,
        ...(tally.best ? { best: tally.best } : {}),
      }));

  return {
    pairs: ranked(tallies[0]),
    trios: ranked(tallies[1]),
    quads: ranked(tallies[2]),
    teams: ranked(tallies[3], 2) as MetaTeam[],
  };
}
