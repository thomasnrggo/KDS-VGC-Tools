import { describe, expect, it } from "vitest";
import { learnableMoves, speciesLearnableMoves, withMove, type LearnsetData } from "./learnsets";

const DATA: LearnsetData = {
  moves: ["fake-out", "protect", "thunderbolt", "attract"],
  learnsets: { raichu: [0, 1, 2, 3], "basculegion-female": [1] },
};

describe("learnableMoves", () => {
  it("is the generated moves without an override", () => {
    expect(learnableMoves(DATA, {}, "raichu")).toEqual(
      new Set(["fake-out", "protect", "thunderbolt", "attract"]),
    );
  });

  it("adds and removes the override's moves", () => {
    const moves = learnableMoves(
      DATA,
      { raichu: { add: ["alluring-voice"], remove: ["attract"] } },
      "raichu",
    );
    expect(moves?.has("alluring-voice")).toBe(true);
    expect(moves?.has("attract")).toBe(false);
  });

  it("is null for a species nothing covers, so every move is offered", () => {
    expect(learnableMoves(DATA, {}, "minior-blue-meteor")).toBeNull();
  });

  it("covers a species the data misses once the admin adds moves", () => {
    expect(learnableMoves(DATA, { minior: { add: ["protect"] } }, "minior")).toEqual(
      new Set(["protect"]),
    );
  });
});

describe("speciesLearnableMoves", () => {
  it("finds a set's species by its Showdown name, aliases included", () => {
    expect(speciesLearnableMoves(DATA, {}, "Raichu")?.has("thunderbolt")).toBe(true);
    // Showdown's "Basculegion-F" is species.json's "basculegion-female".
    expect(speciesLearnableMoves(DATA, {}, "Basculegion-F")).toEqual(new Set(["protect"]));
  });

  it("is null for a species nothing covers", () => {
    expect(speciesLearnableMoves(DATA, {}, "Minior-Blue-Meteor")).toBeNull();
  });
});

describe("withMove", () => {
  const generated = new Set(["protect", "attract"]);

  it("removes a generated move, and puts it back by dropping the override", () => {
    const removed = withMove(undefined, generated, "attract", false);
    expect(removed).toEqual({ remove: ["attract"] });
    expect(withMove(removed!, generated, "attract", true)).toBeNull();
  });

  it("adds a move the data misses, and takes it away again", () => {
    const added = withMove({ remove: ["attract"] }, generated, "alluring-voice", true);
    expect(added).toEqual({ add: ["alluring-voice"], remove: ["attract"] });
    expect(withMove(added!, generated, "alluring-voice", false)).toEqual({ remove: ["attract"] });
  });
});
