import { describe, expect, it } from "vitest";
import { resolveItemImage } from "./resolveItemImage";

const IMAGE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items";

describe("resolveItemImage", () => {
  it("builds a kebab-case sprite URL for a multi-word item", () => {
    expect(resolveItemImage("Choice Scarf")).toEqual({ imageUrl: `${IMAGE_BASE}/choice-scarf.png` });
  });

  it("builds a sprite URL for a single-word item", () => {
    expect(resolveItemImage("Leftovers")).toEqual({ imageUrl: `${IMAGE_BASE}/leftovers.png` });
  });

  it("strips an apostrophe", () => {
    expect(resolveItemImage("King's Rock")).toEqual({ imageUrl: `${IMAGE_BASE}/kings-rock.png` });
  });

  it("returns null for an empty item", () => {
    expect(resolveItemImage("")).toBeNull();
    expect(resolveItemImage("   ")).toBeNull();
  });
});
