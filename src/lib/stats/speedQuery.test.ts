import { describe, expect, it } from "vitest";
import { matchesSpeedQuery, parseSpeedQuery, speedQueryTier } from "./speedQuery";

describe("parseSpeedQuery", () => {
  it("parses a plain integer", () => {
    expect(parseSpeedQuery("150")).toBe(150);
  });

  it("parses an integer with surrounding whitespace", () => {
    expect(parseSpeedQuery("  150  ")).toBe(150);
  });

  it("returns null for a name query", () => {
    expect(parseSpeedQuery("Talonflame")).toBeNull();
  });

  it("returns null for a mixed query", () => {
    expect(parseSpeedQuery("150 scarf")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(parseSpeedQuery("")).toBeNull();
  });

  it("returns null for a negative number", () => {
    expect(parseSpeedQuery("-5")).toBeNull();
  });
});

describe("matchesSpeedQuery", () => {
  it("matches the exact target", () => {
    expect(matchesSpeedQuery(150, 150)).toBe(true);
  });

  it("matches within the tolerance band", () => {
    expect(matchesSpeedQuery(145, 150)).toBe(true);
    expect(matchesSpeedQuery(155, 150)).toBe(true);
  });

  it("rejects values just outside the tolerance band", () => {
    expect(matchesSpeedQuery(144, 150)).toBe(false);
    expect(matchesSpeedQuery(156, 150)).toBe(false);
  });
});

describe("speedQueryTier", () => {
  it("classifies an equal value as exact", () => {
    expect(speedQueryTier(150, 150)).toBe("exact");
  });

  it("classifies a greater value as higher", () => {
    expect(speedQueryTier(155, 150)).toBe("higher");
  });

  it("classifies a smaller value as lower", () => {
    expect(speedQueryTier(145, 150)).toBe("lower");
  });
});
