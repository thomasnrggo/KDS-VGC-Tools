import { describe, expect, it } from "vitest";
import type { MetaCombo, MetaPokemon } from "./aggregateMeta";
import type { MetaDocument } from "./metaDocument";
import { metaSnapshot } from "./metaSnapshot";
import { fromFirestoreFields } from "./serverMeta";

function mon(species: string): MetaPokemon {
  return {
    species,
    teams: 1,
    usage: 0.1,
    topUsage: 0.1,
    winRate: 0.5,
    rounds: 10,
    items: [],
    abilities: [],
    natures: [],
    moves: [],
    sets: [],
    teammates: [],
    history: [],
  };
}

const combo = (index: number): MetaCombo => ({
  species: [`A${index}`, `B${index}`],
  teams: 1,
  usage: 0.1,
  topUsage: 0.1,
  winRate: null,
  rounds: 0,
});

function doc(): MetaDocument {
  const combos = {
    pairs: [0, 1, 2].map(combo),
    trios: [0, 1, 2].map(combo),
    quads: [0, 1, 2].map(combo),
    teams: [0, 1, 2].map((index) => ({
      ...combo(index),
      best: { placing: 1, tournament: "t" },
    })),
  };
  return {
    regulationId: "regulation-m-c",
    updatedAt: "2026-11-04T00:00:00.000Z",
    official: {
      source: "test",
      division: "Masters",
      tournaments: [],
      teams: 100,
      topTeams: 32,
      pokemon: ["A", "B", "C", "D"].map(mon),
      combos,
      recent: {
        teams: 50,
        topTeams: 16,
        tournamentIds: ["t"],
        // D is in the recent top, though not the whole regulation's.
        pokemon: ["B", "D", "A", "C"].map(mon),
        combos,
      },
    },
  };
}

describe("metaSnapshot", () => {
  it("keeps the top of each list, and the history of what's in the recent top", () => {
    const snapshot = metaSnapshot(doc(), 2);
    expect(snapshot.official.recent!.pokemon.map((entry) => entry.species)).toEqual(["B", "D"]);
    expect(snapshot.official.pokemon.map((entry) => entry.species)).toEqual(["A", "B", "D"]);
    expect(snapshot.official.combos!.pairs).toHaveLength(2);
    expect(snapshot.official.recent!.combos!.teams).toHaveLength(2);
    expect(snapshot.official.teams).toBe(100);
    expect(snapshot.updatedAt).toBe("2026-11-04T00:00:00.000Z");
  });

  it("handles a document without the recent slice", () => {
    const old = doc();
    delete old.official.recent;
    const snapshot = metaSnapshot(old, 2);
    expect(snapshot.official.recent).toBeUndefined();
    expect(snapshot.official.pokemon.map((entry) => entry.species)).toEqual(["A", "B"]);
  });
});

describe("fromFirestoreFields", () => {
  it("turns a REST document's typed values into plain JSON", () => {
    expect(
      fromFirestoreFields({
        name: { stringValue: "Rillaboom" },
        teams: { integerValue: "589" },
        usage: { doubleValue: 0.25 },
        whole: { doubleValue: 1 },
        winRate: { nullValue: null },
        mega: { booleanValue: false },
        at: { timestampValue: "2026-11-04T20:15:24Z" },
        history: {
          arrayValue: { values: [{ mapValue: { fields: { usage: { doubleValue: 0.1 } } } }] },
        },
        empty: { arrayValue: {} },
        nested: { mapValue: {} },
      }),
    ).toEqual({
      name: "Rillaboom",
      teams: 589,
      usage: 0.25,
      whole: 1,
      winRate: null,
      mega: false,
      at: "2026-11-04T20:15:24Z",
      history: [{ usage: 0.1 }],
      empty: [],
      nested: {},
    });
  });
});
