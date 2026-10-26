import { describe, expect, it } from "vitest";
import { hasStatPoints } from "./hasStatPoints";

describe("hasStatPoints", () => {
  it("is false without an EVs line", () => {
    expect(hasStatPoints({ species: "Garchomp" })).toBe(false);
  });

  it("is false when every stat is 0", () => {
    expect(hasStatPoints({ species: "Garchomp", evs: "0 HP / 0 Atk" })).toBe(false);
  });

  it("is true with any Stat Points", () => {
    expect(hasStatPoints({ species: "Garchomp", evs: "32 Atk / 2 HP / 32 Spe" })).toBe(true);
  });
});
