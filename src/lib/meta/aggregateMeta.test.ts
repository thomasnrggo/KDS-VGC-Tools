import { describe, expect, it } from "vitest";
import { aggregateOfficialMeta, type MetaPokemon } from "./aggregateMeta";
import {
  parseOfficialEvent,
  type OfficialEvent,
  type OfficialPlayer,
  type PokedataRosterEntry,
  type PokedataStandings,
} from "./officialTournament";
import rosterFixture from "./__fixtures__/puebla-2026-roster.json";
import standingsFixture from "./__fixtures__/puebla-2026-masters-standings.json";

const puebla = parseOfficialEvent(
  rosterFixture as unknown as PokedataRosterEntry[],
  standingsFixture as unknown as PokedataStandings,
);

function find(pokemon: MetaPokemon[], species: string): MetaPokemon {
  const found = pokemon.find((mon) => mon.species === species);
  if (!found) throw new Error(`no ${species}`);
  return found;
}

describe("aggregateOfficialMeta on the Puebla Regional", () => {
  const meta = aggregateOfficialMeta([puebla]);

  it("counts teams overall and in the top 32", () => {
    expect(meta).toMatchObject({ events: 1, teams: 333, topTeams: 32 });
  });

  it("separates what's used from what's used at the top", () => {
    // Counted straight from the roster file.
    expect(find(meta.pokemon, "Rillaboom").usage).toBeCloseTo(140 / 333, 3);
    expect(find(meta.pokemon, "Rillaboom").topUsage).toBeCloseTo(4 / 32, 3);
    expect(find(meta.pokemon, "Charizard").topUsage).toBeCloseTo(15 / 32, 3);
    // Most-used first.
    const usages = meta.pokemon.map((mon) => mon.teams);
    expect(usages).toEqual([...usages].sort((a, b) => b - a));
  });

  it("lists common sets with moves in a stable order", () => {
    const sneasler = find(meta.pokemon, "Sneasler");
    expect(sneasler.teams).toBe(140);
    expect(sneasler.sets[0].share).toBeCloseTo(16 / 140, 3);
    expect(sneasler.sets[0]).toMatchObject({
      item: "Electric Seed",
      ability: "Unburden",
      nature: "Adamant",
      moves: ["Close Combat", "Dire Claw", "Protect", "Swords Dance"],
    });
    for (const set of sneasler.sets) expect(set.moves).toEqual([...set.moves].sort());
    expect(sneasler.moves[0]).toMatchObject({ name: "Close Combat" });
  });

  it("finds cores", () => {
    expect(find(meta.pokemon, "Pelipper").teammates[0].name).toBe("Archaludon");
  });

  it("keeps a win rate with its sample size", () => {
    const basculegion = find(meta.pokemon, "Basculegion-F");
    expect(basculegion.rounds).toBeGreaterThan(200);
    expect(basculegion.winRate).toBeGreaterThan(0.5);
  });
});

describe("aggregateOfficialMeta's maths", () => {
  function player(
    placing: number,
    species: string[],
    results: OfficialPlayer["rounds"][number]["result"][],
  ): OfficialPlayer {
    return {
      placing,
      record: { wins: 0, losses: 0, ties: 0 },
      madeTopCut: false,
      dropped: false,
      team: species.map((name) => ({ species: name, moves: [] })),
      rounds: results.map((result) => ({ opponentPlacing: null, result })),
    };
  }
  const event: OfficialEvent = {
    title: "Test",
    date: "",
    division: "Masters",
    players: [
      player(1, ["Pelipper", "Archaludon"], ["win", "win", "bye"]),
      player(2, ["Pelipper"], ["loss", "win"]),
      player(3, ["Incineroar"], ["loss", "tie"]),
    ],
    join: { sheets: 3, standings: 3, matched: 3 },
  };
  const meta = aggregateOfficialMeta([event], { top: 1 });

  it("leaves byes out of win rates", () => {
    // Pelipper: 3 wins in 4 played rounds (the bye doesn't count).
    expect(find(meta.pokemon, "Pelipper")).toMatchObject({ winRate: 0.75, rounds: 4, teams: 2 });
    expect(find(meta.pokemon, "Incineroar")).toMatchObject({ winRate: 0, rounds: 2 });
  });

  it("keeps each Pokémon's usage at each event", () => {
    const later: OfficialEvent = {
      ...event,
      title: "Later",
      players: [player(1, ["Incineroar"], ["win"]), player(2, ["Pelipper"], ["loss"])],
    };
    const both = aggregateOfficialMeta([event, later], { top: 1 });
    expect(find(both.pokemon, "Pelipper").history).toEqual([
      { usage: 2 / 3, topUsage: 1 },
      { usage: 1 / 2, topUsage: 0 },
    ]);
    // Absent from an event: zero there, not missing.
    expect(find(both.pokemon, "Archaludon").history[1]).toEqual({ usage: 0, topUsage: 0 });
  });

  it("counts top usage over the top placings only", () => {
    expect(find(meta.pokemon, "Archaludon").topUsage).toBe(1);
    expect(find(meta.pokemon, "Incineroar").topUsage).toBe(0);
    expect(find(meta.pokemon, "Pelipper").usage).toBeCloseTo(2 / 3);
  });
});
