import { describe, expect, it } from "vitest";
import { formatPokemonPaste, formatTeamPaste } from "./formatPokemonPaste";
import { parsePokemonBlock, parseTeam } from "./parseTeam";

describe("formatPokemonPaste", () => {
  it("round-trips a full pasted Pokémon back into the same shape (minus untracked fields)", () => {
    const pokemon = parsePokemonBlock(
      `Charizard (M) @ Charizardite Y
Ability: Blaze
Level: 50
Shiny: Yes
EVs: 17 HP / 25 Def / 11 SpA / 13 Spe
Modest Nature
- Heat Wave
- Weather Ball
- Solar Beam
- Protect`,
    );

    expect(formatPokemonPaste(pokemon)).toBe(
      `Charizard @ Charizardite Y
Ability: Blaze
Level: 50
EVs: 17 HP / 25 Def / 11 SpA / 13 Spe
Modest Nature
- Heat Wave
- Weather Ball
- Solar Beam
- Protect`,
    );
  });

  it("omits the EVs line entirely when every Stat Point is 0", () => {
    const pokemon = { species: "Ditto", nature: "Hardy" };
    expect(formatPokemonPaste(pokemon)).toBe(`Ditto
Level: 50
Hardy Nature`);
  });

  it("omits Ability and item lines when neither is set", () => {
    const pokemon = { species: "Ditto", nature: "Hardy", moves: ["Transform"] };
    expect(formatPokemonPaste(pokemon)).toBe(`Ditto
Level: 50
Hardy Nature
- Transform`);
  });

  it("only lists non-zero Stat Points, in the standard HP/Atk/Def/SpA/SpD/Spe order", () => {
    const pokemon = { species: "Ditto", nature: "Hardy", evs: "0 HP / 0 Atk / 5 Def / 0 SpA / 0 SpD / 3 Spe" };
    expect(formatPokemonPaste(pokemon)).toBe(`Ditto
Level: 50
EVs: 5 Def / 3 Spe
Hardy Nature`);
  });
});

describe("formatTeamPaste", () => {
  it("joins multiple Pokémon with a blank line, round-tripping through parseTeam", () => {
    const raw = `Pikachu @ Light Ball
Ability: Static
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Volt Tackle

Incineroar @ Sitrus Berry
Ability: Intimidate
EVs: 244 HP / 4 Atk / 4 SpD
Careful Nature
- Fake Out
- Parting Shot`;

    const team = parseTeam(raw);
    const exported = formatTeamPaste(team);

    expect(exported).toBe(`Pikachu @ Light Ball
Ability: Static
Level: 50
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Volt Tackle

Incineroar @ Sitrus Berry
Ability: Intimidate
Level: 50
EVs: 244 HP / 4 Atk / 4 SpD
Careful Nature
- Fake Out
- Parting Shot`);

    expect(parseTeam(exported)).toEqual(team);
  });

  it("returns an empty string for an empty roster", () => {
    expect(formatTeamPaste([])).toBe("");
  });
});
