import { describe, expect, it } from "vitest";
import { addTag, normalizeTag, removeTag, suggestTags, tagsMatchQuery } from "./opponentTags";
import { parseTeam } from "./parseTeam";

describe("normalizeTag", () => {
  it("trims, lower-cases, and collapses inner whitespace", () => {
    expect(normalizeTag("  Trick   Room ")).toBe("trick room");
    expect(normalizeTag("   ")).toBe("");
  });
});

describe("addTag / removeTag", () => {
  it("adds a normalized tag once", () => {
    expect(addTag(["rain"], " Perish ")).toEqual(["rain", "perish"]);
    expect(addTag(["rain"], "RAIN")).toEqual(["rain"]);
  });

  it("returns the same array for a blank or duplicate tag, so callers can skip a no-op save", () => {
    const tags = ["rain"];
    expect(addTag(tags, "")).toBe(tags);
    expect(addTag(tags, "rain")).toBe(tags);
  });

  it("removes a tag", () => {
    expect(removeTag(["rain", "perish"], "rain")).toEqual(["perish"]);
  });
});

describe("tagsMatchQuery", () => {
  it("substring-matches any tag", () => {
    expect(tagsMatchQuery(["rain", "trick room"], "room")).toBe(true);
    expect(tagsMatchQuery(["rain"], "sun")).toBe(false);
  });
});

describe("suggestTags", () => {
  it("suggests rain and perish for a Politoed perish team", () => {
    const team = parseTeam(`Politoed @ Sitrus Berry
Ability: Drizzle
- Weather Ball
- Perish Song

Gengar @ Gengarite
Ability: Cursed Body
- Perish Song
- Protect`);
    expect(suggestTags(team)).toEqual(["rain", "perish"]);
  });

  it("uses the Mega's ability, not the pasted one — Charizard-Y suggests sun despite 'Ability: Blaze'", () => {
    const team = parseTeam(`Charizard @ Charizardite Y
Ability: Blaze
- Heat Wave

Farigiraf @ Sitrus Berry
Ability: Armor Tail
- Trick Room`);
    expect(suggestTags(team)).toEqual(["sun", "trick room"]);
  });

  it("orders weather before move-based tags, and doesn't treat Tailwind as a strategy", () => {
    const team = parseTeam(`Whimsicott @ Focus Sash
Ability: Prankster
- Tailwind
- Perish Song

Tyranitar @ Tyranitarite
Ability: Sand Stream
- Rock Slide`);
    expect(suggestTags(team)).toEqual(["sand", "perish"]);
    expect(suggestTags(parseTeam("Ditto @ Choice Scarf\nAbility: Imposter"))).toEqual([]);
  });

  it("suggests double weather for two different weather setters, counting a Mega's weather", () => {
    const team = parseTeam(`Pelipper @ Sitrus Berry
Ability: Drizzle
- Hurricane

Charizard @ Charizardite Y
Ability: Blaze
- Heat Wave`);
    expect(suggestTags(team)).toEqual(["rain", "sun", "double weather"]);
  });

  it("doesn't suggest double weather for two setters of the same weather", () => {
    const team = parseTeam(`Pelipper @ Sitrus Berry
Ability: Drizzle

Politoed @ Damp Rock
Ability: Drizzle`);
    expect(suggestTags(team)).toEqual(["rain"]);
  });

  it("suggests psyspam for a Psychic Surge setter plus an Expanding Force user", () => {
    const split = parseTeam(`Indeedee @ Psychic Seed
Ability: Psychic Surge
- Follow Me

Hatterene @ Life Orb
Ability: Magic Bounce
- Expanding Force`);
    expect(suggestTags(split)).toEqual(["psyspam"]);

    const sameMon = parseTeam(`Indeedee @ Choice Scarf
Ability: Psychic Surge
- Expanding Force`);
    expect(suggestTags(sameMon)).toEqual(["psyspam"]);
  });

  it("needs both halves for psyspam", () => {
    expect(suggestTags(parseTeam("Indeedee @ Psychic Seed\nAbility: Psychic Surge\n- Follow Me"))).toEqual([]);
    expect(suggestTags(parseTeam("Hatterene @ Life Orb\nAbility: Magic Bounce\n- Expanding Force"))).toEqual([]);
  });
});
