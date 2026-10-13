import { describe, expect, it } from "vitest";
import {
  matchesAnySearchTerm,
  parseSearchTerms,
  pokemonMatchesQuery,
} from "./pokemonMatchesQuery";
import { createPokemonText } from "./i18n/pokemonNames";

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

describe("translated names", () => {
  const text = createPokemonText("es", {
    species: { garchomp: "Garchomp", "raichu-alola": "Raichu (Forma de Alola)" },
    moves: {},
    items: { "choice-scarf": "Pañuelo Elección" },
    abilities: {},
    types: {},
    natures: {},
  });

  it("matches the Pokémon-language name too, ignoring accents", () => {
    const mon = { species: "Garchomp", item: "Choice Scarf" };
    expect(pokemonMatchesQuery(mon, "panuelo", text)).toBe(true);
    expect(pokemonMatchesQuery(mon, "scarf", text)).toBe(true);
    expect(pokemonMatchesQuery(mon, "panuelo")).toBe(false);
  });

  it("matches a speed-tier row by its translated name", () => {
    expect(matchesAnySearchTerm("Raichu-Alola", parseSearchTerms("forma"), text.species("Raichu-Alola"))).toBe(
      true,
    );
  });
});
