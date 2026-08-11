import { describe, expect, it } from "vitest";
import { isLikelyMegaStoneItem, MEGA_STONE_SUFFIX_BY_ITEM } from "./megaStones";

describe("isLikelyMegaStoneItem", () => {
  it("recognizes a known classic Mega Stone", () => {
    expect(isLikelyMegaStoneItem("Garchompite")).toBe(true);
  });

  it("recognizes a Pokémon Champions/Legends Z-A Mega Stone", () => {
    // Froslass never had an official Mega form before Pokémon Champions —
    // verified real (not a typo/homebrew) and now in MEGA_STONE_SUFFIX_BY_ITEM.
    expect(MEGA_STONE_SUFFIX_BY_ITEM["froslassite"]).toBe("Mega");
    expect(isLikelyMegaStoneItem("Froslassite")).toBe(true);
  });

  it("still recognizes an item as *some* Mega Stone even if it's newer than this table", () => {
    // A synthetic example standing in for a future Mega Stone not added yet —
    // MEGA_STONE_SUFFIX_BY_ITEM can't resolve its form, but the naming pattern
    // alone is enough to know it's a Mega Stone.
    expect(MEGA_STONE_SUFFIX_BY_ITEM["pikachuite"]).toBeUndefined();
    expect(isLikelyMegaStoneItem("Pikachuite")).toBe(true);
  });

  it("doesn't false-positive on an ordinary held item", () => {
    expect(isLikelyMegaStoneItem("Leftovers")).toBe(false);
    expect(isLikelyMegaStoneItem("Choice Scarf")).toBe(false);
    expect(isLikelyMegaStoneItem("Sitrus Berry")).toBe(false);
  });
});
