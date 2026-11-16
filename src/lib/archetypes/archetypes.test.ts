import { describe, expect, it } from "vitest";
import type { ParsedPokemon } from "@/types";
import {
  DEFAULT_ARCHETYPE_SET,
  classifyTeam,
  matchesCheck,
  pokemonFacts,
  archetypeTempo,
  classificationLabel,
  validateArchetypeSet,
  type ArchetypeSet,
} from ".";

const mon = (
  species: string,
  moves: string[],
  extra: Partial<Omit<ParsedPokemon, "species" | "moves">> = {},
): ParsedPokemon => ({ species, moves, ...extra });

const filler = [
  mon("Garchomp", ["Earthquake", "Rock Slide", "Dragon Claw", "Protect"]),
  mon("Kingambit", ["Kowtow Cleave", "Sucker Punch", "Iron Head", "Protect"]),
];

const classify = (team: ParsedPokemon[]) => classifyTeam(team, DEFAULT_ARCHETYPE_SET, "M-C");

describe("checks", () => {
  it("uses the Mega form's species and ability", () => {
    const facts = pokemonFacts(
      mon("Charizard", ["Heat Wave"], { item: "Charizardite Y", ability: "Blaze" }),
    );
    expect(matchesCheck(facts, { ability: ["Drought"] })).toBe(true);
    expect(matchesCheck(facts, { species: ["Charizard-Mega-Y"] })).toBe(true);
    // The base identity matches too.
    expect(matchesCheck(facts, { species: ["Charizard"] })).toBe(true);
  });

  it("compares names as slugs and reads base stats", () => {
    const facts = pokemonFacts(mon("Torkoal", ["Eruption", "Heat Wave"], { nature: "Quiet" }));
    expect(matchesCheck(facts, { move: ["heat-wave"] })).toBe(true);
    expect(matchesCheck(facts, { baseStat: { spe: { max: 60 } } })).toBe(true);
    expect(matchesCheck(facts, { natureLowers: "spe" })).toBe(true);
    expect(matchesCheck(facts, { computed: "spreadAttacker" })).toBe(true);
    expect(matchesCheck(facts, { not: { move: ["Protect"] } })).toBe(true);
  });
});

