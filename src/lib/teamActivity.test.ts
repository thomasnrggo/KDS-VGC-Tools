import { describe, expect, it } from "vitest";
import { diffCollabTeam } from "./collabTeam";
import {
  activityFromTeamChanges,
  continuesActivity,
  isEmptyActivity,
  mergeActivity,
  newActivity,
  planActivity,
  rosterActivity,
} from "./teamActivity";
import { parseTeam } from "./parseTeam";
import { createTeam } from "./team";
import { EMPTY_PLAN } from "@/constants/matchupPlan";
import { REGULATIONS } from "@/data/regulations";
import type { Team, TeamCalc } from "@/types";

const TEAM: Team = {
  ...createTeam("Incineroar @ Sitrus Berry\n- Fake Out", "Sun", REGULATIONS[0].id),
  notes: "<p>old</p>",
  calcs: [
    { id: "k1", text: "a vs. b: 1%", species: "incineroar", side: "offensive" },
    { id: "k2", text: "c vs. d: 2%", species: "incineroar", side: "defensive" },
  ],
};
const calc = (id: string, text: string): TeamCalc => ({
  id,
  text,
  species: "incineroar",
  side: "offensive",
});
const REY = { uid: "rey", name: "Rey" };
const T0 = "2026-11-11T10:00:00.000Z";

describe("activityFromTeamChanges", () => {
  it("names the fields that changed, keeping what they were", () => {
    const after = { ...TEAM, notes: "<p>new</p>", name: "Sun v2" };
    const [draft] = activityFromTeamChanges(TEAM, diffCollabTeam(TEAM, after));
    expect(draft.change).toEqual({
      kind: "fields",
      fields: ["name", "notes"],
      name: { from: "Sun", to: "Sun v2" },
    });
    expect(draft.undo?.fields).toEqual({ name: "Sun", notes: "<p>old</p>" });
  });

  it("calls a paste change a roster change", () => {
    const after = { ...TEAM, pokemon: [], rawPaste: "" };
    const [draft] = activityFromTeamChanges(TEAM, diffCollabTeam(TEAM, after));
    expect(draft.change).toMatchObject({ kind: "fields", fields: ["pokemon"] });
  });

  it("counts calcs added, changed and removed, keeping the replaced ones", () => {
    const after = { ...TEAM, calcs: [calc("k1", "a vs. b: 9%"), calc("k3", "new")] };
    const [draft] = activityFromTeamChanges(TEAM, diffCollabTeam(TEAM, after));
    expect(draft.change).toMatchObject({ kind: "calcs", added: 1, changed: 1, removed: 1 });
    expect(draft.undo?.calcs?.map((c) => c.id)).toEqual(["k1", "k2"]);
    expect(draft.undo?.calcs?.[0].text).toBe("a vs. b: 1%");
  });
});

describe("merging activity", () => {
  const entry = newActivity(
    "e1",
    activityFromTeamChanges(TEAM, diffCollabTeam(TEAM, { ...TEAM, notes: "<p>a</p>" }))[0],
    REY,
    T0,
  );

  it("continues the same person's edit of the same thing within minutes", () => {
    const draft = { change: { kind: "fields" as const, fields: ["overview"] } };
    expect(continuesActivity(entry, draft, "rey", "2026-11-11T10:05:00.000Z")).toBe(true);
    expect(continuesActivity(entry, draft, "ana", "2026-11-11T10:05:00.000Z")).toBe(false);
    expect(continuesActivity(entry, draft, "rey", "2026-11-11T10:30:00.000Z")).toBe(false);
    expect(
      continuesActivity(entry, planActivity("o1", "Sand", undefined, EMPTY_PLAN), "rey", T0),
    ).toBe(false);
  });

  it("never merges membership events", () => {
    const joined = newActivity("e2", { change: { kind: "joined" } }, REY, T0);
    expect(continuesActivity(joined, { change: { kind: "joined" } }, "rey", T0)).toBe(false);
  });

  it("keeps the earliest value of each field and the union of what changed", () => {
    const merged = mergeActivity(
      entry,
      {
        change: { kind: "fields", fields: ["notes", "overview"] },
        undo: { fields: { notes: "<p>a</p>", overview: null } },
      },
      "2026-11-11T10:05:00.000Z",
    );
    expect(merged.change).toEqual({ kind: "fields", fields: ["notes", "overview"] });
    expect(merged.undo?.fields).toEqual({ notes: "<p>old</p>", overview: null });
    expect(merged.at).toBe(T0);
    expect(merged.lastAt).toBe("2026-11-11T10:05:00.000Z");
  });

  it("adds up counts and keeps a plan's first version", () => {
    const noted = { ...EMPTY_PLAN, notes: "x" };
    const first = newActivity("p", planActivity("o1", "Sand", EMPTY_PLAN, noted), REY, T0);
    const picked = { ...noted, leadPair: [0, 1] as [number, number] };
    const merged = mergeActivity(first, planActivity("o1", "Sand Rain", noted, picked), T0);
    expect(merged.undo?.plan).toEqual(EMPTY_PLAN);
    expect(merged.change).toEqual({
      kind: "plan",
      opponentId: "o1",
      opponentLabel: "Sand Rain",
      parts: ["picks", "notes"],
    });
  });
});

