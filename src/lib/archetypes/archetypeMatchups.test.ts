import { describe, expect, it } from "vitest";
import { archetypeMatchups, archetypeTotals, type MetaArchetypes } from ".";

const label = (key: string, teams: number, wins = 0, losses = 0) => ({
  key,
  teams,
  topCut: 0,
  wins,
  losses,
  ties: 0,
  byEvent: [teams],
});

const meta: MetaArchetypes = {
  version: 1,
  teams: 100,
  eventTeams: [100],
  labels: [
    label("balance-setup+tailwind", 40, 60, 40),
    label("balance-setup", 5, 4, 6),
    label("sun+tailwind", 30),
    label("rain", 25),
  ],
  matchups: [
    // From a's side; a ≤ b.
    { a: "balance-setup", b: "balance-setup+tailwind", wins: 3, losses: 2, ties: 0 },
    { a: "balance-setup+tailwind", b: "rain", wins: 14, losses: 6, ties: 0 },
    { a: "balance-setup+tailwind", b: "sun+tailwind", wins: 6, losses: 14, ties: 0 },
    { a: "balance-setup", b: "sun+tailwind", wins: 1, losses: 1, ties: 0 },
  ],
};

describe("archetypeMatchups", () => {
  it("uses the exact label when enough teams share it, grouping opponents by primary", () => {
    const report = archetypeMatchups(meta, "balance-setup+tailwind")!;
    expect(report).toMatchObject({ scope: "label", teams: 40, wins: 60, losses: 40 });
    expect(report.winRate).toBeCloseTo(0.6);
    // Read from b's side: wins and losses swap.
    expect(report.versus.find((v) => v.opponent === "balance-setup")).toMatchObject({
      wins: 2,
      losses: 3,
    });
    expect(report.hard.map((v) => v.opponent)).toEqual(["sun"]);
    expect(report.good.map((v) => v.opponent)).toEqual(["rain"]);
  });

  it("falls back to the primary archetype when the label has few teams", () => {
    const report = archetypeMatchups(meta, "balance-setup+trick-room")!;
    expect(report).toMatchObject({ scope: "primary", key: "balance-setup", teams: 45 });
    // Sun: 6-14 from the Tailwind label plus 1-1 from plain Balance setup.
    expect(report.versus.find((v) => v.opponent === "sun")).toMatchObject({
      wins: 7,
      losses: 15,
    });
    // Its own mirror isn't a hard or good matchup.
    expect(report.hard.concat(report.good).map((v) => v.opponent)).not.toContain("balance-setup");
  });

  it("widens a small plain-primary label to every team with that primary", () => {
    // "balance-setup" alone has 5 teams: all 45 Balance setup teams stand in.
    expect(archetypeMatchups(meta, "balance-setup")).toMatchObject({
      scope: "primary",
      teams: 45,
    });
  });

  it("returns null when nothing like the team was played", () => {
    expect(archetypeMatchups(meta, "perish-trap")).toBeNull();
  });
});

describe("archetypeTotals", () => {
  it("sums the labels it leads, and counts the ones it's second in", () => {
    expect(archetypeTotals(meta, "balance-setup")).toMatchObject({
      teams: 45,
      wins: 64,
      losses: 46,
      shareByEvent: [0.45],
    });
    expect(archetypeTotals(meta, "tailwind")).toMatchObject({ teams: 0, asSecond: 70 });
  });
});
