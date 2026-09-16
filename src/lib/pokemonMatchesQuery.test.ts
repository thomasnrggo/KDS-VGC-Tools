import { describe, expect, it } from "vitest";
import {
  matchesAnySearchTerm,
  parseSearchTerms,
  pokemonMatchesQuery,
} from "./pokemonMatchesQuery";

describe("parseSearchTerms", () => {
  it("splits on whitespace, lowercases, and drops empty tokens", () => {
    expect(parseSearchTerms("Charizard   Garchomp")).toEqual(["charizard", "garchomp"]);
    expect(parseSearchTerms("  ")).toEqual([]);
  });
});

describe("pokemonMatchesQuery", () => {
  it("matches species or held item, case-insensitively", () => {
    expect(pokemonMatchesQuery({ species: "Charizard", item: "Choice Scarf" }, "charizard")).toBe(
      true,
    );
    expect(pokemonMatchesQuery({ species: "Charizard", item: "Choice Scarf" }, "scarf")).toBe(
      true,
    );
    expect(pokemonMatchesQuery({ species: "Charizard" }, "garchomp")).toBe(false);
  });
});

describe("matchesAnySearchTerm", () => {
  it("matches when the name contains any one of several terms", () => {
    const terms = parseSearchTerms("charizard garchomp");
    expect(matchesAnySearchTerm("Charizard", terms)).toBe(true);
    expect(matchesAnySearchTerm("Garchomp", terms)).toBe(true);
    expect(matchesAnySearchTerm("Alakazam", terms)).toBe(false);
  });

  it("matches case-insensitively against the name (terms are expected pre-lowercased, per parseSearchTerms)", () => {
    expect(matchesAnySearchTerm("Raichu-Alola", ["alola"])).toBe(true);
    expect(matchesAnySearchTerm("Raichu-Alola", ["raichu"])).toBe(true);
  });

  it("returns false for an empty terms list", () => {
    expect(matchesAnySearchTerm("Charizard", [])).toBe(false);
  });
});