const ROSTER = parseTeam(`Garchomp @ Choice Scarf
Ability: Rough Skin
EVs: 32 HP / 32 Atk
Jolly Nature
- Earthquake
- Stomping Tantrum

Incineroar @ Sitrus Berry
Ability: Intimidate
- Fake Out`);

describe("roster details", () => {
  it("names moves, items and Stat Points per Pokémon, matched by species", () => {
    const after = parseTeam(`Incineroar @ Safety Goggles
Ability: Intimidate
- Fake Out

Garchomp @ Choice Scarf
Ability: Rough Skin
EVs: 32 HP / 32 Spe
Jolly Nature
- Earthquake
- Rock Slide

Amoonguss @ Rocky Helmet
- Spore`);
    expect(rosterActivity(ROSTER, after)).toEqual({
      added: ["Amoonguss"],
      removed: [],
      edited: [
        { species: "Incineroar", item: { from: "Sitrus Berry", to: "Safety Goggles" } },
        {
          species: "Garchomp",
          movesAdded: ["Rock Slide"],
          movesRemoved: ["Stomping Tantrum"],
          spread: [
            { stat: "atk", from: 32, to: 0 },
            { stat: "spe", from: 0, to: 32 },
          ],
        },
      ],
    });
  });

  it("is nothing when only the order changed", () => {
    expect(rosterActivity(ROSTER, [...ROSTER].reverse())).toBeNull();
  });
});

describe("combination and calc details", () => {
  const team: Team = {
    ...TEAM,
    pokemon: ROSTER,
    calcs: [],
    combinations: [
      {
        id: "c1",
        leadPair: [0, 1],
        backPair: [null, null],
        leadMega: [true, true],
        backMega: [true, true],
        notes: "",
      },
    ],
  };

  it("lists a new combination's Pokémon, and a moved one isn't changed", () => {
    const added = {
      id: "c2",
      leadPair: [1, null] as [number, null],
      backPair: [0, null] as [number, null],
      leadMega: [true, true] as [boolean, boolean],
      backMega: [true, true] as [boolean, boolean],
      notes: "",
    };
    const after = { ...team, combinations: [added, ...team.combinations!] };
    const drafts = activityFromTeamChanges(team, diffCollabTeam(team, after));
    expect(drafts.map((d) => d.change)).toEqual([
      {
        kind: "combinations",
        added: 1,
        changed: 0,
        removed: 0,
        items: [{ id: "c2", action: "added", leads: ["Incineroar"], back: ["Garchomp"] }],
      },
    ]);
  });

  it("names a calc's Pokémon, its target and side", () => {
    const line =
      "252+ Atk Garchomp Earthquake vs. 252 HP / 4 Def Incineroar: 100-118 (50 - 59%) -- guaranteed 2HKO";
    const after = {
      ...team,
      calcs: [{ id: "x", text: line, species: "garchomp", side: "offensive" as const }],
    };
    const [draft] = activityFromTeamChanges(team, diffCollabTeam(team, after));
    expect(draft.change).toMatchObject({
      kind: "calcs",
      added: 1,
      items: [
        { id: "x", action: "added", species: "Garchomp", against: "Incineroar", side: "offensive" },
      ],
    });
  });

  it("drops an item added then removed within one entry", () => {
    const entry = newActivity(
      "e",
      {
        change: {
          kind: "calcs",
          added: 1,
          changed: 0,
          removed: 0,
          items: [{ id: "x", action: "added", species: null, against: null, side: null }],
        },
      },
      REY,
      T0,
    );
    const merged = mergeActivity(
      entry,
      {
        change: {
          kind: "calcs",
          added: 0,
          changed: 0,
          removed: 1,
          items: [{ id: "x", action: "removed", species: null, against: null, side: null }],
        },
      },
      T0,
    );
    expect(merged.change).toMatchObject({ added: 0, changed: 0, removed: 0, items: [] });
    expect(isEmptyActivity(merged)).toBe(true);
  });
});
