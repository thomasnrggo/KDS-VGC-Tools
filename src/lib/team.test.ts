import { describe, expect, it } from "vitest";
import {
  addRegulationTag,
  createTeam,
  duplicateTeam,
  normalizeTeam,
  reorderTeams,
  removeRegulationTag,
  validateTeamSize,
} from "./team";
import { REGULATIONS } from "@/data/regulations";
import type { Team } from "@/types";

const REG_ID = REGULATIONS[0].id;
const OTHER_REG_ID = REGULATIONS[1].id;

describe("createTeam", () => {
  it("wraps parseTeam output with an id, name, rawPaste, a single-entry regulationIds, and updatedAt", () => {
    const team = createTeam("Ditto @ Choice Scarf\nAbility: Imposter", "Team 1", REG_ID);

    expect(team.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(team.name).toBe("Team 1");
    expect(team.rawPaste).toBe("Ditto @ Choice Scarf\nAbility: Imposter");
    expect(team.regulationIds).toEqual([REG_ID]);
    expect(team.pokemon).toEqual([{ species: "Ditto", item: "Choice Scarf", ability: "Imposter" }]);
    expect(() => new Date(team.updatedAt).toISOString()).not.toThrow();
  });

  it("sets sortOrder so a freshly created team sorts above an existing one", () => {
    const older = createTeam("Ditto", "Older", REG_ID);
    const newer = createTeam("Ditto", "Newer", REG_ID);
    expect(newer.sortOrder).toBeGreaterThanOrEqual(older.sortOrder);
  });
});

describe("duplicateTeam", () => {
  it("copies the roster and notes under a new id and name, active and unshared", () => {
    const original: Team = {
      ...createTeam("Ditto @ Choice Scarf", "Rain", REG_ID),
      notes: "<p>Lead Pelipper</p>",
      archivedAt: "2026-01-01T00:00:00.000Z",
      share: { id: "share-1" } as unknown as Team["share"],
    };
    const copy = duplicateTeam(original, "Rain (copy)");

    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe("Rain (copy)");
    expect(copy.pokemon).toEqual(original.pokemon);
    expect(copy.rawPaste).toBe(original.rawPaste);
    expect(copy.regulationIds).toEqual(original.regulationIds);
    expect(copy.notes).toBe(original.notes);
    expect(copy.sortOrder).toBeGreaterThanOrEqual(original.sortOrder);
    expect("archivedAt" in copy).toBe(false);
    expect("share" in copy).toBe(false);
    expect(original.share).toBeDefined();
  });
});

describe("normalizeTeam", () => {
  it("leaves an already-current team untouched", () => {
    const team = createTeam("Ditto", "Team 1", REG_ID);
    expect(normalizeTeam(team)).toEqual(team);
  });

  it("migrates a legacy single regulationId field to a one-entry regulationIds array", () => {
    const legacy = { ...createTeam("Ditto", "Team 1", REG_ID) } as unknown as Record<
      string,
      unknown
    >;
    delete legacy.regulationIds;
    legacy.regulationId = REG_ID;
    const normalized = normalizeTeam(legacy as never);
    expect(normalized.regulationIds).toEqual([REG_ID]);
    expect(normalized).not.toHaveProperty("regulationId");
  });

  it("backfills regulationIds for a team saved before either field existed", () => {
    const stale = { ...createTeam("Ditto", "Team 1", REG_ID) } as unknown as Record<
      string,
      unknown
    >;
    delete stale.regulationIds;
    expect(normalizeTeam(stale as never).regulationIds).toEqual([REGULATIONS[0].id]);
  });

  it("backfills sortOrder from updatedAt for a team saved before manual reordering existed", () => {
    const stale = { ...createTeam("Ditto", "Team 1", REG_ID) } as unknown as Record<
      string,
      unknown
    >;
    delete stale.sortOrder;
    const normalized = normalizeTeam(stale as never);
    expect(normalized.sortOrder).toBe(new Date(normalized.updatedAt).getTime());
  });
});

describe("reorderTeams", () => {
  function teamWithOrder(id: string, sortOrder: number): Team {
    return { ...createTeam("Ditto", id, REG_ID), id, sortOrder };
  }

  it("redistributes sortOrder to match the new order, highest first", () => {
    const a = teamWithOrder("a", 30);
    const b = teamWithOrder("b", 20);
    const c = teamWithOrder("c", 10);
    const changed = reorderTeams([a, b, c], ["c", "a", "b"]);

    const byId = new Map(changed.map((team) => [team.id, team]));
    expect(byId.get("c")?.sortOrder).toBe(30);
    expect(byId.get("a")?.sortOrder).toBe(20);
    expect(byId.get("b")?.sortOrder).toBe(10);
  });

  it("only returns teams whose sortOrder actually changed", () => {
    const a = teamWithOrder("a", 30);
    const b = teamWithOrder("b", 20);
    const changed = reorderTeams([a, b], ["a", "b"]);
    expect(changed).toEqual([]);
  });

  it("never touches a team outside orderedIds, regardless of its sortOrder", () => {
    const a = teamWithOrder("a", 30);
    const b = teamWithOrder("b", 20);
    const otherRegulation = teamWithOrder("other", 25);
    const changed = reorderTeams([a, b, otherRegulation], ["b", "a"]);
    expect(changed.some((team) => team.id === "other")).toBe(false);
  });
});

describe("addRegulationTag", () => {
  it("appends a new regulation id", () => {
    const team = createTeam("Ditto", "Team 1", REG_ID);
    expect(addRegulationTag(team, OTHER_REG_ID).regulationIds).toEqual([REG_ID, OTHER_REG_ID]);
  });

  it("is a no-op if already tagged", () => {
    const team = createTeam("Ditto", "Team 1", REG_ID);
    expect(addRegulationTag(team, REG_ID)).toEqual(team);
  });
});

describe("removeRegulationTag", () => {
  it("removes a tag when more than one remains", () => {
    const team = addRegulationTag(createTeam("Ditto", "Team 1", REG_ID), OTHER_REG_ID);
    expect(removeRegulationTag(team, OTHER_REG_ID).regulationIds).toEqual([REG_ID]);
  });

  it("refuses to remove the last remaining tag", () => {
    const team = createTeam("Ditto", "Team 1", REG_ID);
    expect(removeRegulationTag(team, REG_ID)).toEqual(team);
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
