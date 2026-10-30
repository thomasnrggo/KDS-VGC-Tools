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

  it("refuses to pair a team with the wrong player's result", () => {
    const shuffled = roster.map((entry) =>
      entry.d === "M" && entry["#"] === "2" ? { ...entry, n: "Someone Else" } : entry,
    );
    expect(() => parseOfficialEvent(shuffled, standings)).toThrow(/Placing 2/);
  });

  it("leaves out the other divisions", () => {
    expect(roster.filter((entry) => entry.d !== "M").length).toBeGreaterThan(0);
    expect(event.players.every((player) => player.placing <= 333)).toBe(true);
  });
});
