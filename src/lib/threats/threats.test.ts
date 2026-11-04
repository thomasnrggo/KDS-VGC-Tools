import { describe, expect, it } from "vitest";
import type { MetaPokemon } from "@/lib/meta/aggregateMeta";
import type { ParsedPokemon } from "@/types";
import {
  analyzeThreats,
  bestHit,
  estimateSpread,
  metaThreatSets,
  protectCount,
  setIssues,
  speedControlCounters,
  speedControlReport,
  speedControlSetters,
  teamRoles,
  teamStyle,
  threatMatchups,
  withSpread,
} from ".";

// The owner's Floette team (with its Stat Points), M-C.
const TEAM: ParsedPokemon[] = [
  {
    species: "Raichu",
    item: "Raichunite Y",
    ability: "Lightning Rod",
    evs: "32 HP / 11 Def / 23 Spe",
    nature: "Timid",
    moves: ["Zap Cannon", "Focus Blast", "Fake Out", "Protect"],
  },
  {
    species: "Floette",
    item: "Floettite",
    ability: "Flower Veil",
    evs: "28 HP / 23 Def / 6 SpA / 9 Spe",
    nature: "Bold",
    moves: ["Protect", "Moonblast", "Dazzling Gleam", "Calm Mind"],
  },
  {
    species: "Rillaboom",
    item: "Miracle Seed",
    ability: "Grassy Surge",
    evs: "26 HP / 30 Atk / 1 Def / 4 SpD / 5 Spe",
    nature: "Adamant",
    moves: ["Grassy Glide", "Wood Hammer", "High Horsepower", "Fake Out"],
  },
  {
    species: "Volcarona",
    item: "Rocky Helmet",
    ability: "Flame Body",
    evs: "13 HP / 30 Def / 23 Spe",
    nature: "Timid",
    moves: ["Rage Powder", "Overheat", "Struggle Bug", "Tailwind"],
  },
  {
    species: "Sneasler",
    item: "Electric Seed",
    ability: "Unburden",
    evs: "23 HP / 20 Atk / 5 SpD / 18 Spe",
    nature: "Adamant",
    moves: ["Dire Claw", "Close Combat", "Swords Dance", "Protect"],
  },
  {
    species: "Basculegion",
    item: "Choice Scarf",
    ability: "Adaptability",
    evs: "2 HP / 32 Atk / 32 Spe",
    nature: "Adamant",
    moves: ["Flip Turn", "Wave Crash", "Last Respects", "Soak"],
  },
];

function metaPokemon(entry: Partial<MetaPokemon> & { species: string }): MetaPokemon {
  return {
    teams: 100,
    usage: 0.2,
    topUsage: 0.2,
    winRate: 0.5,
    rounds: 500,
    items: [],
    abilities: [],
    natures: [],
    moves: [],
    sets: [],
    teammates: [],
    history: [],
    ...entry,
  };
}

const GARCHOMP = metaPokemon({
  species: "Garchomp",
  usage: 0.16,
  items: [
    { name: "Choice Scarf", share: 0.52 },
    { name: "Life Orb", share: 0.18 },
    { name: "Sitrus Berry", share: 0.1 },
  ],
  abilities: [{ name: "Rough Skin", share: 1 }],
  natures: [{ name: "Jolly", share: 0.6 }],
  moves: [
    { name: "Earthquake", share: 0.9 },
    { name: "Dragon Claw", share: 0.8 },
    { name: "Rock Slide", share: 0.7 },
    { name: "Protect", share: 0.5 },
  ],
  sets: [
    {
      item: "Choice Scarf",
      ability: "Rough Skin",
      nature: "Adamant",
      moves: ["Dragon Claw", "Earthquake", "Rock Slide", "Stomping Tantrum"],
      share: 0.3,
    },
  ],
});

