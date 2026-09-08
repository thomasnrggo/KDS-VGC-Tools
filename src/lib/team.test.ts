import { describe, expect, it } from "vitest";
import { createTeam, normalizeTeam, validateTeamSize } from "./team";
import { REGULATIONS } from "@/data/regulations";

const REG_ID = REGULATIONS[0].id;

describe("createTeam", () => {
  it("wraps parseTeam output with an id, name, rawPaste, regulationId, and updatedAt", () => {
    const team = createTeam("Ditto @ Choice Scarf\nAbility: Imposter", "Team 1", REG_ID);

    expect(team.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(team.name).toBe("Team 1");
    expect(team.rawPaste).toBe("Ditto @ Choice Scarf\nAbility: Imposter");
    expect(team.regulationId).toBe(REG_ID);
    expect(team.pokemon).toEqual([
      { species: "Ditto", item: "Choice Scarf", ability: "Imposter" },
    ]);
    expect(() => new Date(team.updatedAt).toISOString()).not.toThrow();
  });
});

describe("normalizeTeam", () => {
  it("leaves an already-current team untouched", () => {
    const team = createTeam("Ditto", "Team 1", REG_ID);
    expect(normalizeTeam(team)).toEqual(team);
  });

  it("backfills regulationId for a team saved before it existed", () => {
    const stale = { ...createTeam("Ditto", "Team 1", REG_ID) } as unknown as Record<
      string,
      unknown
    >;
    delete stale.regulationId;
    expect(normalizeTeam(stale as never).regulationId).toBe(REGULATIONS[0].id);
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
