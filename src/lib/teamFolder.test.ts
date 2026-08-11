import { describe, expect, it } from "vitest";
import { parseTeamFolder } from "./teamFolder";
import { parseTeam } from "./parseTeam";

const FOLDER_EXPORT = `
Pokémon Showdown! (beta)
Home
Teambuilder

thomasnrg
List
=== [gen9championsvgc2026regmb] M-B best teams/Rank #1 FloetteMega Garchomp ===

Floette-Eternal (F) @ Floettite
Ability: Flower Veil
Level: 50
EVs: 22 HP / 22 Def / 1 SpA / 21 Spe
Timid Nature
- Draining Kiss
- Dazzling Gleam
- Calm Mind
- Protect

Incineroar (M) @ Leftovers
Ability: Intimidate
Level: 50
EVs: 32 HP / 2 Atk / 16 Def / 16 SpD
Careful Nature
- Helping Hand
- Flare Blitz
- Fake Out
- Parting Shot


=== [gen9championsvgc2026regmb] M-B best teams/Rank #2 Mega Staraptor-Scizor ===

Staraptor (M) @ Staraptite
Ability: Intimidate
Level: 50
EVs: 27 HP / 14 Atk / 25 Spe
Jolly Nature
- Close Combat
- Brave Bird
- Roost
- Protect

Scizor (M) @ Metal Coat
Ability: Technician
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Adamant Nature
- Bullet Punch
- Close Combat
- Knock Off
- Protect
`.trim();

describe("parseTeamFolder", () => {
  it("splits a multi-team folder export into one entry per team", () => {
    const entries = parseTeamFolder(FOLDER_EXPORT);
    expect(entries).toHaveLength(2);
    expect(entries[0].label).toBe("Rank #1 FloetteMega Garchomp");
    expect(entries[1].label).toBe("Rank #2 Mega Staraptor-Scizor");
  });

  it("ignores page chrome before the first header", () => {
    const entries = parseTeamFolder(FOLDER_EXPORT);
    expect(entries[0].rawPaste).not.toMatch(/Teambuilder/);
  });

  it("each entry's rawPaste parses into the right Pokémon", () => {
    const entries = parseTeamFolder(FOLDER_EXPORT);
    expect(parseTeam(entries[0].rawPaste).map((p) => p.species)).toEqual([
      "Floette-Eternal",
      "Incineroar",
    ]);
    expect(parseTeam(entries[1].rawPaste).map((p) => p.species)).toEqual([
      "Staraptor",
      "Scizor",
    ]);
  });

  it("shortens a folder/team title to just the team name", () => {
    const entries = parseTeamFolder(
      "=== [gen9vgc] A Folder/A Sub Folder/Team Name ===\nDitto",
    );
    expect(entries[0].label).toBe("Team Name");
  });

  it("uses the whole title as the label when there's no folder path", () => {
    const entries = parseTeamFolder("=== [gen9vgc] Just A Team ===\nDitto");
    expect(entries[0].label).toBe("Just A Team");
  });

  it("returns nothing for text with no headers", () => {
    expect(parseTeamFolder("Ditto @ Choice Scarf")).toEqual([]);
  });

  it("returns nothing for empty input", () => {
    expect(parseTeamFolder("")).toEqual([]);
  });

  it("drops a header with no team content after it", () => {
    const entries = parseTeamFolder("=== [gen9vgc] Empty Team ===\n\n=== [gen9vgc] Real Team ===\nDitto");
    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("Real Team");
  });
});
