import { describe, expect, it } from "vitest";
import {
  compareOpponentOrder,
  createOpponent,
  getPlanForTeam,
  moveOpponent,
  normalizeOpponent,
  topSortOrder,
} from "./opponent";
import { REGULATIONS } from "@/data/regulations";
import type { Opponent } from "@/types";

const REG_ID = REGULATIONS[0].id;

describe("createOpponent", () => {
  it("wires up label, pokepasteUrl, regulationId, an empty plan map, and a parsed team", () => {
    const opponent = createOpponent(
      "Blastoise Delphox - LenVGC",
      "Ditto @ Choice Scarf\nAbility: Imposter",
      REG_ID,
      "https://pokepast.es/abc123",
    );

    expect(opponent.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(opponent.label).toBe("Blastoise Delphox - LenVGC");
    expect(opponent.pokepasteUrl).toBe("https://pokepast.es/abc123");
    expect(opponent.regulationId).toBe(REG_ID);
    expect(opponent.plansByTeamId).toEqual({});
    expect(opponent.team.pokemon).toEqual([
      { species: "Ditto", item: "Choice Scarf", ability: "Imposter" },
    ]);
    expect(opponent.createdAt).toBe(opponent.updatedAt);
  });

  it("leaves pokepasteUrl undefined when not given", () => {
    const opponent = createOpponent("No Link Team", "Ditto", REG_ID);
    expect(opponent.pokepasteUrl).toBeUndefined();
  });
});

describe("getPlanForTeam", () => {
  it("returns an empty plan when there's no active team or no saved plan", () => {
    const opponent = createOpponent("Some Team", "Ditto", REG_ID);
    expect(getPlanForTeam(opponent, null)).toEqual({
      leadPair: [null, null],
      backPair: [null, null],
      leadMega: [true, true],
      backMega: [true, true],
      notes: "",
    });
    expect(getPlanForTeam(opponent, "team-1")).toEqual({
      leadPair: [null, null],
      backPair: [null, null],
      leadMega: [true, true],
      backMega: [true, true],
      notes: "",
    });
  });

  it("returns the saved plan for the given team id", () => {
    const opponent = createOpponent("Some Team", "Ditto", REG_ID);
    opponent.plansByTeamId["team-1"] = {
      leadPair: [0, null],
      backPair: [null, null],
      leadMega: [false, true],
      backMega: [true, true],
      notes: "go",
    };
    expect(getPlanForTeam(opponent, "team-1")).toEqual({
      leadPair: [0, null],
      backPair: [null, null],
      leadMega: [false, true],
      backMega: [true, true],
      notes: "go",
    });
  });

  it("backfills leadMega/backMega with the default (true) for a plan saved before those fields existed", () => {
    const opponent = createOpponent("Some Team", "Ditto", REG_ID);
    // Simulates a plan persisted before leadMega/backMega existed.
    opponent.plansByTeamId["team-1"] = {
      leadPair: [0, null],
      backPair: [null, null],
      notes: "go",
    } as unknown as ReturnType<typeof getPlanForTeam>;
    expect(getPlanForTeam(opponent, "team-1")).toEqual({
      leadPair: [0, null],
      backPair: [null, null],
      leadMega: [true, true],
      backMega: [true, true],
      notes: "go",
    });
  });
});

describe("normalizeOpponent", () => {
  it("migrates a pre-plansByTeamId record's flat leadPair/backPair/notes under the legacy team id", () => {
    // Simulates a pre-existing IndexedDB record from before Opponent had plansByTeamId
    // (when leadPair/backPair/notes lived directly on Opponent instead).
    const stale = { ...createOpponent("Legacy Team", "Ditto", REG_ID) } as unknown as Opponent & {
      leadPair: [number | null, number | null];
      backPair: [number | null, number | null];
      notes: string;
    };
    // @ts-expect-error simulating a record shape from before plansByTeamId existed
    delete stale.plansByTeamId;
    stale.leadPair = [0, null];
    stale.backPair = [null, null];
    stale.notes = "watch out for trick room";

    const normalized = normalizeOpponent(stale, "team-abc");
    expect(normalized.plansByTeamId).toEqual({
      "team-abc": {
        leadPair: [0, null],
        backPair: [null, null],
        leadMega: [true, true],
        backMega: [true, true],
        notes: "watch out for trick room",
      },
    });
    expect(normalized.label).toBe("Legacy Team");
  });

  it("falls back to a fixed legacy key when no legacy team id is known", () => {
    const stale = { ...createOpponent("Legacy Team", "Ditto", REG_ID) } as unknown as Opponent & {
      leadPair: [number | null, number | null];
      backPair: [number | null, number | null];
      notes: string;
    };
    // @ts-expect-error simulating a record shape from before plansByTeamId existed
    delete stale.plansByTeamId;
    stale.leadPair = [0, null];
    stale.backPair = [null, null];
    stale.notes = "";

    expect(normalizeOpponent(stale).plansByTeamId).toEqual({
      legacy: {
        leadPair: [0, null],
        backPair: [null, null],
        leadMega: [true, true],
        backMega: [true, true],
        notes: "",
      },
    });
  });

  it("leaves an already-current opponent untouched", () => {
    const opponent = createOpponent("Current Team", "Ditto", REG_ID);
    opponent.plansByTeamId["team-1"] = {
      leadPair: [0, null],
      backPair: [null, null],
      leadMega: [true, false],
      backMega: [true, true],
      notes: "some notes",
    };
    expect(normalizeOpponent(opponent)).toEqual(opponent);
  });
});

describe("normalizeOpponent sortOrder backfill", () => {
  it("backfills sortOrder from createdAt for an opponent saved before manual ordering existed", () => {
    const stale = { ...createOpponent("Legacy Team", "Ditto", REG_ID) } as Partial<Opponent>;
    delete stale.sortOrder;
    stale.createdAt = "2026-10-01T00:00:00.000Z";
    expect(normalizeOpponent(stale as Opponent).sortOrder).toBe(
      Date.parse("2026-10-01T00:00:00.000Z"),
    );
  });

  it("backfills tags to an empty list for an opponent saved before tags existed", () => {
    const stale = { ...createOpponent("Legacy Team", "Ditto", REG_ID) } as Partial<Opponent>;
    delete stale.tags;
    expect(normalizeOpponent(stale as Opponent).tags).toEqual([]);
  });

  it("leaves an existing sortOrder alone", () => {
    const opponent = createOpponent("Team", "Ditto", REG_ID, undefined, 42);
    expect(normalizeOpponent(opponent).sortOrder).toBe(42);
  });
});

function opponentWith(
  id: string,
  sortOrder: number,
  createdAt = "2026-10-01T00:00:00.000Z",
): Opponent {
  return { ...createOpponent(id, "Ditto", REG_ID), id, sortOrder, createdAt };
}

function ids(opponents: Opponent[]): string[] {
  return opponents.map((opponent) => opponent.id);
}

/** Applies moveOpponent's changes and returns the resulting list order. */
function applyMove(ordered: Opponent[], movedId: string, toIndex: number): string[] {
  const changed = new Map(moveOpponent(ordered, movedId, toIndex).map((o) => [o.id, o]));
  return ids(ordered.map((o) => changed.get(o.id) ?? o).sort(compareOpponentOrder));
}

describe("compareOpponentOrder", () => {
  it("sorts highest sortOrder first", () => {
    const list = [opponentWith("a", 1), opponentWith("b", 3), opponentWith("c", 2)];
    expect(ids(list.sort(compareOpponentOrder))).toEqual(["b", "c", "a"]);
  });

  it("breaks sortOrder ties by newest createdAt, then id, so the order never depends on input order", () => {
    const older = opponentWith("z", 5, "2026-10-01T00:00:00.000Z");
    const newer = opponentWith("y", 5, "2026-10-02T00:00:00.000Z");
    const tiedA = opponentWith("a", 5, "2026-09-01T00:00:00.000Z");
    const tiedB = opponentWith("b", 5, "2026-09-01T00:00:00.000Z");
    expect(ids([tiedB, older, tiedA, newer].sort(compareOpponentOrder))).toEqual([
      "y",
      "z",
      "a",
      "b",
    ]);
    expect(ids([newer, tiedA, older, tiedB].sort(compareOpponentOrder))).toEqual([
      "y",
      "z",
      "a",
      "b",
    ]);
  });
});

describe("topSortOrder", () => {
  it("returns a value above every existing opponent", () => {
    expect(topSortOrder([opponentWith("a", 10), opponentWith("b", -3)])).toBe(11);
  });

  it("returns 0 for an empty list", () => {
    expect(topSortOrder([])).toBe(0);
  });
});

describe("moveOpponent", () => {
  const list = () => [
    opponentWith("a", 40),
    opponentWith("b", 30),
    opponentWith("c", 20),
    opponentWith("d", 10),
  ];

  it("only rewrites the moved opponent, using the midpoint of its new neighbors", () => {
    const changed = moveOpponent(list(), "d", 1);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ id: "d", sortOrder: 35 });
  });

  it("moves to the top and bottom", () => {
    expect(applyMove(list(), "c", 0)).toEqual(["c", "a", "b", "d"]);
    expect(applyMove(list(), "a", 3)).toEqual(["b", "c", "d", "a"]);
  });

  it("moves down past a neighbor", () => {
    expect(applyMove(list(), "a", 1)).toEqual(["b", "a", "c", "d"]);
  });

  it("bumps updatedAt on the moved opponent so cloud sync's last-write-wins picks it up", () => {
    const stale = list().map((opponent) => ({
      ...opponent,
      updatedAt: "2020-01-01T00:00:00.000Z",
    }));
    const [changed] = moveOpponent(stale, "d", 0);
    expect(changed.updatedAt > "2020-01-01T00:00:00.000Z").toBe(true);
  });

  it("returns nothing when the opponent is already at that position or isn't in the list", () => {
    expect(moveOpponent(list(), "b", 1)).toEqual([]);
    expect(moveOpponent(list(), "missing", 0)).toEqual([]);
  });

  it("renumbers the list when tied neighbors leave no room in between", () => {
    const tied = [
      opponentWith("a", 5, "2026-10-04T00:00:00.000Z"),
      opponentWith("b", 5, "2026-10-03T00:00:00.000Z"),
      opponentWith("c", 5, "2026-10-02T00:00:00.000Z"),
      opponentWith("d", 5, "2026-10-01T00:00:00.000Z"),
    ];
    expect(applyMove(tied, "d", 1)).toEqual(["a", "d", "b", "c"]);
  });
});
