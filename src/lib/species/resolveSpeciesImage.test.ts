import { describe, expect, it } from "vitest";
import { resolveSpeciesImage } from "./resolveSpeciesImage";

const IMAGE_BASE = "/pokemon-sprites/thumbnails-compressed";

describe("resolveSpeciesImage", () => {
  it("resolves a base-form species with no item", () => {
    expect(resolveSpeciesImage("Sinistcha")).toEqual({
      dexId: 1013,
      formSuffix: undefined,
      imageUrl: `${IMAGE_BASE}/1013.png`,
    });
  });

  it("ignores an unrelated item for a base-form species", () => {
    expect(resolveSpeciesImage("Grimmsnarl", "Light Clay")).toEqual({
      dexId: 861,
      formSuffix: undefined,
      imageUrl: `${IMAGE_BASE}/0861.png`,
    });
  });

  it("resolves a regional form directly", () => {
    const result = resolveSpeciesImage("Ninetales-Alola");
    expect(result?.formSuffix).toBe("Alola");
    expect(result?.imageUrl).toBe(`${IMAGE_BASE}/0038-Alola.png`);
  });

  it("resolves a Gmax form directly", () => {
    const result = resolveSpeciesImage("Charizard-Gmax");
    expect(result?.formSuffix).toBe("Gmax");
    expect(result?.imageUrl).toBe(`${IMAGE_BASE}/0006-Gmax.png`);
  });

  it("infers a Mega form from a held Mega Stone", () => {
    expect(resolveSpeciesImage("Metagross", "Metagrossite")).toEqual({
      dexId: 376,
      formSuffix: "Mega",
      imageUrl: `${IMAGE_BASE}/0376-Mega.png`,
    });
  });

  it("infers Blastoise's Mega form from its real item name, Blastoisinite", () => {
    // Not "Blastoisite" — a common misspelling (verified against Bulbapedia).
    expect(resolveSpeciesImage("Blastoise", "Blastoisinite")).toEqual({
      dexId: 9,
      formSuffix: "Mega",
      imageUrl: `${IMAGE_BASE}/0009-Mega.png`,
    });
  });

  it("distinguishes Mega-X from Mega-Y via the specific stone", () => {
    expect(resolveSpeciesImage("Charizard", "Charizardite X")?.formSuffix).toBe("Mega-X");
    expect(resolveSpeciesImage("Charizard", "Charizardite Y")?.formSuffix).toBe("Mega-Y");
  });

  it("resolves gendered-form aliases (Showdown's -F suffix)", () => {
    const result = resolveSpeciesImage("Indeedee-F");
    expect(result?.dexId).toBe(876);
    expect(result?.formSuffix).toBe("Female");
  });

  it("resolves Necrozma's fused formes via alias", () => {
    expect(resolveSpeciesImage("Necrozma-Dusk-Mane")?.formSuffix).toBe("Dusk");
    expect(resolveSpeciesImage("Necrozma-Dawn-Wings")?.formSuffix).toBe("Dawn");
  });

  it("resolves Florges' cosmetic color forms to the base sprite via alias", () => {
    expect(resolveSpeciesImage("Florges-White")).toEqual({
      dexId: 671,
      formSuffix: undefined,
      imageUrl: `${IMAGE_BASE}/0671.png`,
    });
    expect(resolveSpeciesImage("Florges-Blue")?.dexId).toBe(671);
    expect(resolveSpeciesImage("Florges-Orange")?.dexId).toBe(671);
    expect(resolveSpeciesImage("Florges-Yellow")?.dexId).toBe(671);
  });

  it("resolves Maushold's Family of Four cosmetic form via alias", () => {
    expect(resolveSpeciesImage("Maushold-Four")).toEqual({
      dexId: 925,
      formSuffix: undefined,
      imageUrl: `${IMAGE_BASE}/0925.png`,
    });
  });

  it("returns null for an unknown species instead of throwing", () => {
    expect(resolveSpeciesImage("Not-A-Real-Pokemon")).toBeNull();
  });
});