describe("estimateSpread", () => {
  it("maxes the attacking stat and Speed for +Speed or a Choice Scarf", () => {
    expect(
      estimateSpread({ species: "Garchomp", nature: "Jolly", moves: ["Earthquake", "Protect"] }),
    ).toBe("32 Atk / 32 Spe / 2 HP");
    expect(
      estimateSpread({
        species: "Gholdengo",
        item: "Choice Scarf",
        nature: "Modest",
        moves: ["Make It Rain", "Shadow Ball"],
      }),
    ).toBe("32 SpA / 32 Spe / 2 HP");
  });

  it("maxes HP for Trick Room natures, bulky items and defensive natures", () => {
    expect(estimateSpread({ species: "Torkoal", nature: "Quiet", moves: ["Eruption"] })).toBe(
      "32 HP / 32 SpA / 2 Def",
    );
    expect(
      estimateSpread({
        species: "Incineroar",
        item: "Sitrus Berry",
        nature: "Adamant",
        moves: ["Flare Blitz", "Fake Out"],
      }),
    ).toBe("32 HP / 32 Atk / 2 Spe");
    expect(estimateSpread({ species: "Incineroar", nature: "Careful", moves: ["Fake Out"] })).toBe(
      "32 HP / 32 SpD / 2 Def",
    );
  });

  it("keeps a set's own Stat Points", () => {
    expect(withSpread(TEAM[0])).toEqual({ pokemon: TEAM[0], estimated: false });
    expect(withSpread({ species: "Garchomp", nature: "Jolly" }).estimated).toBe(true);
  });
});

describe("metaThreatSets", () => {
  it("makes one set per common item, from the most common full set with it", () => {
    const sets = metaThreatSets([GARCHOMP]);
    expect(sets.map((set) => set.pokemon.item)).toEqual(["Choice Scarf", "Life Orb"]);
    const [scarf, lifeOrb] = sets;
    expect(scarf.pokemon).toMatchObject({
      species: "Garchomp",
      nature: "Adamant",
      moves: ["Dragon Claw", "Earthquake", "Rock Slide", "Stomping Tantrum"],
      evs: "32 Atk / 32 Spe / 2 HP",
    });
    expect(scarf.usage).toBeCloseTo(0.16 * 0.52);
    // No full set with a Life Orb: the Pokémon's most common moves and nature.
    expect(lifeOrb.pokemon).toMatchObject({
      nature: "Jolly",
      moves: ["Earthquake", "Dragon Claw", "Rock Slide", "Protect"],
    });
  });

  it("calcs a Mega as its base species holding the stone", () => {
    const [set] = metaThreatSets([
      metaPokemon({
        species: "Garchomp-Mega-Z",
        items: [{ name: "Garchompite Z", share: 1 }],
        moves: [{ name: "Earth Power", share: 1 }],
      }),
    ]);
    expect(set.species).toBe("Garchomp-Mega-Z");
    expect(set.pokemon).toMatchObject({ species: "Garchomp", item: "Garchompite Z" });
  });
});

describe("bestHit", () => {
  it("makes No Guard moves always hit", () => {
    const target: ParsedPokemon = { species: "Pelipper", nature: "Bold", evs: "32 HP / 32 Def" };
    const hit = bestHit(TEAM[0], target, {});
    expect(hit?.move).toBe("Zap Cannon");
    expect(hit?.accuracy).toBe(1);
  });

  it("gives Grassy Glide priority only in Grassy Terrain", () => {
    const target: ParsedPokemon = { species: "Basculegion", moves: [] };
    const rillaboom = { ...TEAM[2], moves: ["Grassy Glide"] };
    expect(bestHit(rillaboom, target, { terrain: "Grassy" })?.priority).toBe(1);
    expect(bestHit(rillaboom, target, {})?.priority).toBe(0);
  });
});

describe("analyzeThreats", () => {
  const [scarf, lifeOrb] = analyzeThreats(TEAM, metaThreatSets([GARCHOMP])).sort((a, b) =>
    a.set.id.localeCompare(b.set.id),
  );

  it("tells a Choice Scarf set from a Life Orb one", () => {
    expect(scarf.set.pokemon.item).toBe("Choice Scarf");
    expect(lifeOrb.set.pokemon.item).toBe("Life Orb");
    const outspeeds = (result: typeof scarf) =>
      result.duels.filter((duel) => duel.theyMoveFirst).length;
    expect(outspeeds(scarf)).toBe(TEAM.length);
    expect(outspeeds(lifeOrb)).toBeLessThan(TEAM.length);
  });

  it("calcs in the team's own terrain — Grassy Terrain halves Earthquake", () => {
    expect(scarf.terrain).toBe("Grassy");
    // Stomping Tantrum out-damages a halved Earthquake on Raichu.
    expect(scarf.duels[0].theirs?.move).toBe("Stomping Tantrum");
  });

  it("finds the answers that KO it", () => {
    const floette = scarf.duels[1];
    expect(floette.yours?.move).toBe("Moonblast");
    expect(floette.answer).not.toBeNull();
  });

  it("lets your Tailwind and Trick Room change who moves first", () => {
    const [normal] = analyzeThreats([TEAM[3]], metaThreatSets([GARCHOMP]).slice(1), "normal");
    const [tailwind] = analyzeThreats([TEAM[3]], metaThreatSets([GARCHOMP]).slice(1), "tailwind");
    expect(normal.duels[0].theyMoveFirst).toBe(true);
    expect(tailwind.duels[0].theyMoveFirst).toBe(false);
  });
});

