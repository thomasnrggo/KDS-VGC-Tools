import { describe, expect, it } from "vitest";
import {
  importSharedMatchups,
  opponentsToShare,
  sharedMatchupAsOpponent,
  sharedMatchupsAsOpponents,
  toSharedMatchup,
  toSharedTeam,
} from "./sharedTeam";
import { createTeam } from "./team";
import { createOpponent } from "./opponent";
import { EMPTY_PLAN } from "@/constants/matchupPlan";
import { REGULATIONS } from "@/data/regulations";
import type { MatchupPlan, Opponent, Team } from "@/types";

const PASTE = `Incineroar @ Sitrus Berry
Ability: Intimidate
EVs: 32 HP / 20 Def / 14 SpD
Impish Nature
- Fake Out
- Flare Blitz`;

const TEAM: Team = {
  ...createTeam(PASTE, "Chompy Z bascu", REGULATIONS[0].id),
  creator: " Anthos ",
  pokepasteUrl: "https://pokepast.es/abc",
  replicaCode: "ABC123",
  notes: "secret plan",
  overview: "<p>Sun with <strong>Mega Charizard Y</strong></p>",
};

describe("toSharedTeam", () => {
  it("keeps everything the report shows for a closed sheet", () => {
    const shared = toSharedTeam(TEAM, { sheet: "closed" }, "uid-1", "now");
    expect(shared).toMatchObject({
      id: TEAM.id,
      ownerUid: "uid-1",
      name: "Chompy Z bascu",
      creator: "Anthos",
      pokepasteUrl: "https://pokepast.es/abc",
      replicaCode: "ABC123",
      overview: "<p>Sun with <strong>Mega Charizard Y</strong></p>",
      sheet: "closed",
      updatedAt: "now",
    });
    expect(shared.pokemon[0]).toMatchObject({ evs: "32 HP / 20 Def / 14 SpD", nature: "Impish" });
  });

  it("drops Stat Points, nature and the Poképaste link for an open sheet", () => {
    const shared = toSharedTeam(TEAM, { sheet: "open" }, "uid-1");
    expect(shared.pokepasteUrl).toBeUndefined();
    expect(shared.replicaCode).toBe("ABC123");
    expect(shared.pokemon[0]).toEqual({
      species: "Incineroar",
      item: "Sitrus Berry",
      ability: "Intimidate",
      moves: ["Fake Out", "Flare Blitz"],
    });
  });

  it("leaves out an empty overview", () => {
    const shared = toSharedTeam({ ...TEAM, overview: "<p></p>" }, { sheet: "open" }, "uid-1");
    expect(shared.overview).toBeUndefined();
  });

  it("never includes the owner's notes", () => {
    expect(JSON.stringify(toSharedTeam(TEAM, { sheet: "closed" }, "uid-1"))).not.toContain(
      "secret plan",
    );
  });
});

const REG = REGULATIONS[0].id;
const OPP_PASTE = `Garchomp @ Choice Scarf
Ability: Rough Skin
- Earthquake

Rotom-Wash @ Sitrus Berry
Ability: Levitate
- Hydro Pump`;
const PLAN: MatchupPlan = { ...EMPTY_PLAN, leadPair: [0, null], notes: "<p>Lead Incin</p>" };

function opponent(label: string, plan?: MatchupPlan, paste = OPP_PASTE): Opponent {
  const base = createOpponent(label, paste, REG);
  return { ...base, plansByTeamId: plan ? { [TEAM.id]: plan } : {} };
}

describe("toSharedTeam sections", () => {
  const full: Team = {
    ...TEAM,
    combinations: [
      {
        id: "c1",
        leadPair: [0, null],
        backPair: [null, null],
        leadMega: [true, true],
        backMega: [true, true],
        notes: "",
      },
    ] as Team["combinations"],
    calcs: [{ id: "k1", text: "a vs. b: 10-20%", species: "incineroar", side: "offensive" }],
  };

  it("shares notes and combinations only with strategy, calcs only with calcs", () => {
    const none = toSharedTeam(full, { sheet: "closed" }, "uid-1");
    expect(none.notes).toBeUndefined();
    expect(none.combinations).toBeUndefined();
    expect(none.calcs).toBeUndefined();
    expect(none.sections).toEqual([]);

    const strategy = toSharedTeam(full, { sheet: "closed", sections: ["strategy"] }, "uid-1");
    expect(strategy.notes).toBe("secret plan");
    expect(strategy.combinations).toHaveLength(1);
    expect(strategy.calcs).toBeUndefined();

    const calcs = toSharedTeam(full, { sheet: "closed", sections: ["calcs", "matchups"] }, "uid-1");
    expect(calcs.calcs).toHaveLength(1);
    expect(calcs.notes).toBeUndefined();
    expect(calcs.sections).toEqual(["calcs", "matchups"]);
  });

  it("shares no sections with an open sheet", () => {
    const open = toSharedTeam(
      full,
      { sheet: "open", sections: ["strategy", "calcs", "matchups"] },
      "uid-1",
    );
    expect(open.sections).toEqual([]);
    expect(open.notes).toBeUndefined();
    expect(open.combinations).toBeUndefined();
    expect(open.calcs).toBeUndefined();
  });
});

