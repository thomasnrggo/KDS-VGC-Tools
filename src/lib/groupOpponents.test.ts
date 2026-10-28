import { describe, expect, it } from "vitest";
import {
  canRemoveGroupOpponent,
  copyOpponent,
  copyOpponentsInto,
  groupPlanId,
  mergeGroupOpponent,
  planChanged,
  sharedChanged,
  splitGroupOpponent,
} from "./groupOpponents";
import { createOpponent } from "./opponent";
import { EMPTY_PLAN } from "@/constants";
import { REGULATIONS } from "@/data/regulations";
import type { Opponent, PrepGroup } from "@/types";

const OPPONENT: Opponent = {
  ...createOpponent("Sun", "Charizard @ Charizardite Y", REGULATIONS[0].id),
  plansByTeamId: { "team-1": { ...EMPTY_PLAN, notes: "lead fake out" } },
  copiedPlanFrom: { "team-1": "main-id" },
  addedBy: "uid-a",
  addedByName: "Anthos",
};

const GROUP = { ownerUid: "uid-owner" } as PrepGroup;

describe("splitGroupOpponent / mergeGroupOpponent", () => {
  it("keeps plans out of the shared copy and round-trips", () => {
    const { shared, plan } = splitGroupOpponent(OPPONENT, "g1");
    expect(shared).not.toHaveProperty("plansByTeamId");
    expect(shared).not.toHaveProperty("copiedPlanFrom");
    expect(JSON.stringify(shared)).not.toContain("lead fake out");
    expect(plan).toMatchObject({
      id: groupPlanId("g1", OPPONENT.id),
      groupId: "g1",
      opponentId: OPPONENT.id,
    });
    expect(mergeGroupOpponent(shared, plan)).toEqual(OPPONENT);
  });

  it("gives an opponent without your plan doc empty plans", () => {
    const { shared } = splitGroupOpponent(OPPONENT, "g1");
    expect(mergeGroupOpponent(shared, undefined).plansByTeamId).toEqual({});
  });
});

describe("planChanged / sharedChanged", () => {
  it("tells a notes edit from a tags edit", () => {
    const notes = { ...OPPONENT, plansByTeamId: { "team-1": { ...EMPTY_PLAN, notes: "x" } } };
    const tags = { ...OPPONENT, tags: ["sun"] };
    expect(planChanged(OPPONENT, notes)).toBe(true);
    expect(sharedChanged(OPPONENT, notes, "g1")).toBe(false);
    expect(planChanged(OPPONENT, tags)).toBe(false);
    expect(sharedChanged(OPPONENT, tags, "g1")).toBe(true);
  });
});

describe("canRemoveGroupOpponent", () => {
  it("lets the adder and the owner remove it, nobody else", () => {
    expect(canRemoveGroupOpponent(OPPONENT, GROUP, "uid-a")).toBe(true);
    expect(canRemoveGroupOpponent(OPPONENT, GROUP, "uid-owner")).toBe(true);
    expect(canRemoveGroupOpponent(OPPONENT, GROUP, "uid-b")).toBe(false);
    expect(canRemoveGroupOpponent(OPPONENT, GROUP, null)).toBe(false);
  });
});

describe("copyOpponent", () => {
  it("makes a standalone copy with your plans, credited when it's for a group", () => {
    const copy = copyOpponent({ ...OPPONENT, variantOf: "main" }, "new-id", {
      uid: "me",
      name: "Me",
    });
    expect(copy).toMatchObject({
      id: "new-id",
      addedBy: "me",
      addedByName: "Me",
      plansByTeamId: OPPONENT.plansByTeamId,
    });
    expect(copy.variantOf).toBeUndefined();
    expect(copy.copiedPlanFrom).toBeUndefined();
    expect(copyOpponent(OPPONENT, "x").addedBy).toBeUndefined();
  });
});

describe("copyOpponentsInto", () => {
  it("keeps the order above the target list, plans, and variant links copied together", () => {
    const main = { ...OPPONENT, id: "main", sortOrder: 9 };
    const variant = { ...OPPONENT, id: "variant", variantOf: "main", sortOrder: 8 };
    const loneVariant = { ...OPPONENT, id: "lone", variantOf: "elsewhere", sortOrder: 7 };
    const target = [{ ...OPPONENT, id: "t", sortOrder: 3 }];
    let next = 0;
    const copies = copyOpponentsInto([main, variant, loneVariant], target, () => `new-${next++}`, {
      uid: "uid-b",
    });
    expect(copies.map((copy) => copy.id)).toEqual(["new-0", "new-1", "new-2"]);
    expect(copies.map((copy) => copy.sortOrder)).toEqual([7, 6, 5]);
    expect(copies[1].variantOf).toBe("new-0");
    expect(copies[2].variantOf).toBeUndefined();
    expect(copies[0].plansByTeamId).toEqual(OPPONENT.plansByTeamId);
    expect(copies.every((copy) => copy.addedBy === "uid-b")).toBe(true);
  });
});
