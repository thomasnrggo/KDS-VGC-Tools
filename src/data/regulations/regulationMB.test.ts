import { describe, expect, it } from "vitest";
import speciesData from "../species.json";
import baseStatsData from "../baseStats.json";
import speciesTypesData from "../speciesTypes.json";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import {
  REGULATION_M_B_SPECIES_KEYS,
  REGULATION_M_B_MEGA_STONE_SPECIES,
  megaStoneItemsForSpecies,
} from "./regulationMB";

const SPECIES_KEYS = new Set(Object.keys(speciesData));
const BASE_STATS_KEYS = new Set(Object.keys(baseStatsData));
const SPECIES_TYPES_KEYS = new Set(Object.keys(speciesTypesData));

describe("REGULATION_M_B_SPECIES_KEYS", () => {
  it("has 235 unique entries", () => {
    expect(REGULATION_M_B_SPECIES_KEYS).toHaveLength(235);
    expect(new Set(REGULATION_M_B_SPECIES_KEYS).size).toBe(235);
  });

  it("every key exists in species.json, baseStats.json, and speciesTypes.json", () => {
    for (const key of REGULATION_M_B_SPECIES_KEYS) {
      expect(SPECIES_KEYS.has(key), `species.json missing "${key}"`).toBe(true);
      expect(BASE_STATS_KEYS.has(key), `baseStats.json missing "${key}"`).toBe(true);
      expect(SPECIES_TYPES_KEYS.has(key), `speciesTypes.json missing "${key}"`).toBe(true);
    }
  });

  it("every key round-trips through formatSpeciesDisplayName + normalizeSpeciesKey", () => {
    for (const key of REGULATION_M_B_SPECIES_KEYS) {
      expect(normalizeSpeciesKey(formatSpeciesDisplayName(key))).toBe(key);
    }
  });
});

describe("REGULATION_M_B_MEGA_STONE_SPECIES", () => {
  it("every mapped species is itself a legal Regulation M-B species", () => {
    const legalSpecies = new Set(REGULATION_M_B_SPECIES_KEYS);
    for (const species of Object.values(REGULATION_M_B_MEGA_STONE_SPECIES)) {
      expect(legalSpecies.has(species), `"${species}" not in REGULATION_M_B_SPECIES_KEYS`).toBe(
        true,
      );
    }
  });

  it("covers exactly 73 unique species across 75 items (Charizard/Raichu each have 2)", () => {
    const items = Object.keys(REGULATION_M_B_MEGA_STONE_SPECIES);
    const species = new Set(Object.values(REGULATION_M_B_MEGA_STONE_SPECIES));
    expect(items).toHaveLength(75);
    expect(species.size).toBe(73);
  });

  it("megaStoneItemsForSpecies returns the right stone(s)", () => {
    expect(megaStoneItemsForSpecies("charizard")).toEqual(["Charizardite X", "Charizardite Y"]);
    expect(megaStoneItemsForSpecies("raichu")).toEqual(["Raichunite X", "Raichunite Y"]);
    expect(megaStoneItemsForSpecies("sableye")).toEqual(["Sablenite"]);
    expect(megaStoneItemsForSpecies("pikachu")).toEqual([]);
  });
});
