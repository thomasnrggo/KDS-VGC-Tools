import { describe, expect, it } from "vitest";
import { computeSpeedTierRows } from "./computeSpeedTiers";
import { megaStoneItemsForSpecies } from "@/data/regulations/regulationMB";

describe("computeSpeedTierRows", () => {
  it("computes every Speed configuration for a base-form Pokémon with no Mega form", () => {
    // Ditto has no Mega Stone in Regulation M-B, so it should produce exactly one row.
    const rows = computeSpeedTierRows(["ditto"], megaStoneItemsForSpecies);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "ditto",
      speciesKey: "ditto",
      speciesName: "Ditto",
      item: undefined,
      name: "Ditto",
      isMega: false,
      baseSpe: 48,
      maxSpeed: 110,
      neutral32: 100,
      neutral0: 68,
      maxScarf: Math.floor(110 * 1.5),
      neutral32Scarf: Math.floor(100 * 1.5),
    });
  });

  it("adds one extra row per legal Mega Stone, with both Scarf columns null", () => {
    // Garchomp has exactly one Mega form (Garchompite) in Regulation M-B.
    // Mega Garchomp's own base Spe (92) is lower than base Garchomp's (102) —
    // deliberately not reusing the base-form numbers, this is its own form.
    const rows = computeSpeedTierRows(["garchomp"], megaStoneItemsForSpecies);

    expect(rows).toHaveLength(2);
    expect(rows[0].isMega).toBe(false);
    expect(rows[1]).toEqual({
      id: "garchomp-garchompite",
      speciesKey: "garchomp",
      speciesName: "Garchomp",
      item: "Garchompite",
      name: "Mega Garchomp",
      isMega: true,
      baseSpe: 92,
      maxSpeed: 158,
      neutral32: 144,
      neutral0: 112,
      maxScarf: null,
      neutral32Scarf: null,
    });
  });

  it("labels X/Y Mega rows with the stone's letter", () => {
    const rows = computeSpeedTierRows(["charizard"], megaStoneItemsForSpecies);
    const names = rows.map((row) => row.name);

    expect(names).toEqual(["Charizard", "Mega Charizard X", "Mega Charizard Y"]);
  });

  it("preserves input order and species-key casing/hyphenation in the display name", () => {
    const rows = computeSpeedTierRows(["raichu-alola", "abra"], megaStoneItemsForSpecies);

    expect(rows.map((row) => row.name)).toEqual(["Raichu-Alola", "Abra"]);
    expect(rows.map((row) => row.speciesKey)).toEqual(["raichu-alola", "abra"]);
  });
});
