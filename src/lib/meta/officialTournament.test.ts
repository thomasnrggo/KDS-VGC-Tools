import { describe, expect, it } from "vitest";
import {
  officialSpeciesName,
  parseOfficialEvent,
  type PokedataRosterEntry,
  type PokedataStandings,
} from "./officialTournament";
import { resolveTypes } from "@/lib/damage/calculateDamage";
// The Puebla Regional (2026-10-24), anonymized: names are "Player {placing}".
import rosterFixture from "./__fixtures__/puebla-2026-roster.json";
import standingsFixture from "./__fixtures__/puebla-2026-masters-standings.json";

const roster = rosterFixture as unknown as PokedataRosterEntry[];
const standings = standingsFixture as unknown as PokedataStandings;

describe("officialSpeciesName", () => {
  it("maps the game's form names to Showdown's", () => {
    expect(officialSpeciesName("Basculegion [Female]")).toBe("Basculegion-F");
    expect(officialSpeciesName("Basculegion [Male]")).toBe("Basculegion");
    expect(officialSpeciesName("Arcanine [Hisuian Form]")).toBe("Arcanine-Hisui");
    expect(officialSpeciesName("Ninetales [Alolan Form]")).toBe("Ninetales-Alola");
    expect(officialSpeciesName("Slowbro [Galarian Form]")).toBe("Slowbro-Galar");
    expect(officialSpeciesName("Tauros [Paldean Form - Blaze Breed]")).toBe("Tauros-Paldea-Blaze");
    expect(officialSpeciesName("Rotom [Wash Rotom]")).toBe("Rotom-Wash");
    expect(officialSpeciesName("Floette [Eternal Flower]")).toBe("Floette-Eternal");
    expect(officialSpeciesName("Maushold [Family of Four]")).toBe("Maushold-Four");
    expect(officialSpeciesName("Lycanroc [Midday Form]")).toBe("Lycanroc");
    expect(officialSpeciesName("Lycanroc [Dusk Form]")).toBe("Lycanroc-Dusk");
    expect(officialSpeciesName("Sinistcha [Masterpiece Form]")).toBe("Sinistcha");
    expect(officialSpeciesName("Garchomp")).toBe("Garchomp");
  });

  it("gives every species at Puebla a name the app resolves", () => {
    const names = new Set(roster.flatMap((entry) => entry.tl.map((mon) => mon[5])));
    const unresolved = [...names].filter(
      (name) => resolveTypes(officialSpeciesName(name)) === undefined,
    );
    expect(unresolved).toEqual([]);
  });
});

describe("parseOfficialEvent's join", () => {
  function sheet(name: string, country: string, placing: number, species: string) {
    return {
      n: name,
      c: country,
      d: "M",
      "#": String(placing),
      tl: [["0", "000", "Jolly", null, "Intimidate", species, null, ["Fake Out"]]],
    } as unknown as PokedataRosterEntry;
  }
  function standing(name: string, country: string, id: number) {
    return { n: name, c: country, s: [1, 0, 0], d: null, i: id, r: [], top_cut_seed: null };
  }
  const file = (players: ReturnType<typeof standing>[]) =>
    ({
      tournament: { title: "Test", date: "" },
      standings: { division: "Masters", players },
    }) as unknown as PokedataStandings;

  it("matches by name and country even when the roster's placings are stale", () => {
    // The standings were re-sorted after the roster was numbered.
    const event = parseOfficialEvent(
      [sheet("Ann", "US", 1, "Incineroar"), sheet("Bo", "MX", 2, "Rillaboom")],
      file([standing("Bo", "MX", 7), standing("Ann", "US", 8)]),
    );
    expect(event.players.map((player) => player.team[0].species)).toEqual([
      "Rillaboom",
      "Incineroar",
    ]);
    expect(event.join).toEqual({ sheets: 2, standings: 2, matched: 2 });
  });

  it("tells same-named players apart by the nearest placing", () => {
    const event = parseOfficialEvent(
      [sheet("Sam", "MX", 52, "Sneasler"), sheet("Sam", "MX", 322, "Pelipper")],
      file([
        standing("Sam", "MX", 1),
        ...Array(300).fill(standing("x", "", 9)),
        standing("Sam", "MX", 2),
      ]),
    );
    expect(event.players[0].team[0].species).toBe("Sneasler");
    expect(event.players[1].team[0].species).toBe("Pelipper");
  });

  it("falls back to the name when the countries don't agree", () => {
    const event = parseOfficialEvent(
      [sheet("Ann", "", 1, "Incineroar")],
      file([standing("Ann", "US", 1)]),
    );
    expect(event.join.matched).toBe(1);
  });

  it("leaves out players without a sheet and says so", () => {
    const event = parseOfficialEvent(
      [sheet("Ann", "US", 1, "Incineroar")],
      file([standing("Ann", "US", 1), standing("Cy", "BR", 2)]),
    );
    expect(event.join).toEqual({ sheets: 1, standings: 2, matched: 1 });
  });
});

describe("parseOfficialEvent", () => {
  const event = parseOfficialEvent(roster, standings);

  it("joins every Masters player's team to their result, in final order", () => {
    expect(event.title).toBe("2027 Puebla Pokémon VGC Regional Championships");
    expect(event.division).toBe("Masters");
    expect(event.players).toHaveLength(333);
    expect(event.players.map((player) => player.placing)).toEqual(
      Array.from({ length: 333 }, (_, index) => index + 1),
    );
    const winner = event.players[0];
    expect(winner.record).toEqual({ wins: 13, losses: 2, ties: 0 });
    expect(winner.madeTopCut).toBe(true);
    expect(winner.team).toHaveLength(6);
    expect(winner.team[0]).toMatchObject({ moves: expect.any(Array) });
    expect(event.players[332].madeTopCut).toBe(false);
  });

  it("turns round entries into opponents' placings, results and byes", () => {
    const winner = event.players[0];
    expect(winner.rounds).toHaveLength(15);
    expect(winner.rounds.filter((round) => round.result === "bye")).toEqual([
      { opponentPlacing: null, result: "bye" },
    ]);
    // Their first-round opponent's own rounds include the loss to them.
    const [first] = winner.rounds;
    expect(first.result).toBe("win");
    const opponent = event.players[first.opponentPlacing! - 1];
    expect(opponent.rounds).toContainEqual({ opponentPlacing: 1, result: "loss" });
    const byes = event.players.flatMap((player) => player.rounds).filter((r) => r.result === "bye");
    expect(byes).toHaveLength(11);
  });

  it("keeps no names", () => {
    expect(JSON.stringify(event)).not.toContain("Player ");
  });

  it("reports a complete join", () => {
    expect(event.join).toEqual({ sheets: 333, standings: 333, matched: 333 });
  });

  it("leaves out the other divisions", () => {
    expect(roster.filter((entry) => entry.d !== "M").length).toBeGreaterThan(0);
    expect(event.players.every((player) => player.placing <= 333)).toBe(true);
  });
});
