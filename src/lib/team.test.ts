import { describe, expect, it } from "vitest";
import { createTeam, validateTeamSize } from "./team";

describe("createTeam", () => {
  it("wraps parseTeam output with an id, rawPaste, and updatedAt", () => {
    const team = createTeam("Ditto @ Choice Scarf\nAbility: Imposter");

    expect(team.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(team.rawPaste).toBe("Ditto @ Choice Scarf\nAbility: Imposter");
    expect(team.pokemon).toEqual([{ species: "Ditto", item: "Choice Scarf" }]);
    expect(() => new Date(team.updatedAt).toISOString()).not.toThrow();
  });
});

describe("validateTeamSize", () => {
  it("rejects an empty roster", () => {
    expect(validateTeamSize([])).toMatch(/couldn't find/i);
  });

  it("accepts 1 to 6 Pokémon", () => {
    const one = [{ species: "Ditto" }];
    const six = Array.from({ length: 6 }, () => ({ species: "Ditto" }));
    expect(validateTeamSize(one)).toBeNull();
    expect(validateTeamSize(six)).toBeNull();
  });

  it("rejects more than 6 Pokémon", () => {
    const seven = Array.from({ length: 7 }, () => ({ species: "Ditto" }));
    expect(validateTeamSize(seven)).toMatch(/only have 6/);
  });
});
