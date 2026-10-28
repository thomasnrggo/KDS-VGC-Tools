import { describe, expect, it } from "vitest";
import { EMPTY_PLAN } from "@/constants";
import { buildMatchupRows, sameTeamKey } from "./matchupList";
import type { Opponent, Team } from "@/types";

const team = { id: "t1", regulationIds: ["reg-m-c"], pokemon: [] } as unknown as Team;

function opponent(
  id: string,
  species: string[],
  planned: boolean,
  regulationId = "reg-m-c",
): Opponent {
  return {
    id,
    label: id,
    regulationId,
    tags: [],
    sortOrder: 0,
    team: { pokemon: species.map((s) => ({ species: s, item: "Leftovers" })) },
    plansByTeamId: planned ? { t1: { ...EMPTY_PLAN, notes: "<p>go</p>" } } : {},
    createdAt: "",
    updatedAt: "",
  } as unknown as Opponent;
}

describe("sameTeamKey", () => {
  it("ignores order and ids", () => {
    expect(sameTeamKey(opponent("a", ["Garchomp", "Incineroar"], false))).toBe(
      sameTeamKey(opponent("b", ["Incineroar", "Garchomp"], false)),
    );
    expect(sameTeamKey(opponent("a", ["Garchomp"], false))).not.toBe(
      sameTeamKey(opponent("a", ["Garchomp"], false, "reg-other")),
    );
  });
});

describe("buildMatchupRows", () => {
  const group = { kind: "group" as const, id: "g1", name: "Regional" };

  it("lists prepped opponents from your list and groups, skipping other regulations", () => {
    const rows = buildMatchupRows(team, [
      {
        source: { kind: "mine" },
        opponents: [opponent("m1", ["Pelipper"], true), opponent("m2", ["Kyogre"], false)],
      },
      {
        source: group,
        opponents: [opponent("g1", ["Charizard"], true), opponent("g2", ["Zacian"], true, "reg-x")],
      },
    ]);
    expect(rows.map((row) => row.primary.opponent.id)).toEqual(["m1", "g1"]);
  });

  it("merges the same team across lists into one row, opening the prepped copy", () => {
    const rows = buildMatchupRows(team, [
      { source: { kind: "mine" }, opponents: [opponent("mine", ["Charizard", "Venusaur"], false)] },
      { source: group, opponents: [opponent("theirs", ["Venusaur", "Charizard"], true)] },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].primary.opponent.id).toBe("theirs");
    expect(rows[0].copies.map((copy) => copy.opponent.id)).toEqual(["theirs", "mine"]);
  });
});
