import { describe, expect, it } from "vitest";
import speciesData from "../species.json";
import baseStatsData from "../baseStats.json";
import speciesTypesData from "../speciesTypes.json";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { REGULATION_M_B_SPECIES_KEYS, REGULATION_M_B_HELD_ITEMS } from "./regulationMB";
import {
  REGULATION_M_C_SPECIES_KEYS,
  REGULATION_M_C_HELD_ITEMS,
  REGULATION_M_C_BERRIES,
  REGULATION_M_C_MEGA_STONE_SPECIES,
  megaStoneItemsForSpeciesMC,
} from "./regulationMC";

const SPECIES_KEYS = new Set(Object.keys(speciesData));
const BASE_STATS_KEYS = new Set(Object.keys(baseStatsData));
const SPECIES_TYPES_KEYS = new Set(Object.keys(speciesTypesData));

describe("REGULATION_M_C_SPECIES_KEYS", () => {
  it("has 259 unique entries (M-B's 235 plus 24 new to M-C)", () => {
    expect(REGULATION_M_C_SPECIES_KEYS).toHaveLength(259);
    expect(new Set(REGULATION_M_C_SPECIES_KEYS).size).toBe(259);
  });

  it("is a strict superset of REGULATION_M_B_SPECIES_KEYS", () => {
    const mcSet = new Set(REGULATION_M_C_SPECIES_KEYS);
    for (const key of REGULATION_M_B_SPECIES_KEYS) {
      expect(mcSet.has(key), `M-C missing M-B species "${key}"`).toBe(true);
    }
  });

  it("every key exists in species.json, baseStats.json, and speciesTypes.json", () => {
    for (const key of REGULATION_M_C_SPECIES_KEYS) {
      expect(SPECIES_KEYS.has(key), `species.json missing "${key}"`).toBe(true);
      expect(BASE_STATS_KEYS.has(key), `baseStats.json missing "${key}"`).toBe(true);
      expect(SPECIES_TYPES_KEYS.has(key), `speciesTypes.json missing "${key}"`).toBe(true);
    }
  });

  it("every key round-trips through formatSpeciesDisplayName + normalizeSpeciesKey", () => {
    for (const key of REGULATION_M_C_SPECIES_KEYS) {
      expect(normalizeSpeciesKey(formatSpeciesDisplayName(key))).toBe(key);
    }
  });

  it("includes the newly-added species at their resolved keys", () => {
    for (const key of [
      "wigglytuff",
      "persian",
      "persian-alola",
      "farfetchd",
      "mr-mime",
      "swalot",
      "salamence",
      "gogoat",
      "golisopod",
      "rillaboom",
      "cinderace",
      "inteleon",
      "thievul",
      "toxtricity",
      "grapploct",
      "perrserker",
      "sirfetchd",
      "pincurchin",
      "indeedee",
      "pawmot",
      "arboliva",
      "squawkabilly",
      "mabosstiff",
      "baxcalibur",
    ]) {
      expect(REGULATION_M_C_SPECIES_KEYS, `missing "${key}"`).toContain(key);
    }
  });
});

describe("REGULATION_M_C_HELD_ITEMS", () => {
  it("is M-B's 45 items plus the 12 M-C adds, with no duplicates", () => {
    expect(REGULATION_M_C_HELD_ITEMS).toHaveLength(57);
    expect(new Set(REGULATION_M_C_HELD_ITEMS).size).toBe(57);
    for (const item of REGULATION_M_B_HELD_ITEMS) {
      expect(REGULATION_M_C_HELD_ITEMS, `missing M-B item "${item}"`).toContain(item);
    }
    for (const item of [
      "Leek",
      "Rocky Helmet",
      "Air Balloon",
      "Red Card",
      "Binding Band",
      "Eject Button",
      "Normal Gem",
      "Terrain Extender",
      "Electric Seed",
      "Psychic Seed",
      "Misty Seed",
      "Grassy Seed",
    ]) {
      expect(REGULATION_M_C_HELD_ITEMS, `missing new item "${item}"`).toContain(item);
    }
  });
});

describe("REGULATION_M_C_BERRIES", () => {
  it("has 28 entries, unchanged from M-B", () => {
    expect(REGULATION_M_C_BERRIES).toHaveLength(28);
  });
});

describe("REGULATION_M_C_MEGA_STONE_SPECIES", () => {
  it("every mapped species is itself a legal Regulation M-C species", () => {
    const legalSpecies = new Set(REGULATION_M_C_SPECIES_KEYS);
    for (const species of Object.values(REGULATION_M_C_MEGA_STONE_SPECIES)) {
      expect(legalSpecies.has(species), `"${species}" not in REGULATION_M_C_SPECIES_KEYS`).toBe(
        true,
      );
    }
  });

  it("covers 81 items across 76 species (M-B's 75/73 plus the 6/3 M-C adds)", () => {
    const items = Object.keys(REGULATION_M_C_MEGA_STONE_SPECIES);
    const species = new Set(Object.values(REGULATION_M_C_MEGA_STONE_SPECIES));
    expect(items).toHaveLength(81);
    expect(species.size).toBe(76);
  });

  it("megaStoneItemsForSpeciesMC returns the right stone(s)", () => {
    // Inherited from M-B, unchanged.
    expect(megaStoneItemsForSpeciesMC("charizard")).toEqual(["Charizardite X", "Charizardite Y"]);
    // New wholly-added Mega species.
    expect(megaStoneItemsForSpeciesMC("salamence")).toEqual(["Salamencite"]);
    expect(megaStoneItemsForSpeciesMC("golisopod")).toEqual(["Golisopite"]);
    expect(megaStoneItemsForSpeciesMC("baxcalibur")).toEqual(["Baxcalibrite"]);
    // Already-legal-in-M-B species that gain a new "Z Mega Evolution" stone
    // on top of their existing one.
    expect(megaStoneItemsForSpeciesMC("absol")).toEqual(["Absolite", "Absolite Z"]);
    expect(megaStoneItemsForSpeciesMC("garchomp")).toEqual(["Garchompite", "Garchompite Z"]);
    expect(megaStoneItemsForSpeciesMC("lucario")).toEqual(["Lucarionite", "Lucarionite Z"]);
    // No legal Mega form.
    expect(megaStoneItemsForSpeciesMC("pikachu")).toEqual([]);
  });
});
