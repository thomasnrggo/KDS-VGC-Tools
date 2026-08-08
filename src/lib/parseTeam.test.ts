import { describe, expect, it } from "vitest";
import { parseTeam, parsePokemonBlock } from "./parseTeam";

const SAMPLE_PASTE = `
Grimmsnarl @ Light Clay
Ability: Prankster
Shiny: Yes
EVs: 32 HP / 20 Def / 14 SpD
Calm Nature
- Foul Play
- Parting Shot
- Reflect
- Light Screen

Swampert (M) @ Swampertite
Ability: Damp
EVs: 18 HP / 30 Atk / 18 Spe
Adamant Nature
- Wave Crash
- Earthquake
- Ice Punch
- Protect

Pelipper (M) @ Sitrus Berry
Ability: Drizzle
EVs: 32 HP / 1 Def / 5 SpA / 17 SpD / 11 Spe
Modest Nature
- Hurricane
- Weather Ball
- Tailwind
- Wide Guard

Archaludon (M) @ Leftovers
Ability: Stamina
Shiny: Yes
EVs: 32 HP / 1 SpA / 29 SpD / 4 Spe
Modest Nature
- Electro Shot
- Dragon Pulse
- Flash Cannon
- Protect

Sinistcha @ Colbur Berry
Ability: Hospitality
Shiny: Yes
EVs: 32 HP / 2 Def / 30 SpD / 2 Spe
Bold Nature
- Matcha Gotcha
- Rage Powder
- Trick Room
- Protect

Metagross @ Metagrossite
Ability: Clear Body
Shiny: Yes
EVs: 14 HP / 27 Atk / 25 Spe
Jolly Nature
- Iron Head
- Psychic Fangs
- Body Press
- Protect
`.trim();

describe("parseTeam", () => {
  it("parses a full Showdown export into species + item pairs", () => {
    expect(parseTeam(SAMPLE_PASTE)).toEqual([
      { species: "Grimmsnarl", item: "Light Clay" },
      { species: "Swampert", item: "Swampertite" },
      { species: "Pelipper", item: "Sitrus Berry" },
      { species: "Archaludon", item: "Leftovers" },
      { species: "Sinistcha", item: "Colbur Berry" },
      { species: "Metagross", item: "Metagrossite" },
    ]);
  });

  it("ignores a leading === [format] Title === header block", () => {
    const withHeader = `=== [gen9vgc2024] My Team ===\n\n${SAMPLE_PASTE}`;
    expect(parseTeam(withHeader)).toHaveLength(6);
  });
});

describe("parsePokemonBlock", () => {
  it("parses a species with no item", () => {
    expect(parsePokemonBlock("Ditto\nAbility: Imposter")).toEqual({
      species: "Ditto",
    });
  });

  it("parses a species with an item and no gender", () => {
    expect(parsePokemonBlock("Grimmsnarl @ Light Clay")).toEqual({
      species: "Grimmsnarl",
      item: "Light Clay",
    });
  });

  it("strips a trailing gender marker", () => {
    expect(parsePokemonBlock("Swampert (M) @ Swampertite")).toEqual({
      species: "Swampert",
      item: "Swampertite",
    });
  });

  it("unwraps a nickname, keeping the species in parens", () => {
    expect(parsePokemonBlock("Sparky (Raichu) @ Light Ball")).toEqual({
      species: "Raichu",
      item: "Light Ball",
    });
  });

  it("unwraps a nickname with a gender marker", () => {
    expect(parsePokemonBlock("Sparky (Raichu) (M) @ Light Ball")).toEqual({
      species: "Raichu",
      item: "Light Ball",
    });
  });

  it("handles multi-word items and hyphenated species", () => {
    expect(parsePokemonBlock("Landorus-Therian @ Choice Scarf")).toEqual({
      species: "Landorus-Therian",
      item: "Choice Scarf",
    });
  });
});
