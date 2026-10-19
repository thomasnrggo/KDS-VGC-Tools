import { describe, expect, it } from "vitest";
import { megaDisplayName, speciesNamesMegaForm, stripMegaSuffix } from "./megaForm";

describe("speciesNamesMegaForm", () => {
  it("is true for a species name that already ends in -Mega", () => {
    expect(speciesNamesMegaForm("Golisopod-Mega")).toBe(true);
  });

  it("is true for -Mega-X/-Mega-Y double-Mega forms", () => {
    expect(speciesNamesMegaForm("Charizard-Mega-X")).toBe(true);
    expect(speciesNamesMegaForm("Charizard-Mega-Y")).toBe(true);
  });

  it("is true for the Champions-only -Mega-Z forms (Absol/Garchomp/Lucario)", () => {
    expect(speciesNamesMegaForm("Lucario-Mega-Z")).toBe(true);
    expect(speciesNamesMegaForm("Absol-Mega-Z")).toBe(true);
    expect(speciesNamesMegaForm("Garchomp-Mega-Z")).toBe(true);
  });

  it("is false for a plain base species", () => {
    expect(speciesNamesMegaForm("Golisopod")).toBe(false);
    expect(speciesNamesMegaForm("Charizard")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(speciesNamesMegaForm("golisopod-mega")).toBe(true);
  });
});

describe("stripMegaSuffix", () => {
  it("strips a trailing -Mega suffix", () => {
    expect(stripMegaSuffix("Golisopod-Mega")).toBe("Golisopod");
  });

  it("strips a trailing -Mega-X/-Mega-Y suffix", () => {
    expect(stripMegaSuffix("Charizard-Mega-X")).toBe("Charizard");
    expect(stripMegaSuffix("Charizard-Mega-Y")).toBe("Charizard");
  });

  it("strips a trailing -Mega-Z suffix", () => {
    expect(stripMegaSuffix("Lucario-Mega-Z")).toBe("Lucario");
  });

  it("is a no-op when the species doesn't name a Mega form", () => {
    expect(stripMegaSuffix("Golisopod")).toBe("Golisopod");
  });

  it("only strips a trailing suffix, not one appearing mid-string", () => {
    expect(stripMegaSuffix("Mega-Man")).toBe("Mega-Man");
  });
});

describe("megaDisplayName", () => {
  it("names the Mega form when the species holds its own Mega Stone", () => {
    expect(megaDisplayName("Staraptor", "Staraptite")).toBe("Mega Staraptor");
    expect(megaDisplayName("Charizard", "Charizardite Y")).toBe("Mega Charizard Y");
  });

  it("names the Mega form when the species name already is one", () => {
    expect(megaDisplayName("Charizard-Mega-X")).toBe("Mega Charizard X");
    expect(megaDisplayName("Golisopod-Mega")).toBe("Mega Golisopod");
  });

  it("is null without a Mega Stone, or for a species with no Mega form", () => {
    expect(megaDisplayName("Staraptor")).toBeNull();
    expect(megaDisplayName("Staraptor", "Leftovers")).toBeNull();
    expect(megaDisplayName("Incineroar", "Staraptite")).toBeNull();
  });
});