describe("shared matchups", () => {
  it("publishes only prepped opponents in the team's regulations, once per team", () => {
    const prepped = opponent("Sand", PLAN);
    const copy = { ...opponent("Sand (group)", PLAN), id: "group-copy" };
    const unprepped = opponent(
      "Rain",
      undefined,
      "Pelipper @ Damp Rock\nAbility: Drizzle\n- Hurricane",
    );
    const otherReg = { ...opponent("Old", PLAN), regulationId: "not-a-regulation" };
    const shared = opponentsToShare(TEAM, [
      { source: { kind: "mine" }, opponents: [prepped, unprepped, otherReg] },
      { source: { kind: "group", id: "g", name: "G" }, opponents: [copy] },
    ]);
    expect(shared.map((o) => o.id)).toEqual([prepped.id]);
  });

  it("round-trips an opponent with only the shared team's plan", () => {
    const source = {
      ...opponent("Sand", PLAN),
      plansByTeamId: { [TEAM.id]: PLAN, other: EMPTY_PLAN },
    };
    const matchup = toSharedMatchup(source, TEAM.id, "now");
    expect(JSON.stringify(matchup)).not.toContain('"other"');
    const back = sharedMatchupAsOpponent(matchup, TEAM.id);
    expect(back.team.pokemon).toEqual(source.team.pokemon);
    expect(back.plansByTeamId[TEAM.id]).toMatchObject({
      leadPair: [0, null],
      notes: "<p>Lead Incin</p>",
    });
  });

  it("lists the same team once, in list order", () => {
    const a = toSharedMatchup({ ...opponent("A", PLAN), sortOrder: 1 }, TEAM.id);
    const b = toSharedMatchup(
      { ...opponent("B", PLAN, "Pelipper @ Damp Rock\n- Hurricane"), sortOrder: 5 },
      TEAM.id,
    );
    const aCopy = toSharedMatchup({ ...opponent("A copy", PLAN), sortOrder: 0 }, TEAM.id);
    const list = sharedMatchupsAsOpponents([a, aCopy, b], TEAM.id);
    expect(list.map((o) => o.label)).toEqual(["B", "A"]);
  });
});

describe("importSharedMatchups", () => {
  const shared = (label: string, paste = OPP_PASTE, extra: Partial<Opponent> = {}) =>
    sharedMatchupAsOpponent(
      toSharedMatchup(
        { ...opponent(label, undefined, paste), plansByTeamId: { "owner-team": PLAN }, ...extra },
        "owner-team",
      ),
      "owner-team",
    );

  it("adds new opponents with the plan filed under my new team", () => {
    const { added, updated } = importSharedMatchups({
      matchups: [shared("Sand")],
      teamId: "my-team",
      myOpponents: [],
    });
    expect(updated).toEqual([]);
    expect(added).toHaveLength(1);
    expect(added[0].label).toBe("Sand");
    expect(added[0].team.pokemon.map((m) => m.species)).toEqual(["Garchomp", "Rotom-Wash"]);
    expect(added[0].plansByTeamId["my-team"]).toMatchObject({ leadPair: [0, null] });
  });

  it("gives an opponent I already have the plan, without replacing one it has", () => {
    const mine = opponent("My sand");
    const planned = { ...opponent("Planned"), id: "p", plansByTeamId: { "my-team": EMPTY_PLAN } };
    const first = importSharedMatchups({
      matchups: [shared("Sand")],
      teamId: "my-team",
      myOpponents: [mine],
    });
    expect(first.added).toEqual([]);
    expect(first.updated[0].id).toBe(mine.id);
    expect(first.updated[0].plansByTeamId["my-team"]).toMatchObject({ leadPair: [0, null] });
    const second = importSharedMatchups({
      matchups: [shared("Sand")],
      teamId: "my-team",
      myOpponents: [planned],
    });
    expect(second.updated).toEqual([]);
    const replaced = importSharedMatchups({
      matchups: [shared("Sand")],
      teamId: "my-team",
      myOpponents: [planned],
      replacePlans: true,
    });
    expect(replaced.updated[0].plansByTeamId["my-team"]).toMatchObject({ leadPair: [0, null] });
  });

  it("keeps a variant with its main when both come along", () => {
    const main = shared("Main");
    const variant = shared("Variant", "Garchomp @ Life Orb\n- Earthquake", { variantOf: main.id });
    const orphan = shared("Orphan", "Pelipper @ Damp Rock\n- Hurricane", { variantOf: "missing" });
    const { added } = importSharedMatchups({
      matchups: [main, variant, orphan],
      teamId: "my-team",
      myOpponents: [],
    });
    expect(added[1].variantOf).toBe(added[0].id);
    expect(added[2].variantOf).toBeUndefined();
  });
});
