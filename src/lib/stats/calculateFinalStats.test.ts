import { describe, expect, it } from "vitest";
import { calculateFinalStats } from "./calculateFinalStats";

describe("calculateFinalStats", () => {
  it("computes Level 50 stats for a Jolly Garchomp with a Stat Points spread", () => {
    // Base: 108/130/95/80/85/102 (matches pokemondb-style reference). Jolly = +Spe, -SpA.
    // 32 Atk / 2 Def / 32 Spe = 66 total Stat Points, the Champions cap.
    const result = calculateFinalStats({
      species: "Garchomp",
      nature: "Jolly",
      evs: "32 Atk / 2 Def / 32 Spe",
    });

    expect(result).toEqual({
      hp: 183,
      atk: 182,
      def: 117,
      spa: 90,
      spd: 105,
      spe: 169,
      increasedStat: "spe",
      decreasedStat: "spa",
      speedBoostedByChoiceScarf: false,
    });
  });

  it("defaults missing EVs (Stat Points) to 0; IVs are always 31 (Champions has no IVs)", () => {
    const result = calculateFinalStats({ species: "Garchomp", nature: "Hardy" });
    // Hardy is neutral, so no nature multiplier.
    expect(result).toEqual({
      hp: 183,
      atk: 150,
      def: 115,
      spa: 100,
      spd: 105,
      spe: 122,
      increasedStat: undefined,
      decreasedStat: undefined,
      speedBoostedByChoiceScarf: false,
    });
  });

  it("treats the EVs line as Stat Points (1 SP = 8 EV), not classic 0-252 EVs", () => {
    const zeroSp = calculateFinalStats({ species: "Garchomp", nature: "Hardy", evs: "0 Spe" });
    const oneSp = calculateFinalStats({ species: "Garchomp", nature: "Hardy", evs: "1 Spe" });
    const maxSp = calculateFinalStats({ species: "Garchomp", nature: "Hardy", evs: "32 Spe" });
    // 1 SP = 8 EV, and floor(ev/4) only changes every 4 EV, i.e. every 0.5 SP —
    // so going from 0 to 1 SP should already move the stat, unlike classic EVs
    // where 1-3 EV are wasted between /4 breakpoints.
    expect(oneSp?.spe).toBeGreaterThan(zeroSp!.spe);
    expect(maxSp?.spe).toBeGreaterThan(oneSp!.spe);
  });

  it("folds a held Choice Scarf's ×1.5 into Speed and flags it, applied after nature", () => {
    const unscarfed = calculateFinalStats({ species: "Garchomp", nature: "Jolly", evs: "32 Spe" });
    const scarfed = calculateFinalStats({
      species: "Garchomp",
      item: "Choice Scarf",
      nature: "Jolly",
      evs: "32 Spe",
    });
    expect(unscarfed?.speedBoostedByChoiceScarf).toBe(false);
    expect(scarfed?.speedBoostedByChoiceScarf).toBe(true);
    expect(scarfed?.spe).toBe(Math.floor(unscarfed!.spe * 1.5));
    // Only Speed changes — Choice Scarf isn't Choice Band/Specs.
    expect(scarfed?.atk).toBe(unscarfed?.atk);
  });

  it("resolves the Mega form's (different) base stats when holding the matching Mega Stone", () => {
    const base = calculateFinalStats({ species: "Charizard", nature: "Hardy" });
    const mega = calculateFinalStats({
      species: "Charizard",
      item: "Charizardite X",
      nature: "Hardy",
    });
    expect(mega?.atk).not.toBe(base?.atk);
  });

  it("returns null for a species not in the base-stats table", () => {
    expect(calculateFinalStats({ species: "Not-A-Real-Pokemon" })).toBeNull();
  });
});
