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
      minSpeed: Math.floor(68 * 0.9),
      maxScarf: Math.floor(110 * 1.5),
      neutral32Scarf: Math.floor(100 * 1.5),
      special: null,
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
      minSpeed: Math.floor(112 * 0.9),
      maxScarf: null,
      neutral32Scarf: null,
      // Mega Garchomp's curated ability is Sand Force (a power boost, not a
      // Speed doubler) — not to be confused with Sand Rush.
      special: null,
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

  describe("special (conditional Speed-doubling) column", () => {
    it("flags a base-form species whose own ability list includes a weather Speed-doubler", () => {
      // Venusaur: Overgrow / Chlorophyll (hidden) — Chlorophyll doubles Speed in Sun.
      const [venusaur] = computeSpeedTierRows(["venusaur"], megaStoneItemsForSpecies);
      expect(venusaur.special).toEqual({
        label: "Sun",
        descriptor: "in Sun",
        value: venusaur.maxSpeed * 2,
      });

      // Excadrill: Sand Rush / Sand Force / Mold Breaker — Sand Rush doubles Speed in Sand.
      const [excadrill] = computeSpeedTierRows(["excadrill"], megaStoneItemsForSpecies);
      expect(excadrill.special).toEqual({
        label: "Sand",
        descriptor: "in Sand",
        value: excadrill.maxSpeed * 2,
      });

      // Sneasler: Pressure / Unburden / Poison Touch (hidden) — Unburden doubles Speed once triggered.
      const [sneasler] = computeSpeedTierRows(["sneasler"], megaStoneItemsForSpecies);
      expect(sneasler.special).toEqual({
        label: "Unburden",
        descriptor: "once Unburden activates",
        value: sneasler.maxSpeed * 2,
      });
    });

    it("uses the Mega form's own fixed ability, not the base form's, for a Mega row", () => {
      // Base Swampert (Torrent/Damp) has no Speed-doubling ability at all —
      // Mega Swampert's curated override ability is Swift Swim, which doubles
      // Speed in Rain. The base row and Mega row must disagree here.
      const rows = computeSpeedTierRows(["swampert"], megaStoneItemsForSpecies);
      const base = rows.find((row) => !row.isMega)!;
      const mega = rows.find((row) => row.isMega)!;

      expect(base.special).toBeNull();
      expect(mega.special).toEqual({
        label: "Rain",
        descriptor: "in Rain",
        value: mega.maxSpeed * 2,
      });
    });
  });
});
