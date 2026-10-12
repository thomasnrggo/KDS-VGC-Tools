import { describe, expect, it } from "vitest";
import {
  asVariantOf,
  clearCopiedPlanFlag,
  compareTeams,
  findVariantCandidates,
  groupOpponents,
  isVariantMatch,
  megaIdentities,
  promoteVariant,
} from "./opponentVariants";
import { createOpponent } from "./opponent";
import { parseTeam } from "./parseTeam";
import { REGULATIONS } from "@/data/regulations";
import type { MatchupPlan, Opponent } from "@/types";

const REG_ID = REGULATIONS[0].id;

function team(...lines: string[]) {
  return parseTeam(lines.join("\n\n"));
}

// The M-C "best teams (early)" folder the detection rules were tuned
// against (docs/opponent-organization.md) — species and items as pasted.
const MC_TEAMS: Record<string, ReturnType<typeof team>> = {
  "Sand Coaching": team("Excadrill @ Focus Sash", "Salamence @ Salamencite", "Tyranitar @ Tyranitarite", "Indeedee @ Choice Scarf", "Corviknight @ Psychic Seed", "Sneasler @ White Herb"),
  "Chomp Z": team("Gholdengo @ Life Orb", "Volcarona @ Rocky Helmet", "Garchomp @ Garchompite Z", "Incineroar @ Sitrus Berry", "Rillaboom @ Miracle Seed", "Raichu @ Raichunite Y"),
  "Double weather": team("Archaludon @ Leftovers", "Pelipper @ Sitrus Berry", "Grimmsnarl @ Light Clay", "Charizard @ Charizardite Y", "Garchomp @ Garchompite Z", "Venusaur @ Focus Sash"),
  Zardpex: team("Sylveon @ Fairy Feather", "Toxapex @ Leftovers", "Garchomp @ Choice Scarf", "Venusaur @ Life Orb", "Charizard @ Charizardite Y", "Incineroar @ Sitrus Berry"),
  "ChuY Raptor": team("Arcanine-Hisui @ Focus Sash", "Rillaboom @ Miracle Seed", "Gholdengo @ Life Orb", "Staraptor @ Staraptite", "Raichu @ Raichunite Y", "Sylveon @ Fairy Feather"),
  "ChompZ TR": team("Farigiraf @ Sitrus Berry", "Garchomp @ Garchompite Z", "Sneasler @ White Herb", "Torkoal @ Charcoal", "Sylveon @ Fairy Feather", "Incineroar @ Chople Berry"),
  "Protect the king": team("Sneasler @ Focus Sash", "Sinistcha @ Colbur Berry", "Kingambit @ Life Orb", "Floette-Eternal @ Floettite", "Delphox @ Delphoxite", "Incineroar @ Sitrus Berry"),
  "Spy Spam": team("Salamence @ Salamencite", "Arcanine-Hisui @ Focus Sash", "Indeedee @ Choice Scarf", "Milotic @ Leftovers", "Metagross @ Metagrossite", "Sneasler @ Psychic Seed"),
  Rain: team("Sneasler @ White Herb", "Golisopod-Mega @ Golisopite", "Pelipper @ Damp Rock", "Archaludon @ Leftovers", "Basculegion-F (F) @ Focus Sash", "Floette-Mega (F) @ Floettite"),
  "Perish - Kommoo": team("Vivillon @ Focus Sash", "Politoed @ Sitrus Berry", "Gengar @ Gengarite", "Incineroar @ Passho Berry", "Rillaboom @ Occa Berry", "Kommo-o @ Leftovers"),
  "Perish - Archa": team("Politoed @ Sitrus Berry", "Raichu @ Raichunite Y", "Rillaboom @ Eject Button", "Gengar @ Gengarite", "Incineroar @ Chople Berry", "Archaludon @ Leftovers"),
  aerozard: team("Garchomp @ Life Orb", "Aerodactyl @ Aerodactylite", "Charizard @ Charizardite Y", "Kingambit @ Focus Sash", "Sylveon @ Fairy Feather", "Farigiraf @ Sitrus Berry"),
  "sun zard": team("Farigiraf @ Sitrus Berry", "Incineroar @ Chople Berry", "Charizard @ Charizardite Y", "Sylveon @ Fairy Feather", "Venusaur @ Focus Sash", "Garchomp @ Choice Scarf"),
};