describe("team checks", () => {
  it("finds who covers each doubles role", () => {
    const roles = teamRoles(TEAM);
    expect(roles.fakeOut.map((member) => member.index)).toEqual([0, 2]);
    expect(roles.speedControl).toEqual([{ index: 3, via: "Tailwind", kind: "move" }]);
    expect(roles.redirection).toEqual([{ index: 3, via: "Rage Powder", kind: "move" }]);
    // A Mega Raichu Y has No Guard, not Lightning Rod.
    expect(roles.terrain).toEqual([{ index: 2, via: "Grassy Surge", kind: "ability" }]);
    expect(roles.intimidate).toEqual([]);
    expect(protectCount(TEAM)).toBe(3);
  });

  it("flags a Terrain Seed nobody sets the terrain for", () => {
    expect(setIssues(TEAM)).toEqual([
      {
        kind: "terrainNeverSet",
        index: 4,
        via: "Electric Seed",
        terrain: "Electric",
        clashes: "Grassy",
      },
    ]);
  });

  it("flags a Choice item with Protect, an Assault Vest with a status move, a weather ability without its weather", () => {
    const issues = setIssues([
      { species: "Garchomp", item: "Choice Scarf", moves: ["Earthquake", "Protect"] },
      { species: "Incineroar", item: "Assault Vest", moves: ["Flare Blitz", "Parting Shot"] },
      { species: "Venusaur", ability: "Chlorophyll", moves: ["Giga Drain"] },
    ]);
    expect(issues.map((issue) => issue.kind)).toEqual([
      "choiceProtect",
      "vestStatus",
      "weatherNeverSet",
    ]);
  });
});

const FARIGIRAF = metaPokemon({
  species: "Farigiraf",
  usage: 0.15,
  items: [{ name: "Sitrus Berry", share: 0.5 }],
  abilities: [{ name: "Armor Tail", share: 1 }],
  natures: [{ name: "Quiet", share: 1 }],
  moves: [
    { name: "Trick Room", share: 0.98 },
    { name: "Psychic", share: 0.6 },
  ],
});
const SINISTCHA = metaPokemon({
  species: "Sinistcha",
  usage: 0.08,
  items: [{ name: "Leftovers", share: 0.5 }],
  abilities: [{ name: "Hospitality", share: 1 }],
  natures: [{ name: "Bold", share: 1 }],
  moves: [
    { name: "Trick Room", share: 0.8 },
    { name: "Matcha Gotcha", share: 0.9 },
  ],
});

describe("speed control", () => {
  it("lists the common setters, and what Fake Out can't stop", () => {
    const setters = speedControlSetters([GARCHOMP, FARIGIRAF, SINISTCHA], "trickRoom", TEAM);
    expect(setters.map((setter) => setter.species)).toEqual(["Farigiraf", "Sinistcha"]);
    expect(setters[0].fakeOutBlockedBy).toBe("Armor Tail");
    expect(setters[1].fakeOutBlockedBy).toBeUndefined();
  });

  it("only counts Fake Out against Trick Room when it works on a setter", () => {
    const [farigiraf] = speedControlSetters([FARIGIRAF], "trickRoom", TEAM);
    const kinds = (setters: (typeof farigiraf)[]) =>
      speedControlCounters(TEAM, "trickRoom", setters).map((counter) => counter.kind);
    // Armor Tail: Raichu's and Rillaboom's Fake Outs don't count (Wood Hammer's KO does).
    expect(kinds([farigiraf])).not.toContain("fakeOut");
    expect(farigiraf.koedBy).toEqual([{ index: 2, move: "Wood Hammer", sure: false }]);
    const both = speedControlSetters([FARIGIRAF, SINISTCHA], "trickRoom", TEAM);
    expect(kinds(both).filter((kind) => kind === "fakeOut")).toHaveLength(2);
  });

  it("finds the ways to play through the opponent's Tailwind", () => {
    const kinds = speedControlCounters(TEAM, "tailwind", []).map(
      (counter) => `${counter.kind}:${TEAM[counter.index].species}`,
    );
    expect(kinds).toEqual(["priority:Rillaboom", "tailwind:Volcarona", "choiceScarf:Basculegion"]);
  });

  it("counts Taunt, Imprison with Trick Room, and a setter KO", () => {
    const team: ParsedPokemon[] = [
      { species: "Hatterene", moves: ["Trick Room", "Imprison", "Taunt"] },
    ];
    expect(speedControlCounters(team, "trickRoom", []).map((counter) => counter.kind)).toEqual([
      "trickRoom",
      "imprison",
      "taunt",
    ]);
  });

  it("calls the team exposed when the opponent's speed control hurts and nothing answers it", () => {
    const team = [TEAM[0]].map((mon) => withSpread(mon).pokemon);
    const all = threatMatchups(team, metaThreatSets([GARCHOMP]));
    const report = speedControlReport(team, [FARIGIRAF], all, "tailwind");
    expect(report.exposure.under).toBeGreaterThan(report.exposure.normal);
    expect(report.verdict).not.toBe("covered");
  });
});

