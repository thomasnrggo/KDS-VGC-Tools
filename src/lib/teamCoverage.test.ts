import { describe, expect, it } from "vitest";
import {
  analyzeTeamCoverage,
  coverageGaps,
  defensiveMultiplier,
  moveAttackTypes,
  weakSpots,
} from "./teamCoverage";
import type { ParsedPokemon } from "@/types";

// The owner's rain team (see PLANNING.md's "Team coverage").
const RAIN_TEAM: ParsedPokemon[] = [
  {
    species: "Raichu",
    item: "Raichunite X",
    ability: "Lightning Rod",
    moves: ["Thunderbolt", "Fake Out"],
  },
  { species: "Sneasler", ability: "Unburden", moves: ["Close Combat", "Dire Claw"] },
  {
    species: "Basculegion-F",
    item: "Focus Sash",
    ability: "Adaptability",
    moves: ["Wave Crash", "Ice Beam", "Shadow Ball"],
  },
  { species: "Pelipper", ability: "Drizzle", moves: ["Weather Ball", "Hurricane", "Protect"] },
  { species: "Archaludon", ability: "Stamina", moves: ["Electro Shot", "Draco Meteor"] },
  { species: "Golisopod", item: "Golisopite", moves: ["First Impression", "Liquidation"] },
];

function row<T extends { type: string }>(rows: T[], type: string): T {
  const found = rows.find((r) => r.type === type);
  if (!found) throw new Error(`no ${type} row`);
  return found;
}

describe("defensiveMultiplier", () => {
  it("multiplies the type chart across both types", () => {
    expect(defensiveMultiplier("Electric", ["Water", "Flying"]).multiplier).toBe(4);
    expect(defensiveMultiplier("Grass", ["Steel", "Dragon"]).multiplier).toBe(0.25);
    // Steel resists Dragon, Dragon is weak to it: they cancel out.
    expect(defensiveMultiplier("Dragon", ["Steel", "Dragon"]).multiplier).toBe(1);
    expect(defensiveMultiplier("Ground", ["Water", "Flying"])).toEqual({ multiplier: 0 });
  });

  it("applies ability immunities and names the ability", () => {
    expect(defensiveMultiplier("Ground", ["Steel", "Psychic"], "Levitate")).toEqual({
      multiplier: 0,
      reason: "Levitate",
    });
    expect(defensiveMultiplier("Water", ["Water", "Grass"], "Water Absorb").multiplier).toBe(0);
    // An immunity to a type that isn't attacking changes nothing.
    expect(defensiveMultiplier("Fire", ["Steel", "Psychic"], "Levitate")).toEqual({
      multiplier: 2,
    });
  });

  it("applies type-scoped ability modifiers but not conditional ones", () => {
    expect(defensiveMultiplier("Fire", ["Grass"], "Thick Fat")).toEqual({
      multiplier: 1,
      reason: "Thick Fat",
    });
    expect(defensiveMultiplier("Fire", ["Fairy"], "Fluffy").multiplier).toBe(2);
    expect(defensiveMultiplier("Ghost", ["Rock"], "Purifying Salt").multiplier).toBe(0.5);
    // Multiscale depends on HP, Filter on the hit being super effective: not type coverage.
    expect(defensiveMultiplier("Ice", ["Dragon", "Flying"], "Multiscale")).toEqual({
      multiplier: 4,
    });
    expect(defensiveMultiplier("Fire", ["Steel"], "Filter")).toEqual({ multiplier: 2 });
  });

  it("handles Air Balloon and Wonder Guard", () => {
    expect(defensiveMultiplier("Ground", ["Fire", "Steel"], undefined, "Air Balloon")).toEqual({
      multiplier: 0,
      reason: "Air Balloon",
    });
    expect(defensiveMultiplier("Water", ["Bug", "Ghost"], "Wonder Guard").multiplier).toBe(0);
    expect(defensiveMultiplier("Fire", ["Bug", "Ghost"], "Wonder Guard").multiplier).toBe(2);
  });
});