describe("megaIdentities", () => {
  it("identifies a Mega by species + stone, so Charizard X and Y are different Megas", () => {
    const x = megaIdentities(team("Charizard @ Charizardite X"));
    const y = megaIdentities(team("Charizard @ Charizardite Y"));
    expect(x.size).toBe(1);
    expect([...x][0]).not.toBe([...y][0]);
  });

  it("ignores non-stone items", () => {
    expect(megaIdentities(team("Garchomp @ Choice Scarf")).size).toBe(0);
  });

  it("treats a Mega named either way as the same Mega", () => {
    expect([...megaIdentities(team("Floette-Mega (F) @ Floettite"))]).toEqual([
      ...megaIdentities(team("Floette-Eternal @ Floettite")),
    ]);
  });
});

describe("isVariantMatch against the M-C best teams folder", () => {
  it("matches exactly the three expected pairs", () => {
    const names = Object.keys(MC_TEAMS);
    const matches: string[] = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (isVariantMatch(MC_TEAMS[names[i]], MC_TEAMS[names[j]])) {
          matches.push(`${names[i]} ↔ ${names[j]}`);
        }
      }
    }
    expect(matches.sort()).toEqual(
      ["Perish - Kommoo ↔ Perish - Archa", "Zardpex ↔ sun zard", "aerozard ↔ sun zard"].sort(),
    );
  });

  it("rejects 4 shared Pokémon with no shared Mega (ChompZ TR vs sun zard)", () => {
    expect(compareTeams(MC_TEAMS["ChompZ TR"], MC_TEAMS["sun zard"])).toMatchObject({
      sharedPokemon: 4,
      sharedMegas: 0,
    });
    expect(isVariantMatch(MC_TEAMS["ChompZ TR"], MC_TEAMS["sun zard"])).toBe(false);
  });

  it("rejects 3 shared Pokémon with one shared Mega (Chomp Z vs Perish - Archa)", () => {
    expect(isVariantMatch(MC_TEAMS["Chomp Z"], MC_TEAMS["Perish - Archa"])).toBe(false);
  });
});

describe("isVariantMatch rules", () => {
  it("rule 3: two double-Mega teams sharing both Megas plus one more Pokémon", () => {
    const a = team("Charizard @ Charizardite Y", "Garchomp @ Garchompite Z", "Pelipper @ Damp Rock", "Archaludon", "Grimmsnarl", "Venusaur");
    const b = team("Charizard @ Charizardite Y", "Garchomp @ Garchompite Z", "Pelipper @ Sitrus Berry", "Kingambit", "Sylveon", "Farigiraf");
    expect(isVariantMatch(a, b)).toBe(true);
  });

  it("rule 3 needs the third shared Pokémon", () => {
    const a = team("Charizard @ Charizardite Y", "Garchomp @ Garchompite Z", "Pelipper", "Archaludon", "Grimmsnarl", "Venusaur");
    const b = team("Charizard @ Charizardite Y", "Garchomp @ Garchompite Z", "Torkoal", "Kingambit", "Sylveon", "Farigiraf");
    expect(isVariantMatch(a, b)).toBe(false);
  });
});

