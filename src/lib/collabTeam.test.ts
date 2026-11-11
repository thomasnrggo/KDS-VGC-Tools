import { describe, expect, it } from "vitest";
import {
  collabDocToTeam,
  collabSubDocs,
  diffCollabTeam,
  hasCollabChanges,
  sharedPlansWithoutSlot,
  teamToCollabDoc,
} from "./collabTeam";
import { createTeam } from "./team";
import { EMPTY_PLAN } from "@/constants/matchupPlan";
import { REGULATIONS } from "@/data/regulations";
import type { Team, TeamCalc, TeamCombination } from "@/types";

const PASTE = `Incineroar @ Sitrus Berry
Ability: Intimidate
- Fake Out

Garchomp @ Choice Scarf
Ability: Rough Skin
- Earthquake

Rillaboom @ Miracle Seed
Ability: Grassy Surge
- Grassy Glide`;

const combo = (id: string, notes = ""): TeamCombination => ({
  id,
  leadPair: [0, 1],
  backPair: [2, null],
  leadMega: [true, true],
  backMega: [true, true],
  notes,
});
const calc = (id: string, text = "a vs. b: 10-20%"): TeamCalc => ({
  id,
  text,
  species: "incineroar",
  side: "offensive",
});

const TEAM: Team = {
  ...createTeam(PASTE, "Sun", REGULATIONS[0].id),
  notes: "<p>Lead Incin</p>",
  combinations: [combo("c1"), combo("c2")],
  calcs: [calc("k1"), calc("k2")],
  share: { sheet: "closed" },
  archivedAt: "2026-01-01",
};
const BY = { uid: "u1", name: "Rey" };
const NOW = "2026-11-11T10:00:00.000Z";

describe("collab team docs", () => {
  it("keeps per-member fields out of the shared doc", () => {
    const doc = teamToCollabDoc(TEAM, { groupId: "g1", ownerUid: "u1", by: BY, now: NOW });
    expect(doc).toMatchObject({ id: TEAM.id, name: "Sun", groupId: "g1", ownerUid: "u1" });
    for (const field of ["combinations", "calcs", "share", "sortOrder", "archivedAt", "collab"]) {
      expect(doc).not.toHaveProperty(field);
    }
  });

  it("round-trips through the docs, in list order, marked collaborative", () => {
    const doc = teamToCollabDoc(TEAM, { groupId: "g1", ownerUid: "u1", by: BY, now: NOW });
    const { combinations, calcs } = collabSubDocs(TEAM);
    const team = collabDocToTeam(doc, [...combinations].reverse(), [...calcs].reverse());
    expect(team.combinations?.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(team.calcs?.map((c) => c.id)).toEqual(["k1", "k2"]);
    expect(team.combinations?.[0]).not.toHaveProperty("sortOrder");
    expect(team.collab).toEqual({ groupId: "g1", ownerUid: "u1", updatedBy: BY });
    expect(team.sortOrder).toBe(new Date(NOW).getTime());
    expect(team).not.toHaveProperty("groupId");
    expect(team).not.toHaveProperty("updatedBy");
    expect(team.pokemon).toEqual(TEAM.pokemon);
  });
});

describe("diffCollabTeam", () => {
  it("writes only the fields that changed", () => {
    const changes = diffCollabTeam(TEAM, { ...TEAM, notes: "<p>Lead Chomp</p>" });
    expect(changes.fields).toEqual({ notes: "<p>Lead Chomp</p>" });
    expect(changes.combinations).toEqual({ put: [], remove: [] });
    expect(changes.calcs).toEqual({ put: [], remove: [] });
  });

  it("marks a cleared field", () => {
    const changes = diffCollabTeam(TEAM, { ...TEAM, notes: undefined });
    expect(changes.fields).toHaveProperty("notes", undefined);
  });

  it("ignores per-member fields", () => {
    const changes = diffCollabTeam(TEAM, {
      ...TEAM,
      sortOrder: 1,
      archivedAt: undefined,
      share: undefined,
      updatedAt: "later",
    });
    expect(hasCollabChanges(changes)).toBe(false);
  });

  it("adds, changes and removes combinations and calcs one doc at a time", () => {
    const changes = diffCollabTeam(TEAM, {
      ...TEAM,
      combinations: [combo("c1", "<p>vs Trick Room</p>"), combo("c2")],
      calcs: [calc("k1"), calc("k3")],
    });
    expect(changes.combinations.put.map((c) => c.id)).toEqual(["c1"]);
    expect(changes.combinations.remove).toEqual([]);
    expect(changes.calcs.put).toEqual([{ ...calc("k3"), sortOrder: 1 }]);
    expect(changes.calcs.remove).toEqual(["k2"]);
  });

  it("rewrites the positions of reordered docs", () => {
    const changes = diffCollabTeam(TEAM, { ...TEAM, combinations: [combo("c2"), combo("c1")] });
    expect(changes.combinations.put.map((c) => [c.id, c.sortOrder])).toEqual([
      ["c2", 0],
      ["c1", 1],
    ]);
  });
});

describe("sharedPlansWithoutSlot", () => {
  it("shifts the plans that pick past the removed Pokémon, and only those", () => {
    const moved = {
      opponentId: "o1",
      plan: { ...EMPTY_PLAN, leadPair: [0, 2] as [number, number] },
      updatedAt: "old",
    };
    const untouched = {
      opponentId: "o2",
      plan: { ...EMPTY_PLAN, leadPair: [0, null] as [number, null] },
      updatedAt: "old",
    };
    const changed = sharedPlansWithoutSlot([moved, untouched], 1, BY, NOW);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({
      opponentId: "o1",
      plan: { leadPair: [0, 1] },
      updatedBy: BY,
      updatedAt: NOW,
    });
  });
});
