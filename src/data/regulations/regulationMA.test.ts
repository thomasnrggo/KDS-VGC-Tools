import { describe, expect, it } from "vitest";
import speciesData from "../species.json";
import baseStatsData from "../baseStats.json";
import speciesTypesData from "../speciesTypes.json";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { REGULATION_M_B_SPECIES_KEYS, REGULATION_M_B_HELD_ITEMS } from "./regulationMB";
import {
  REGULATION_M_A_SPECIES_KEYS,
  REGULATION_M_A_HELD_ITEMS,
  REGULATION_M_A_MEGA_STONE_SPECIES,
  megaStoneItemsForSpeciesMA,
} from "./regulationMA";

const SPECIES_KEYS = new Set(Object.keys(speciesData));
const BASE_STATS_KEYS = new Set(Object.keys(baseStatsData));
const SPECIES_TYPES_KEYS = new Set(Object.keys(speciesTypesData));

describe("REGULATION_M_A_SPECIES_KEYS", () => {
  it("has 213 unique entries", () => {
    expect(REGULATION_M_A_SPECIES_KEYS).toHaveLength(213);
    expect(new Set(REGULATION_M_A_SPECIES_KEYS).size).toBe(213);
  });

  it("every key exists in species.json, baseStats.json, and speciesTypes.json", () => {
    for (const key of REGULATION_M_A_SPECIES_KEYS) {
      expect(SPECIES_KEYS.has(key), `species.json missing "${key}"`).toBe(true);
      expect(BASE_STATS_KEYS.has(key), `baseStats.json missing "${key}"`).toBe(true);
      expect(SPECIES_TYPES_KEYS.has(key), `speciesTypes.json missing "${key}"`).toBe(true);
    }
  });

  it("every key round-trips through formatSpeciesDisplayName + normalizeSpeciesKey", () => {
    for (const key of REGULATION_M_A_SPECIES_KEYS) {
      expect(normalizeSpeciesKey(formatSpeciesDisplayName(key))).toBe(key);
    }
  });

  it("is an exact subset of Regulation M-B's species list (M-A predates M-B, never adds anything M-B lacks)", () => {
    const mbKeys = new Set(REGULATION_M_B_SPECIES_KEYS);
    for (const key of REGULATION_M_A_SPECIES_KEYS) {
      expect(mbKeys.has(key), `"${key}" is M-A-legal but not in REGULATION_M_B_SPECIES_KEYS`).toBe(
        true,
      );
    }
  });
});

describe("REGULATION_M_A_HELD_ITEMS", () => {
  it("excludes Life Orb (banned in M-A, only legalized in M-B) but keeps everything else M-B has", () => {
    expect(REGULATION_M_A_HELD_ITEMS).not.toContain("Life Orb");
    const mbMinusLifeOrb = REGULATION_M_B_HELD_ITEMS.filter((item) => item !== "Life Orb");
    expect(REGULATION_M_A_HELD_ITEMS).toEqual(mbMinusLifeOrb);
  });
});

describe("REGULATION_M_A_MEGA_STONE_SPECIES", () => {
  it("every mapped species is itself a legal Regulation M-A species", () => {
    const legalSpecies = new Set(REGULATION_M_A_SPECIES_KEYS);
    for (const species of Object.values(REGULATION_M_A_MEGA_STONE_SPECIES)) {
      expect(legalSpecies.has(species), `"${species}" not in REGULATION_M_A_SPECIES_KEYS`).toBe(
        true,
      );
    }
  });

  it("excludes Raichu (Mega Raichu was a M-B addition, per metavgc.com's M-B changelog and Bulbapedia's M-A Mega Evolutions list)", () => {
    const species = new Set(Object.values(REGULATION_M_A_MEGA_STONE_SPECIES));
    expect(species.has("raichu")).toBe(false);
  });

  it("covers 59 items across 58 unique species (Charizard has 2) — see regulationMA.ts's header comment on the one unresolved 58-vs-59 source disagreement", () => {
    const items = Object.keys(REGULATION_M_A_MEGA_STONE_SPECIES);
    const species = new Set(Object.values(REGULATION_M_A_MEGA_STONE_SPECIES));
    expect(items).toHaveLength(59);
    expect(species.size).toBe(58);
  });

  it("megaStoneItemsForSpeciesMA returns the right stone(s)", () => {
    expect(megaStoneItemsForSpeciesMA("charizard")).toEqual(["Charizardite X", "Charizardite Y"]);
    expect(megaStoneItemsForSpeciesMA("raichu")).toEqual([]);
    expect(megaStoneItemsForSpeciesMA("sableye")).toEqual(["Sablenite"]);
    expect(megaStoneItemsForSpeciesMA("pikachu")).toEqual([]);
    // Swampert is one of the 22 species M-B added that M-A never had at all
    // (not even as a base form) — so no stone under M-A either.
    expect(megaStoneItemsForSpeciesMA("swampert")).toEqual([]);
  });
});
