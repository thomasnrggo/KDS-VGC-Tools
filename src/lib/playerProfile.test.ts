import { describe, expect, it } from "vitest";
import {
  EMPTY_PLAYER_PROFILE,
  isEmptyPlayerProfile,
  normalizePlayerProfile,
  samePlayerProfile,
} from "./playerProfile";

describe("normalizePlayerProfile", () => {
  it("keeps known fields and drops anything else", () => {
    expect(
      normalizePlayerProfile({
        playerName: "Ash",
        division: "masters",
        battleTeam: "3 / Rain",
        playerId: 1234,
        extra: true,
      }),
    ).toEqual({ ...EMPTY_PLAYER_PROFILE, playerName: "Ash", division: "masters" });
  });

  it("ignores an unknown division and garbage input", () => {
    expect(normalizePlayerProfile({ division: "legends" }).division).toBeNull();
    expect(normalizePlayerProfile(null)).toEqual(EMPTY_PLAYER_PROFILE);
    expect(normalizePlayerProfile("nope")).toEqual(EMPTY_PLAYER_PROFILE);
  });
});

describe("isEmptyPlayerProfile / samePlayerProfile", () => {
  it("treats whitespace-only as empty and compares every field", () => {
    expect(isEmptyPlayerProfile({ ...EMPTY_PLAYER_PROFILE, playerName: "  " })).toBe(true);
    expect(isEmptyPlayerProfile({ ...EMPTY_PLAYER_PROFILE, division: "juniors" })).toBe(false);
    expect(samePlayerProfile(EMPTY_PLAYER_PROFILE, { ...EMPTY_PLAYER_PROFILE })).toBe(true);
    expect(
      samePlayerProfile(EMPTY_PLAYER_PROFILE, { ...EMPTY_PLAYER_PROFILE, birthDate: "2000-01-31" }),
    ).toBe(false);
  });
});
