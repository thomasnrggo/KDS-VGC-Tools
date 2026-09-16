import { describe, expect, it } from "vitest";
import { estimateOpponentSpeedRange } from "./estimateOpponentSpeedRange";

// Ditto: baseSpe 48 — cross-checked against computeSpeedTiers.test.ts's fixture
// (minSpeed 61, maxSpeed 110 for the unknown-nature/no-item case), so these two
// calculations are guaranteed to agree.
describe("estimateOpponentSpeedRange", () => {
  it("falls back to the full min/max swing when nature is unknown", () => {
    expect(estimateOpponentSpeedRange({ species: "Ditto" })).toEqual({ min: 61, max: 110 });
  });

  it("assumes max Speed investment when a Speed-boosting nature is known", () => {
    expect(estimateOpponentSpeedRange({ species: "Ditto", nature: "Jolly" })).toEqual({
      min: 110,
      max: 110,
    });
  });

  it("assumes zero Speed investment when a Speed-lowering nature is known", () => {
    expect(estimateOpponentSpeedRange({ species: "Ditto", nature: "Brave" })).toEqual({
      min: 61,
      max: 61,
    });
  });

  it("still returns a range when the known nature is Speed-neutral", () => {
    expect(estimateOpponentSpeedRange({ species: "Ditto", nature: "Hardy" })).toEqual({
      min: 68,
      max: 100,
    });
  });

  it("applies a known item (Choice Scarf) to the unknown-nature range", () => {
    expect(estimateOpponentSpeedRange({ species: "Ditto", item: "Choice Scarf" })).toEqual({
      min: 91,
      max: 165,
    });
  });

  it("applies a known item on top of the max-Speed assumption", () => {
    expect(
      estimateOpponentSpeedRange({ species: "Ditto", nature: "Jolly", item: "Choice Scarf" }),
    ).toEqual({ min: 165, max: 165 });
  });
});
