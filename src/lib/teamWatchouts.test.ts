import { describe, expect, it } from "vitest";
import {
  archetypeWatchouts,
  carefulWithWatchouts,
  prepKeyThreats,
  prepWithPinned,
  teamKey,
  prepWatchouts,
  setIssueWatchouts,
  threatWatchouts,
  typingWatchouts,
  weakCoreWatchouts,
  weakTeamWatchouts,
} from "./teamWatchouts";
import { analyzeTeamCoverage } from "./teamCoverage";
import type { MetaTeamMatchup, ThreatResult } from "@/lib/threats";

type Duel = ThreatResult["duels"][number];
const duel = (overrides: Partial<Duel> = {}): Duel => ({
  theirs: null,
  yours: null,
  theyMoveFirst: false,
  ko: null,
  answer: null,
  ...overrides,
});
const hit = (move: string, minPercent: number, maxPercent: number) => ({
  move,
  minPercent,
  maxPercent,
  accuracy: 1,
  priority: 0,
});
const threat = (
  species: string,
  level: ThreatResult["level"],
  duels: Duel[],
  item = "Leftovers",
): ThreatResult =>
  ({
    set: { id: `${species}|${item}`, species, pokemon: { species, item } },
    speed: 100,
    duels,
    danger: 1,
    level,
    score: 1,
    field: { weatherMattered: false, terrainMattered: false },
  }) as unknown as ThreatResult;

describe("threatWatchouts", () => {
  const answer = (level: "ko" | "wall" = "ko") => duel({ answer: level } as Partial<Duel>);
  it("lists threats nothing answers or only one Pokémon does, each Pokémon once", () => {
    const ranked = [
      // Answered twice: not listed, however hard it hits.
      threat("Charizard-Mega-Y", "high", [duel({ ko: "ohko" }), answer(), answer()]),
      threat("Staraptor-Mega", "high", [
        duel({ ko: "ohko", theirs: hit("Brave Bird", 120, 140) }),
        answer(),
        duel(),
      ]),
      threat("Staraptor-Mega", "high", [duel(), duel(), duel()], "Choice Band"),
      threat("Dragonite-Mega", "medium", [duel({ ko: "twoHko" }), duel({ ko: "twoHko" }), duel()]),
      // KOs nothing in one or two hits: not listed.
      threat("Incineroar", "low", [duel(), duel(), duel()]),
    ];
    expect(threatWatchouts(ranked)).toMatchObject([
      {
        kind: "threat",
        species: "Dragonite-Mega",
        item: "Leftovers",
        ohkos: [],
        rollOhkos: [],
        twoHkos: [0, 1],
        answeredBy: [],
      },
      {
        kind: "threat",
        species: "Staraptor-Mega",
        item: "Leftovers",
        ohkos: [{ index: 0, move: "Brave Bird", minPercent: 120, maxPercent: 140 }],
        rollOhkos: [],
        twoHkos: [],
        answeredBy: [1],
      },
    ]);
  });

  it("tells a sure OHKO from a roll, with the move, and names the field", () => {
    const rillaboom = { from: "yours" as const, by: "Rillaboom" };
    const result = {
      ...threat("Venusaur", "high", [
        duel({ ko: "rollOhko", theirs: hit("Leaf Storm", 96, 113) }),
        duel({ ko: "ohko", theirs: hit("Leaf Storm", 130, 155) }),
      ]),
      terrain: "Grassy",
      field: { terrain: rillaboom, weatherMattered: false, terrainMattered: true },
    } as ThreatResult;
    expect(threatWatchouts([result])[0]).toMatchObject({
      ohkos: [{ index: 1, move: "Leaf Storm", minPercent: 130, maxPercent: 155 }],
      rollOhkos: [{ index: 0, move: "Leaf Storm", minPercent: 96, maxPercent: 113 }],
      terrain: "Grassy",
      terrainBy: rillaboom,
    });
  });

  it("leaves out a field that changed nothing", () => {
    const result = {
      ...threat("Garchomp-Mega-Z", "high", [
        duel({ ko: "ohko", theirs: hit("Draco Meteor", 101, 120) }),
      ]),
      terrain: "Grassy",
      field: {
        terrain: { from: "yours", by: "Rillaboom" },
        weatherMattered: false,
        terrainMattered: false,
      },
    } as ThreatResult;
    const [watchout] = threatWatchouts([result]);
    expect(watchout).not.toHaveProperty("terrain");
  });

  it("leaves out an answered threat that only 2HKOs", () => {
    const ranked = [threat("Incineroar", "high", [duel({ ko: "twoHko" }), answer(), duel()])];
    expect(threatWatchouts(ranked)).toEqual([]);
  });

  it("counts a wall as an answer", () => {
    const ranked = [
      threat("Dragonite-Mega", "high", [duel({ ko: "twoHko" }), answer("wall"), answer()]),
    ];
    expect(threatWatchouts(ranked)).toEqual([]);
  });
});

