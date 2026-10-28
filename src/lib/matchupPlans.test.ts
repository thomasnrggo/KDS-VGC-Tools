import { describe, expect, it } from "vitest";
import { EMPTY_PLAN } from "@/constants";
import {
  addPlan,
  hasMatchupPrep,
  listPlans,
  movePlan,
  notesToHtml,
  planLetter,
  removePlan,
  theirPicksSummary,
  updatePlanAt,
} from "./matchupPlans";

const base = { ...EMPTY_PLAN, leadPair: [0, 1] as [number, number], notes: "A notes" };

describe("matchup plans", () => {
  it("reads an existing single plan as Plan A", () => {
    const plans = listPlans(base);
    expect(plans).toHaveLength(1);
    expect(plans[0].leadPair).toEqual([0, 1]);
    expect(plans[0].notes).toBe("A notes");
  });

  it("adds plans after Plan A and keeps Plan A in the own fields", () => {
    const two = addPlan(base);
    expect(listPlans(two)).toHaveLength(2);
    expect(two.leadPair).toEqual([0, 1]);
    expect(two.morePlans).toHaveLength(1);
  });

  it("moving Plan B up makes it Plan A, and ids follow the plans", () => {
    let matchup = addPlan(base);
    matchup = updatePlanAt(matchup, 1, (plan) => ({ ...plan, notes: "B notes", leadPair: [2, 3] }));
    const [a, b] = listPlans(matchup);
    const swapped = movePlan(matchup, 1, -1);
    expect(swapped.notes).toBe("B notes");
    expect(swapped.leadPair).toEqual([2, 3]);
    expect(listPlans(swapped).map((plan) => plan.id)).toEqual([b.id, a.id]);
    expect(movePlan(swapped, 0, -1)).toBe(swapped);
  });

  it("removing a plan keeps the rest; the last one left is cleared instead", () => {
    const two = updatePlanAt(addPlan(base), 1, (plan) => ({ ...plan, notes: "B notes" }));
    const onlyB = removePlan(two, 0);
    expect(listPlans(onlyB)).toHaveLength(1);
    expect(onlyB.notes).toBe("B notes");
    const cleared = removePlan(onlyB, 0);
    expect(listPlans(cleared)).toHaveLength(1);
    expect(cleared.notes).toBe("");
    expect(cleared.leadPair).toEqual([null, null]);
  });

  it("stores the opponent's expected picks per plan", () => {
    const withTheirs = updatePlanAt(base, 0, (plan) => ({
      ...plan,
      theirs: {
        leadPair: [4, 5],
        backPair: [null, null],
        leadMega: [true, true],
        backMega: [true, true],
      },
    }));
    expect(withTheirs.theirs?.leadPair).toEqual([4, 5]);
  });

  it("letters plans and turns old plain-text notes into paragraphs", () => {
    expect([0, 1, 25, 26].map(planLetter)).toEqual(["A", "B", "Z", "27"]);
    expect(notesToHtml("Lead <Raichu>\nthen pivot")).toBe(
      "<p>Lead &lt;Raichu&gt;</p><p>then pivot</p>",
    );
    expect(notesToHtml("<p><strong>bold</strong></p>")).toBe("<p><strong>bold</strong></p>");
    expect(notesToHtml("")).toBe("");
  });
});

describe("theirPicksSummary", () => {
  const team = ["Garchomp", "Farigiraf", "Charizard", "Venusaur"].map((species) => ({ species }));
  const name = (species: string) => species;

  it("joins each pair with a dash and lead & back with an ampersand", () => {
    const picks = {
      ...EMPTY_PLAN,
      leadPair: [0, 1] as [number, number],
      backPair: [2, 3] as [number, number],
    };
    expect(theirPicksSummary(picks, team, name)).toBe(
      "Garchomp - Farigiraf & Charizard - Venusaur",
    );
  });

  it("skips empty slots and is empty with no picks", () => {
    const picks = { ...EMPTY_PLAN, leadPair: [0, null] as [number, null] };
    expect(theirPicksSummary(picks, team, name)).toBe("Garchomp");
    expect(theirPicksSummary(undefined, team, name)).toBe("");
    expect(theirPicksSummary(EMPTY_PLAN, team, name)).toBe("");
  });
});

describe("hasMatchupPrep", () => {
  it("counts picks, game plans, extra plans and report notes — not an empty plan", () => {
    expect(hasMatchupPrep(EMPTY_PLAN)).toBe(false);
    expect(hasMatchupPrep({ ...EMPTY_PLAN, notes: "<p></p>", scoutingNotes: " " })).toBe(false);
    expect(hasMatchupPrep({ ...EMPTY_PLAN, leadPair: [0, null] })).toBe(true);
    expect(hasMatchupPrep({ ...EMPTY_PLAN, notes: "<p>Fake Out first</p>" })).toBe(true);
    expect(hasMatchupPrep({ ...EMPTY_PLAN, pokemonNotes: { 2: "Scarf" } })).toBe(true);
    expect(hasMatchupPrep(addPlan(EMPTY_PLAN))).toBe(false);
    const planB = updatePlanAt(addPlan(EMPTY_PLAN), 1, (plan) => ({ ...plan, notes: "B" }));
    expect(hasMatchupPrep(planB)).toBe(true);
  });
});
