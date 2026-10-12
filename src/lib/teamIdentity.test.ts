import { describe, expect, it } from "vitest";
import { speciesIdentity, teamFingerprint } from "./teamIdentity";
import { parseTeam } from "./parseTeam";

const PERISH = `Politoed @ Sitrus Berry
Ability: Drizzle
Calm Nature
- Weather Ball
- Encore
- Perish Song
- Protect

Gengar @ Gengarite
Ability: Cursed Body
Modest Nature
- Shadow Ball
- Sludge Bomb
- Perish Song
- Protect`;

function fingerprintOf(paste: string): string {
  return teamFingerprint(parseTeam(paste));
}

describe("speciesIdentity", () => {
  it("drops a Mega suffix and normalizes", () => {
    expect(speciesIdentity("Golisopod-Mega")).toBe("golisopod");
    expect(speciesIdentity("Charizard-Mega-Y")).toBe("charizard");
  });

  it("treats Floette-Mega and Floette-Eternal as the same Pokémon", () => {
    expect(speciesIdentity("Floette-Mega")).toBe(speciesIdentity("Floette-Eternal"));
  });

  it("keeps other forms distinct", () => {
    expect(speciesIdentity("Arcanine-Hisui")).not.toBe(speciesIdentity("Arcanine"));
    expect(speciesIdentity("Basculegion-F")).not.toBe(speciesIdentity("Basculegion"));
  });
});

describe("teamFingerprint", () => {
  it("ignores slot order and move order", () => {
    const reordered = `Gengar @ Gengarite
Ability: Cursed Body
Modest Nature
- Protect
- Perish Song
- Sludge Bomb
- Shadow Ball

Politoed @ Sitrus Berry
Ability: Drizzle
Calm Nature
- Protect
- Perish Song
- Encore
- Weather Ball`;
    expect(fingerprintOf(reordered)).toBe(fingerprintOf(PERISH));
  });

  it("ignores nicknames, whitespace, and the ability/nature/Stat Points lines", () => {
    const variantPaste = `Toad (Politoed) @ Sitrus Berry
Ability: Drizzle
EVs: 32 HP / 32 SpD
Bold Nature
-   Weather Ball
- Encore
- Perish Song
- Protect

Gengar @ Gengarite
- Shadow Ball
- Sludge Bomb
- Perish Song
- Protect`;
    expect(fingerprintOf(variantPaste)).toBe(fingerprintOf(PERISH));
  });

  it("treats a different item or a different move as a different team", () => {
    expect(fingerprintOf(PERISH.replace("Sitrus Berry", "Damp Rock"))).not.toBe(fingerprintOf(PERISH));
    expect(fingerprintOf(PERISH.replace("- Encore", "- Ice Beam"))).not.toBe(fingerprintOf(PERISH));
  });

  it("matches a Mega written either way — base species + stone, or the Mega form's name", () => {
    expect(fingerprintOf("Floette-Mega (F) @ Floettite\n- Moonblast")).toBe(
      fingerprintOf("Floette-Eternal @ Floettite\n- Moonblast"),
    );
  });
});
