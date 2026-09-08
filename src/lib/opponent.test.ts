import { describe, expect, it } from "vitest";
import { createOpponent, getPlanForTeam, normalizeOpponent } from "./opponent";
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
