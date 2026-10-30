import { describe, expect, it } from "vitest";
import { statBarWidth } from "./statBarColor";

describe("statBarWidth", () => {
  it("runs from 20 (a sliver) to 200 (full)", () => {
    expect(statBarWidth(20)).toBe(3);
    expect(statBarWidth(110)).toBe(50);
    expect(statBarWidth(200)).toBe(100);
  });

  it("clamps stats outside the scale", () => {
    expect(statBarWidth(1)).toBe(3);
    expect(statBarWidth(255)).toBe(100);
  });
});