describe("moveAttackTypes", () => {
  it("leaves out Status and typeless-damage moves", () => {
    expect(moveAttackTypes("Protect", undefined, [])).toEqual([]);
    expect(moveAttackTypes("Seismic Toss", undefined, [])).toEqual([]);
    expect(moveAttackTypes("Super Fang", undefined, [])).toEqual([]);
    expect(moveAttackTypes("Low Kick", undefined, [])).toEqual(["Fighting"]);
  });

  it("follows Weather Ball's team weather, -ate abilities and Liquid Voice", () => {
    expect(moveAttackTypes("Weather Ball", undefined, [])).toEqual(["Normal"]);
    expect(moveAttackTypes("Weather Ball", undefined, ["Rain"])).toEqual(["Water"]);
    expect(moveAttackTypes("Weather Ball", undefined, ["Sun", "Snow"])).toEqual(["Fire", "Ice"]);
    expect(moveAttackTypes("Hyper Voice", "Pixilate", [])).toEqual(["Fairy"]);
    expect(moveAttackTypes("Hyper Voice", "Liquid Voice", [])).toEqual(["Water"]);
    expect(moveAttackTypes("Thunderbolt", "Pixilate", [])).toEqual(["Electric"]);
  });
});

describe("analyzeTeamCoverage", () => {
  const coverage = analyzeTeamCoverage(RAIN_TEAM);

  it("resolves Mega and form typings from the held stone and species", () => {
    // Mega Golisopod is Bug/Steel: Fire 4×. Basculegion-F is Water/Ghost: Fighting 0×.
    expect(row(coverage.defense, "Fire").cells[5].multiplier).toBe(4);
    expect(row(coverage.defense, "Fighting").cells[2].multiplier).toBe(0);
  });

  it("counts weak, resist (immunities included) and net per type", () => {
    const ground = row(coverage.defense, "Ground");
    // Raichu, Sneasler, Archaludon weak; Pelipper immune; Golisopod neutral; Basculegion neutral.
    expect(ground.weak).toBe(3);
    expect(ground.resist).toBe(1);
    expect(ground.net).toBe(-2);
  });

  it("finds the team's weak spots, worst first", () => {
    // Ghost: Basculegion weak and nothing resists it.
    expect(weakSpots(coverage).map((r) => r.type)).toEqual(["Ground", "Ghost"]);
    // Electric balances out: Pelipper (4×) and Basculegion weak, Raichu and Archaludon resist.
    expect(row(coverage.defense, "Electric")).toMatchObject({ weak: 2, resist: 2, net: 0 });
  });

  it("measures offense from the members' own moves", () => {
    // Basculegion's Ice Beam is the team's answer to Dragon (with Draco Meteor).
    const dragon = row(coverage.offense, "Dragon");
    expect(dragon.best[2]).toBe(2);
    expect(dragon.best[4]).toBe(2);
    expect(dragon.bestMoves[2]).toBe("Ice Beam");
    expect(dragon.bestMoves[4]).toBe("Draco Meteor");
    // Pelipper's Weather Ball is Water in its own rain: super effective on Fire.
    expect(row(coverage.offense, "Fire").best[3]).toBe(2);
    expect(coverage.hasMoves).toBe(true);
  });

  it("applies move exceptions: Freeze-Dry, Flying Press, Scrappy", () => {
    const special = analyzeTeamCoverage([
      { species: "Lapras", moves: ["Freeze-Dry"] },
      { species: "Hawlucha", moves: ["Flying Press"] },
      { species: "Kangaskhan", ability: "Scrappy", moves: ["Double-Edge"] },
    ]);
    expect(row(special.offense, "Water").best[0]).toBe(2);
    // Fighting + Flying vs. Grass: 1 × 2.
    expect(row(special.offense, "Grass").best[1]).toBe(2);
    expect(row(special.offense, "Ghost").best[2]).toBe(1);
  });

  it("reports no gaps (and no offense) for a team without moves", () => {
    const bare = analyzeTeamCoverage([{ species: "Pelipper" }]);
    expect(bare.hasMoves).toBe(false);
    expect(row(bare.offense, "Fire").best).toEqual([null]);
    expect(coverageGaps(bare)).toEqual([]);
  });

  it("lists types nothing hits super effectively", () => {
    const gaps = coverageGaps(analyzeTeamCoverage([{ species: "Pelipper", moves: ["Hurricane"] }]));
    expect(gaps.map((r) => r.type)).toContain("Steel");
    expect(gaps.map((r) => r.type)).not.toContain("Grass");
  });
});