describe("teamStyle", () => {
  const roles = (style: ReturnType<typeof teamStyle>, index: number) =>
    style.pokemon[index].roles.map((reason) => reason.role);

  it("reads the owner's team as a balance team with Tailwind, setup options and Grassy Terrain", () => {
    const team = TEAM.map((mon) => withSpread(mon).pokemon);
    const style = teamStyle(team, threatMatchups(team, metaThreatSets([GARCHOMP])));
    expect(style.archetype).toBe("balance");
    expect(style.extras).toEqual([
      { kind: "tailwind", index: 3 },
      { kind: "setupOptions", indexes: [1, 4] },
      { kind: "terrain", terrain: "Grassy", index: 2 },
    ]);
    // Fake Out alone makes a support; Rage Powder and Tailwind too.
    expect(roles(style, 0)).toContain("support");
    expect(style.pokemon[3].roles[0]).toEqual({
      role: "support",
      via: ["Rage Powder", "Tailwind"],
    });
    // Floette: Calm Mind (and, against only Garchomp, pressure too — Moonblast KOs both sets).
    expect(roles(style, 1)).toEqual(["pressure", "setup"]);
  });

  it("counts pressure and revenge kills against the common sets", () => {
    const team = TEAM.map((mon) => withSpread(mon).pokemon);
    const style = teamStyle(team, threatMatchups(team, metaThreatSets([GARCHOMP])));
    expect(style.commonSets).toBe(2);
    // Floette's Moonblast KOs both Garchomp sets.
    expect(style.pokemon[1].kos).toBe(2);
    for (const mon of style.pokemon) {
      expect(roles(style, mon.index).includes("pressure")).toBe(mon.kos / 2 >= 0.3);
    }
  });

  it("finds Trick Room, weather and setup teams", () => {
    const trickRoom: ParsedPokemon[] = [
      { species: "Farigiraf", nature: "Quiet", moves: ["Trick Room", "Psychic"] },
      { species: "Torkoal", nature: "Quiet", moves: ["Eruption"] },
      { species: "Ursaluna", nature: "Brave", moves: ["Facade"] },
    ];
    expect(teamStyle(trickRoom, []).archetype).toBe("trickRoom");

    const rain: ParsedPokemon[] = [
      { species: "Pelipper", ability: "Drizzle", moves: ["Hurricane", "Tailwind"] },
      { species: "Basculegion", moves: ["Wave Crash"] },
      { species: "Archaludon", moves: ["Electro Shot"] },
    ];
    expect(teamStyle(rain, [])).toMatchObject({ archetype: "weather", weather: "Rain" });
    // One Water attacker isn't a rain team.
    expect(teamStyle(rain.slice(0, 2), []).archetype).toBe("balance");

    const setup: ParsedPokemon[] = [
      { species: "Volcarona", moves: ["Quiver Dance"] },
      { species: "Dragonite", moves: ["Dragon Dance"] },
      { species: "Kingambit", moves: ["Swords Dance"] },
    ];
    expect(teamStyle(setup, []).archetype).toBe("setup");
  });

  it("leaves a Pokémon with no clear job without a role", () => {
    const style = teamStyle([{ species: "Golisopod", moves: ["Liquidation"] }], []);
    expect(style.pokemon[0]).toEqual({ index: 0, roles: [], kos: 0, revenge: 0 });
  });
});