describe("findVariantCandidates", () => {
  it("offers sun zard one slot per group, best match first", () => {
    const groups = [
      { main: "aerozard", members: [MC_TEAMS.aerozard] },
      { main: "Zardpex", members: [MC_TEAMS.Zardpex] },
      { main: "ChompZ TR", members: [MC_TEAMS["ChompZ TR"]] },
    ];
    const candidates = findVariantCandidates(MC_TEAMS["sun zard"], groups);
    // Zardpex shares 5 Pokémon vs aerozard's 4 (both share the Zard-Y Mega).
    expect(candidates.map((candidate) => candidate.main)).toEqual(["Zardpex", "aerozard"]);
  });

  it("matches a group through any member, not only its main", () => {
    const groups = [{ main: "Perish group", members: [MC_TEAMS.Rain, MC_TEAMS["Perish - Kommoo"]] }];
    expect(findVariantCandidates(MC_TEAMS["Perish - Archa"], groups)).toHaveLength(1);
  });
});

function opponent(id: string, overrides: Partial<Opponent> = {}): Opponent {
  return { ...createOpponent(id, "Ditto", REG_ID), id, ...overrides };
}

const PLAN: MatchupPlan = {
  leadPair: [0, 1],
  backPair: [2, 3],
  leadMega: [true, true],
  backMega: [true, true],
  notes: "lead fake out",
};

describe("groupOpponents", () => {
  it("nests variants under their main, keeping the mains' order and the variants' own order", () => {
    const groups = groupOpponents([
      opponent("main-a"),
      opponent("v2", { variantOf: "main-a", sortOrder: 1 }),
      opponent("main-b"),
      opponent("v1", { variantOf: "main-a", sortOrder: 2 }),
    ]);
    expect(groups.map((group) => [group.main.id, group.variants.map((v) => v.id)])).toEqual([
      ["main-a", ["v1", "v2"]],
      ["main-b", []],
    ]);
  });

  it("shows a variant whose main is missing as a main of its own", () => {
    const groups = groupOpponents([opponent("orphan", { variantOf: "deleted" })]);
    expect(groups.map((group) => group.main.id)).toEqual(["orphan"]);
  });
});

describe("asVariantOf / clearCopiedPlanFlag", () => {
  it("copies the main's plans the variant doesn't have yet and flags them as copied", () => {
    const main = opponent("main", { plansByTeamId: { "team-1": PLAN, "team-2": PLAN } });
    const existingPlan = { ...PLAN, notes: "mine" };
    const variant = asVariantOf(opponent("v", { plansByTeamId: { "team-2": existingPlan } }), main, "now");

    expect(variant.variantOf).toBe("main");
    expect(variant.plansByTeamId["team-1"]).toEqual(PLAN);
    expect(variant.plansByTeamId["team-1"]).not.toBe(PLAN);
    expect(variant.plansByTeamId["team-2"]).toBe(existingPlan);
    expect(variant.copiedPlanFrom).toEqual({ "team-1": "main" });
  });

  it("leaves copiedPlanFrom off entirely when nothing was copied", () => {
    expect("copiedPlanFrom" in asVariantOf(opponent("v"), opponent("main"), "now")).toBe(false);
  });

  it("drops the copied flag once that plan is edited", () => {
    const flagged = opponent("v", { copiedPlanFrom: { "team-1": "main", "team-2": "main" } });
    expect(clearCopiedPlanFlag(flagged, "team-1").copiedPlanFrom).toEqual({ "team-2": "main" });
    expect("copiedPlanFrom" in clearCopiedPlanFlag(clearCopiedPlanFlag(flagged, "team-1"), "team-2")).toBe(false);
  });
});

describe("promoteVariant", () => {
  it("gives the new main the group's list position and repoints everyone else at it", () => {
    const group = {
      main: opponent("main", { sortOrder: 50 }),
      variants: [opponent("v1", { variantOf: "main", sortOrder: 3 }), opponent("v2", { variantOf: "main" })],
    };
    const changed = new Map(promoteVariant(group, "v1", "now").map((o) => [o.id, o]));

    expect(changed.get("v1")).toMatchObject({ sortOrder: 50 });
    expect("variantOf" in changed.get("v1")!).toBe(false);
    expect(changed.get("main")).toMatchObject({ variantOf: "v1", sortOrder: 3 });
    expect(changed.get("v2")?.variantOf).toBe("v1");
  });
});
