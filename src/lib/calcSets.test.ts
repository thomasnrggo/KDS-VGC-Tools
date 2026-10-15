import { describe, expect, it } from "vitest";
import { findSameNameSet } from "./calcSets";
import type { CalcSet } from "@/types";

const scarf: CalcSet = {
  id: "1",
  name: "Choice Scarf",
  pokemon: { species: "Basculegion", item: "Choice Scarf" },
  updatedAt: "2026-10-15T00:00:00.000Z",
};

describe("findSameNameSet", () => {
  it("matches the same species and name, ignoring case and spaces", () => {
    expect(findSameNameSet([scarf], { species: "Basculegion" }, "  choice scarf ")).toBe(scarf);
  });

  it("doesn't match another species with the same set name", () => {
    expect(findSameNameSet([scarf], { species: "Venusaur" }, "Choice Scarf")).toBeUndefined();
  });

  it("doesn't match a different name", () => {
    expect(findSameNameSet([scarf], { species: "Basculegion" }, "Life Orb")).toBeUndefined();
  });
});
