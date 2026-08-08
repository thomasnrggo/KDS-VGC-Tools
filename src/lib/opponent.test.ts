import { describe, expect, it } from "vitest";
import { createOpponent, normalizeOpponent, type Opponent } from "./opponent";

describe("createOpponent", () => {
  it("wires up label, pokepasteUrl, an empty plan, and a parsed team", () => {
    const opponent = createOpponent(
      "Blastoise Delphox - LenVGC",
      "Ditto @ Choice Scarf\nAbility: Imposter",
      "https://pokepast.es/abc123",
    );

    expect(opponent.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(opponent.label).toBe("Blastoise Delphox - LenVGC");
    expect(opponent.pokepasteUrl).toBe("https://pokepast.es/abc123");
    expect(opponent.leadPair).toEqual([null, null]);
    expect(opponent.backPair).toEqual([null, null]);
    expect(opponent.notes).toBe("");
    expect(opponent.team.pokemon).toEqual([{ species: "Ditto", item: "Choice Scarf" }]);
    expect(opponent.createdAt).toBe(opponent.updatedAt);
  });

  it("leaves pokepasteUrl undefined when not given", () => {
    const opponent = createOpponent("No Link Team", "Ditto");
    expect(opponent.pokepasteUrl).toBeUndefined();
  });
});

describe("normalizeOpponent", () => {
  it("backfills leadPair/backPair/notes on an opponent saved by an older schema", () => {
    // Simulates a pre-existing IndexedDB record from before Opponent had these fields
    // (e.g. one saved back when plans lived under a `gamePlans` array instead).
    const stale = { ...createOpponent("Legacy Team", "Ditto") } as Opponent;
    // @ts-expect-error simulating a record shape from before these fields existed
    delete stale.leadPair;
    // @ts-expect-error simulating a record shape from before these fields existed
    delete stale.backPair;
    // @ts-expect-error simulating a record shape from before these fields existed
    delete stale.notes;

    const normalized = normalizeOpponent(stale);
    expect(normalized.leadPair).toEqual([null, null]);
    expect(normalized.backPair).toEqual([null, null]);
    expect(normalized.notes).toBe("");
    expect(normalized.label).toBe("Legacy Team");
  });

  it("leaves an already-current opponent untouched", () => {
    const opponent = createOpponent("Current Team", "Ditto");
    opponent.leadPair = [0, null];
    opponent.notes = "some notes";
    expect(normalizeOpponent(opponent)).toEqual(opponent);
  });
});