describe("classifyTeam", () => {
  it("picks the most specific weather variant and drops its parent", () => {
    const result = classify([
      mon("Torkoal", ["Eruption", "Heat Wave", "Protect"], { ability: "Drought" }),
      mon("Pyroar", ["Heat Wave", "Hyper Voice", "Protect"], { item: "Pyroarite" }),
      ...filler,
    ]);
    expect(result.primary).toBe("sun-fire-spam");
    expect(result.tags).not.toContain("sun");
  });

  it("finds Double weather through two parents", () => {
    const result = classify([
      mon("Charizard", ["Heat Wave", "Protect"], { item: "Charizardite Y" }),
      mon("Pelipper", ["Hurricane", "Tailwind", "Protect"], { ability: "Drizzle" }),
      ...filler,
    ]);
    expect(result.primary).toBe("double-weather");
    // Weather outranks speed control; Tailwind stays as a tag.
    expect(result.tags).toEqual(["tailwind"]);
    expect(classificationLabel(result, DEFAULT_ARCHETYPE_SET)).toBe("Double weather + Tailwind");
  });

  it("folds same-family matches into the primary", () => {
    const result = classify([
      mon("Charizard", ["Heat Wave", "Protect"], { item: "Charizardite Y" }),
      mon("Pelipper", ["Hurricane", "Protect"], { ability: "Drizzle" }),
      mon("Venusaur", ["Sleep Powder", "Giga Drain", "Protect"], { ability: "Chlorophyll" }),
      mon("Grimmsnarl", ["Reflect", "Light Screen", "Spirit Break"]),
      ...filler,
    ]);
    expect(result.primary).toBe("double-weather");
    expect(result.folded).toEqual(expect.arrayContaining(["sun-chlorophyll", "rain-screens"]));
    expect(result.tags).toEqual([]);
  });

  it("splits Psyspam by Trick Room", () => {
    const base = [
      mon("Indeedee-F", ["Follow Me", "Psychic", "Protect"], { ability: "Psychic Surge" }),
      mon("Hatterene", ["Expanding Force", "Dazzling Gleam", "Protect"]),
    ];
    expect(classify([...base, ...filler]).primary).toBe("psyspam-ho");
    const withRoom = [
      ...base,
      mon("Farigiraf", ["Trick Room", "Psychic", "Hyper Voice", "Protect"]),
      ...filler,
    ];
    const room = classify(withRoom);
    expect(room.primary).toBe("psyspam-tr");
    // Trick Room is one of its parents, so it folds in rather than showing twice.
    expect(room.tags).not.toContain("trick-room");
    expect(classificationLabel(room, DEFAULT_ARCHETYPE_SET)).toBe("Psyspam · Trick Room");

    // Trick Room only as a backup (no slow attackers) is still HO.
    const backup = [
      mon("Indeedee-F", ["Follow Me", "Trick Room", "Psychic", "Protect"], {
        ability: "Psychic Surge",
      }),
      mon("Hatterene", ["Expanding Force", "Dazzling Gleam", "Protect"]),
      mon("Flutter Mane", ["Moonblast", "Shadow Ball", "Protect"]),
    ];
    expect(classify(backup).primary).toBe("psyspam-ho");
  });

  it("tells hard setup from balance setup", () => {
    const hard = classify([
      mon("Amoonguss", ["Rage Powder", "Spore", "Pollen Puff", "Protect"]),
      mon("Volcarona", ["Quiver Dance", "Fiery Dance", "Protect", "Tera Blast"]),
      mon("Clefable", ["Follow Me", "Moonblast", "Protect", "Helping Hand"]),
    ]);
    expect(hard.primary).toBe("hard-setup");

    // Fake Out instead of redirection counts too.
    const fakeOut = classify([
      mon("Incineroar", ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"]),
      mon("Volcarona", ["Quiver Dance", "Fiery Dance", "Protect", "Tera Blast"]),
      mon("Amoonguss", ["Rage Powder", "Spore", "Pollen Puff", "Protect"]),
    ]);
    expect(fakeOut.primary).toBe("hard-setup");

    const balance = classify([
      mon("Incineroar", ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"]),
      mon("Kingambit", ["Swords Dance", "Kowtow Cleave", "Sucker Punch", "Iron Head"]),
      mon("Garchomp", ["Earthquake", "Rock Slide", "Dragon Claw", "Protect"]),
      mon("Hydreigon", ["Draco Meteor", "Dark Pulse", "Flamethrower", "Protect"]),
    ]);
    expect(balance.primary).toBe("balance-setup");

    // The owner's "balance with a setup mode": Swords Dance and Calm Mind on full sets,
    // four attackers that never need a boost.
    const ychutte = classify([
      mon("Raichu", ["Zap Cannon", "Focus Blast", "Fake Out", "Protect"], {
        item: "Raichunite Y",
      }),
      mon("Floette-Eternal", ["Protect", "Moonblast", "Dazzling Gleam", "Calm Mind"], {
        item: "Floettite",
      }),
      mon("Rillaboom", ["Grassy Glide", "Wood Hammer", "High Horsepower", "Fake Out"], {
        ability: "Grassy Surge",
      }),
      mon("Volcarona", ["Rage Powder", "Overheat", "Struggle Bug", "Tailwind"]),
      mon("Sneasler", ["Dire Claw", "Close Combat", "Swords Dance", "Protect"]),
      mon("Basculegion", ["Flip Turn", "Wave Crash", "Last Respects", "Soak"]),
    ]);
    expect(ychutte.primary).toBe("balance-setup");
    expect(classificationLabel(ychutte, DEFAULT_ARCHETYPE_SET)).toBe("Balance setup + Tailwind");
  });

  it("returns no primary (Balance) when nothing matches", () => {
    const result = classify(filler);
    expect(result).toMatchObject({ primary: null, tags: [], speedMode: null });
    expect(classificationLabel(result, DEFAULT_ARCHETYPE_SET)).toBe("Balance");
  });

  it("skips drafts and archetypes of other regulations", () => {
    const team = [mon("Tornadus", ["Tailwind", "Bleakwind Storm"]), ...filler];
    const set: ArchetypeSet = {
      ...DEFAULT_ARCHETYPE_SET,
      archetypes: DEFAULT_ARCHETYPE_SET.archetypes.map((a) =>
        a.id === "tailwind" ? { ...a, regulations: ["M-A"] } : a,
      ),
    };
    expect(classifyTeam(team, set, "M-C").primary).toBeNull();
    expect(classifyTeam(team, set, "M-A").primary).toBe("tailwind");
  });
});

describe("archetypeTempo", () => {
  it("takes the archetype's own tempo, else its nearest ancestor's", () => {
    expect(archetypeTempo("sun-fire-spam", DEFAULT_ARCHETYPE_SET)).toBe("offense");
    expect(archetypeTempo("stall-poison", DEFAULT_ARCHETYPE_SET)).toBe("patient");
    expect(archetypeTempo("perish-trap", DEFAULT_ARCHETYPE_SET)).toBeUndefined();
  });
});

describe("drafts", () => {
  it("never matches Grassy control while it's a draft", () => {
    const result = classify([
      mon("Rillaboom", ["Fake Out", "Grassy Glide", "Wood Hammer", "U-turn"], {
        ability: "Grassy Surge",
      }),
      ...filler,
    ]);
    expect(result.matches.map((m) => m.id)).not.toContain("grassy-control");
  });
});

describe("validateArchetypeSet", () => {
  it("accepts the defaults", () => {
    expect(validateArchetypeSet(DEFAULT_ARCHETYPE_SET)).toEqual([]);
  });

  it("reports unknown roles, unknown parents and cycles", () => {
    const problems = validateArchetypeSet({
      version: 1,
      roles: [],
      archetypes: [
        {
          id: "a",
          name: "A",
          family: "weather",
          parents: ["b"],
          description: "",
          requires: [{ role: "nope" }],
          priority: 1,
          status: "active",
        },
        {
          id: "b",
          name: "B",
          family: "weather",
          parents: ["a", "ghost"],
          description: "",
          requires: [],
          priority: 1,
          status: "active",
        },
      ],
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        `"a" uses unknown role "nope"`,
        `"b" has unknown parent "ghost"`,
        `"a" is its own ancestor`,
      ]),
    );
  });
});
