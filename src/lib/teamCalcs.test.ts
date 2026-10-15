import { describe, expect, it } from "vitest";
import {
  calcsAgainst,
  calcThreat,
  findCalcSpecies,
  parseCalcLine,
  parseCalcPaste,
} from "./teamCalcs";
import { parseTeam } from "./parseTeam";

const MY_TEAM = parseTeam(
  [
    "Charizard @ Charizardite Y",
    "Farigiraf @ Sitrus Berry",
    "Garchomp @ Garchompite Z",
    "Incineroar @ Sitrus Berry",
    "Rillaboom @ Miracle Seed",
    "Sylveon @ Fairy Feather",
  ].join("\n\n"),
);

// Excerpt of a real prep document, quirks included (a stray "'+", a
// comment line, a Spanish note at the end of a calc).
const PASTE = `https://pokepast.es/2189336ac9f03dba

Charizard
Defensive
32+ Atk Tough Claws Lycanroc-Dusk Accelerock vs. 16 HP / 18 Def Mega Charizard Y: 192-228 (113.6 - 134.9%) -- guaranteed OHKO
1 1 SpA Archaludon Electro Shot vs. 16 HP / 0 SpD Mega Charizard Y: 158-188 (93.4 - 111.2%) -- 62.5% chance to OHKO'+
Garchomp
Offensive
19+ SpA Mega Garchomp Z Helping Hand Earth Power vs. 32 HP / 2 SpD Kingambit: 188-222 (90.8 - 107.2%) -- 43.75% chance to OHKO
Defensive
28+ Atk Life Orb Adaptability Basculegion Last Respects vs. 1 HP / 0 Def Mega Garchomp Z: 164-195 (89.1 - 105.9%) -- 37.5% chance to OHKO
;)
Incineroar
Offensive
3 Atk Incineroar Flare Blitz vs. 27 HP / 0 Def Gholdengo: 164-194 (86.7 - 102.6%) -- 68.75% chance to OHKO (teniendo en cuenta el RECOIL de LIFEORB).
`;

describe("findCalcSpecies", () => {
  it("prefers the longest name and reads Mega forms for the sprite", () => {
    expect(findCalcSpecies("32+ Atk Tough Claws Lycanroc-Dusk Accelerock")).toEqual({
      spriteKey: "lycanroc-dusk",
      identity: "lycanroc-dusk",
    });
    expect(findCalcSpecies("16 HP / 0 SpD Mega Charizard Y")).toEqual({
      spriteKey: "charizard-mega-y",
      identity: "charizard",
    });
    expect(findCalcSpecies("32+ SpA Fairy Aura Mega Floette Light of Ruin")?.identity).toBe(
      "floette",
    );
    expect(findCalcSpecies("4 HP / 14 Def Basculegion-F")?.identity).toBe("basculegion-female");
  });
});

describe("parseCalcLine", () => {
  it("reads attacker, defender, range and verdict", () => {
    const parsed = parseCalcLine(
      "32 Atk Tyranitar Knock Off (97.5 BP) vs. 31 HP / 28 Def Farigiraf: 174-206 (76.9 - 91.1%) -- guaranteed 2HKO after sandstorm damage",
    );
    expect(parsed.attacker?.identity).toBe("tyranitar");
    expect(parsed.defender?.identity).toBe("farigiraf");
    expect(parsed.percent).toBe("76.9 - 91.1%");
    expect(parsed.verdict).toBe("guaranteed 2HKO after sandstorm damage");
  });

  it("returns nothing for a non-calc line", () => {
    expect(parseCalcLine(";)")).toEqual({});
  });
});

describe("parseCalcPaste", () => {
  it("files lines under section headers and sides, keeping comments and dropping the URL", () => {
    const { calcs, calcCount } = parseCalcPaste(PASTE, MY_TEAM);
    expect(calcCount).toBe(5);
    expect(calcs.map((c) => [c.species, c.side, c.text.slice(0, 12)])).toEqual([
      ["charizard", "defensive", "32+ Atk Toug"],
      ["charizard", "defensive", "1 1 SpA Arch"],
      ["garchomp", "offensive", "19+ SpA Mega"],
      ["garchomp", "defensive", "28+ Atk Life"],
      ["garchomp", "defensive", ";)"],
      ["incineroar", "offensive", "3 Atk Incine"],
    ]);
  });

  it("infers the Pokémon and side of a calc outside any section", () => {
    const { calcs } = parseCalcPaste(
      "32+ Atk Sneasler Dire Claw vs. 13 HP / 32 Def Sylveon: 156-186 (85.2 - 101.6%) -- 6.25% chance to OHKO",
      MY_TEAM,
    );
    expect(calcs[0]).toMatchObject({ species: "sylveon", side: "defensive" });
  });

  it("keeps a comment that mentions a Pokémon as a comment", () => {
    const { calcs } = parseCalcPaste("Charizard\nwatch out for Kingambit", MY_TEAM);
    expect(calcs).toMatchObject([{ species: "charizard", text: "watch out for Kingambit" }]);
  });
});

describe("calcsAgainst", () => {
  it("keeps the calcs whose threat is on the opponent's roster", () => {
    const { calcs } = parseCalcPaste(PASTE, MY_TEAM);
    const opponent = parseTeam("Basculegion @ Life Orb\n\nKingambit @ Black Glasses");
    expect(calcsAgainst(calcs, opponent).map((c) => calcThreat(c)?.identity)).toEqual([
      "kingambit",
      "basculegion",
    ]);
  });
});

describe("parseCalcLine's % range", () => {
  it("also reads a range with a % after both numbers", () => {
    expect(
      parseCalcLine(
        "32 Atk Basculegion Wave Crash vs. 0 HP / 0 Def Sneasler: 204-240 (131.6% - 154.8%) -- guaranteed OHKO",
      ).percent,
    ).toBe("131.6 - 154.8%");
  });
});
