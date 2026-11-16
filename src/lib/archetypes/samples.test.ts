import { describe, expect, it } from "vitest";
import { parseTeam } from "@/lib/parseTeam";
import { DEFAULT_ARCHETYPE_SET as SET, checkSample } from ".";

const ychutte = parseTeam(`Raichu @ Raichunite Y
Ability: No Guard
- Zap Cannon
- Focus Blast
- Fake Out
- Protect

Floette-Eternal @ Floettite
Ability: Flower Veil
- Protect
- Moonblast
- Dazzling Gleam
- Calm Mind

Rillaboom @ Miracle Seed
Ability: Grassy Surge
- Grassy Glide
- Wood Hammer
- High Horsepower
- Fake Out

Volcarona @ Coba Berry
Ability: Flame Body
- Rage Powder
- Overheat
- Struggle Bug
- Tailwind

Sneasler @ Grassy Seed
Ability: Unburden
- Dire Claw
- Close Combat
- Swords Dance
- Protect

Basculegion @ Mystic Water
Ability: Adaptability
- Flip Turn
- Wave Crash
- Last Respects
- Soak`);

const fireSpam = parseTeam(`Torkoal @ Charcoal
Ability: Drought
- Eruption
- Heat Wave
- Protect

Pyroar @ Pyroarite
Ability: Unnerve
- Heat Wave
- Hyper Voice
- Protect`);

describe("checkSample", () => {
  it("passes a sample whose main archetype is the expected one", () => {
    const check = checkSample(ychutte, "balance-setup", SET);
    expect(check.status).toBe("primary");
    expect(check.key).toBe("balance-setup+tailwind");
    expect(check.requires.every((entry) => entry.passed)).toBe(true);
  });

  it("counts a match under another leading archetype as a tag", () => {
    expect(checkSample(ychutte, "tailwind", SET).status).toBe("tag");
  });

  it("counts a variant of the expected archetype", () => {
    const check = checkSample(fireSpam, "sun", SET);
    expect(check.status).toBe("variant");
    expect(check.classification.primary).toBe("sun-fire-spam");
  });

  it("says which conditions a miss failed, inherited ones marked", () => {
    const check = checkSample(ychutte, "sun-fire-spam", SET);
    expect(check.status).toBe("miss");
    expect(check.requires).toEqual([
      { condition: { role: "sun-setter" }, from: "sun", passed: false },
      { condition: { pokemon: { species: ["Pyroar-Mega"] } }, passed: false },
    ]);
  });

  it("lists the excludes the team hit", () => {
    // Hard setup excludes nothing; Balance setup excludes a committed setup user.
    const belly = parseTeam(`Azumarill
- Belly Drum
- Aqua Jet
- Protect

Amoonguss
- Rage Powder
- Spore
- Pollen Puff

Garchomp
- Earthquake
- Rock Slide

Kingambit
- Kowtow Cleave
- Sucker Punch

Hydreigon
- Draco Meteor
- Dark Pulse`);
    const check = checkSample(belly, "balance-setup", SET);
    expect(check.status).toBe("miss");
    expect(check.excludedBy).toEqual([{ role: "committed-setup" }]);
  });
});