describe("carefulWithWatchouts", () => {
  const answer = duel({ answer: "ko" } as Partial<Duel>);
  const ranked = [
    threat("Garchomp", "high", [duel({ ko: "ohko", theirs: hit("Earthquake", 110, 130) }), duel()]),
    // Answered twice: never picked by the calcs, but listed when added by hand.
    threat("Incineroar", "low", [answer, answer]),
  ];

  it("lists the Pokémon added by hand first, whatever the calcs say, each once", () => {
    const listed = carefulWithWatchouts(ranked, ["Incineroar", "Garchomp", "Pikachu"]);
    expect(listed.map((w) => w.kind === "threat" && [w.species, !!w.pinned])).toEqual([
      ["Incineroar", true],
      ["Garchomp", true],
    ]);
    expect(listed[0]).toMatchObject({ answeredBy: [0, 1] });
  });

  it("is the calcs' picks without any", () => {
    expect(carefulWithWatchouts(ranked)).toEqual(threatWatchouts(ranked));
  });
});

describe("matchup watch-outs", () => {
  it("keeps the weak teams and the worst archetypes", () => {
    const team = (score: number) => ({ score }) as MetaTeamMatchup;
    expect(
      weakTeamWatchouts([team(-0.5), team(-1.2), team(-0.8), team(-2)]).map((w) =>
        w.kind === "weakTeam" ? w.matchup.score : null,
      ),
    ).toEqual([-2, -1.2]);
    const versus = (opponent: string, winRate: number) => ({
      opponent,
      winRate,
      games: 40,
      wins: 0,
      losses: 0,
      ties: 0,
    });
    expect(
      archetypeWatchouts([versus("rain", 0.45), versus("trick-room", 0.38), versus("sun", 0.47)]),
    ).toEqual([
      { kind: "archetype", versus: versus("trick-room", 0.38) },
      { kind: "archetype", versus: versus("rain", 0.45) },
    ]);
  });
});

describe("setup answers", () => {
  it("are shown, but don't make a threat handled", () => {
    const setup = duel({ answer: "setup" } as Partial<Duel>);
    const listed = threatWatchouts([
      threat("Garchomp-Mega-Z", "high", [
        duel({ ko: "ohko", theirs: hit("Dragon Claw", 105, 124) }),
        duel({ answer: "ko" } as Partial<Duel>),
        setup,
      ]),
    ]);
    expect(listed.map((w) => (w.kind === "threat" ? w.answeredBy : null))).toEqual([[1, 2]]);
  });
});

describe("prepKeyThreats", () => {
  const member = (species: string, danger: number, duels: Duel[]) => ({
    result: { ...threat(species, "high", duels), danger },
  });
  const matchup = (...their: ReturnType<typeof member>[]) =>
    ({ their }) as unknown as MetaTeamMatchup;

  it("names the members that threaten you, unanswered first", () => {
    const keys = prepKeyThreats(
      matchup(
        member("Charizard-Mega-Y", 3, [
          duel({ ko: "ohko", theirs: hit("Heat Wave", 110, 130) }),
          duel({ answer: "ko" } as Partial<Duel>),
        ]),
        member("Incineroar", 2, [
          duel({ ko: "ohko", theirs: hit("Flare Blitz", 100, 120) }),
          duel(),
        ]),
        // Answered twice: not what makes the team a challenge.
        member("Garchomp", 4, [
          duel({ ko: "ohko" }),
          duel({ answer: "ko" } as Partial<Duel>),
          duel({ answer: "ko" } as Partial<Duel>),
        ]),
        member("Sylveon", 1, [duel(), duel()]),
      ),
    );
    expect(keys.map((w) => [w.species, w.answeredBy.length])).toEqual([
      ["Incineroar", 0],
      ["Charizard-Mega-Y", 1],
    ]);
  });

  it("falls back to the most dangerous member when none stands out alone", () => {
    const keys = prepKeyThreats(
      matchup(member("Sylveon", 1, [duel()]), member("Farigiraf", 2, [duel()])),
    );
    expect(keys.map((w) => w.species)).toEqual(["Farigiraf"]);
  });
});

