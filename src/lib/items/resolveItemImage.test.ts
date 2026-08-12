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

  it("adds a local fallback image for a Mega Stone with no PokeAPI art yet", () => {
    expect(resolveItemImage("Staraptite")).toEqual({
      imageUrl: `${IMAGE_BASE}/staraptite.png`,
      fallbackImageUrl: "/items/mega-stones/staraptite.png",
    });
  });

  it("strips the hyphen from a gendered/lettered Mega Stone key for the local fallback filename", () => {
    expect(resolveItemImage("Raichunite X")).toEqual({
      imageUrl: `${IMAGE_BASE}/raichunite-x.png`,
      fallbackImageUrl: "/items/mega-stones/raichunitex.png",
    });
    expect(resolveItemImage("Garchompite Z")).toEqual({
      imageUrl: `${IMAGE_BASE}/garchompite-z.png`,
      fallbackImageUrl: "/items/mega-stones/garchompitez.png",
    });
  });

  it("has no fallback for an ordinary item or a Mega Stone that already has PokeAPI art", () => {
    expect(resolveItemImage("Choice Scarf")?.fallbackImageUrl).toBeUndefined();
    expect(resolveItemImage("Charizardite Y")?.fallbackImageUrl).toBeUndefined();
  });

  it("adds a local fallback for a non-Mega-Stone item missing from PokeAPI (Fairy Feather)", () => {
    expect(resolveItemImage("Fairy Feather")).toEqual({
      imageUrl: `${IMAGE_BASE}/fairy-feather.png`,
      fallbackImageUrl: "/items/fairyfeather.png",
    });
  });
});
