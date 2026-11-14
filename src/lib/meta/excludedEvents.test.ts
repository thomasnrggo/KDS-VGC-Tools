import { describe, expect, it } from "vitest";
import { summaryNeedsRebuild } from "./excludedEvents";

describe("summaryNeedsRebuild", () => {
  it("is false when the summary has exactly the included events", () => {
    expect(summaryNeedsRebuild(["a", "b"], ["b", "a"])).toBe(false);
  });

  it("is true when the summary still lists an excluded event", () => {
    expect(summaryNeedsRebuild(["a", "b"], ["a"])).toBe(true);
  });

  it("is true when an event was included again", () => {
    expect(summaryNeedsRebuild(["a"], ["a", "b"])).toBe(true);
  });
});