describe("prepWithPinned", () => {
  const team = (species: string[], score: number) =>
    ({ combo: { species }, score }) as unknown as MetaTeamMatchup;
  const sun = team(["Charizard", "Venusaur"], -0.5);
  const rain = team(["Pelipper", "Archaludon"], 0.6);
  const primaryOf = (matchup: MetaTeamMatchup) => (matchup === sun ? "sun" : "rain");

  it("lists the teams added by hand first — an opponent with its name — whatever their score, without picking them twice", () => {
    const picked = [{ kind: "prepFor" as const, archetype: "sun", matchup: sun }];
    const resolve = (key: string) => {
      if (key === "opponent:o1") return { matchup: rain, label: "Juan's rain" };
      const matchup = [sun, rain].find((candidate) => teamKey(candidate.combo.species) === key);
      return matchup ? { matchup } : undefined;
    };
    const listed = prepWithPinned(
      picked,
      ["opponent:o1", teamKey(sun.combo.species), "opponent:deleted"],
      resolve,
      primaryOf,
    );
    expect(
      listed.map((w) => (w.kind === "prepFor" ? [w.archetype, !!w.pinned, w.label ?? null] : null)),
    ).toEqual([
      ["rain", true, "Juan's rain"],
      ["sun", true, null],
    ]);
  });

  it("folds an archetype with no team into a team of it added by hand, real results and all", () => {
    const real = { opponent: "rain", winRate: 0.43, games: 150, wins: 0, losses: 0, ties: 0 };
    const picked = [{ kind: "prepFor" as const, archetype: "rain", matchup: null, real }];
    const listed = prepWithPinned(
      picked,
      ["opponent:o1"],
      () => ({ matchup: rain, label: "Perish - Kommo-o" }),
      primaryOf,
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ archetype: "rain", pinned: true, real });
  });

  it("matches a team by its species, Megas as their base", () => {
    expect(teamKey(["Venusaur", "Charizard-Mega-Y"])).toBe(teamKey(["Charizard", "Venusaur"]));
  });
});

describe("prepWatchouts", () => {
  const team = (id: string, archetype: string, score: number) =>
    ({ combo: { species: [id] }, score, archetype }) as unknown as MetaTeamMatchup;
  const archetypeOf = (matchup: MetaTeamMatchup) =>
    (matchup as unknown as { archetype: string }).archetype;
  const versus = (opponent: string, winRate: number) => ({
    opponent,
    winRate,
    games: 100,
    wins: 0,
    losses: 0,
    ties: 0,
  });

  it("lists the archetypes the calcs or real games say are hard, each with its worst team", () => {
    const listed = prepWatchouts(
      [
        team("tr-1", "trick-room", -0.4),
        team("tr-2", "trick-room", -1.1),
        team("sun-1", "sun", 0.3),
        team("rain-1", "rain", 0.8),
        team("sand-1", "sand", -0.1),
      ],
      archetypeOf,
      [versus("sun", 0.41), versus("perish-trap", 0.43)],
    );
    expect(
      listed.map((w) =>
        w.kind === "prepFor" ? [w.archetype, w.matchup?.combo.species[0] ?? null, !!w.real] : null,
      ),
    ).toEqual([
      ["trick-room", "tr-2", false],
      ["sun", "sun-1", true],
      ["perish-trap", null, true],
    ]);
  });

  it("leaves out archetypes that are fine in the calcs and in real games", () => {
    expect(prepWatchouts([team("rain-1", "rain", 0.8)], archetypeOf)).toEqual([]);
  });
});

describe("weakCoreWatchouts", () => {
  it("keeps the two worst weak cores", () => {
    const core = (score: number) => ({ score }) as MetaTeamMatchup;
    expect(
      weakCoreWatchouts([core(-0.9), core(0.4), core(-1.5), core(-0.8)]).map((w) =>
        w.kind === "weakCore" ? w.matchup.score : null,
      ),
    ).toEqual([-1.5, -0.9]);
  });
});

describe("typingWatchouts", () => {
  it("lists weak types and the types nothing hits super effectively", () => {
    const watchouts = typingWatchouts(
      analyzeTeamCoverage([
        { species: "Charizard", moves: ["Flamethrower"] },
        { species: "Volcarona", moves: ["Flamethrower"] },
        { species: "Arcanine", moves: ["Flamethrower"] },
      ]),
    );
    expect(watchouts).toContainEqual(
      expect.objectContaining({ kind: "weakType", type: "Rock", weak: 3, resist: 0 }),
    );
    expect(watchouts.at(-1)).toMatchObject({ kind: "coverageGap" });
    const gap = watchouts.at(-1);
    expect(gap?.kind === "coverageGap" && gap.types).toContain("Water");
  });
});

describe("setIssueWatchouts", () => {
  it("wraps each issue", () => {
    const issue = { kind: "vestStatus" as const, index: 0, move: "Protect" };
    expect(setIssueWatchouts([issue])).toEqual([{ kind: "setIssue", issue }]);
  });
});
