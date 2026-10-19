import { describe, expect, it } from "vitest";
import type { DamageCalcOptions, ParsedPokemon } from "@/types";
import { calculateDamage, moveHitRange } from "./calculateDamage";

describe("calculateDamage", () => {
  it("computes a guaranteed-OHKO roll list for Jolly Garchomp Earthquake vs. a neutral 0 SP Ditto", () => {
    // Garchomp: 32 Atk / 2 Def / 32 Spe Jolly -> atk 182 (matches
    // calculateFinalStats.test.ts's already-verified value). Earthquake:
    // 100 BP Ground, and Ground is one of Garchomp's own types (Dragon/
    // Ground) -> STAB applies. Ditto: 0 SP Hardy -> def 68, hp 123, single
    // Normal type (Ground vs Normal is neutral, 1x).
    //
    // By hand: base = floor(floor(22*100*182/68)/50)+2 = floor(floor(5888.23..)/50)+2
    //        = floor(5888/50)+2 = floor(117.76)+2 = 117+2 = 119
    // The 85-100% roll applies FIRST (per the real games' own order,
    // confirmed against the NCP-VGC-Damage-Calculator reference), THEN STAB
    // via pokeRound (Game Freak's "exactly .5 rounds down" rule) — not a
    // single combined ×1.5 multiplier applied once at the end:
    // for p in 85..100: floor(pokeRound(floor(119*p/100) * 1.5) * 1)
    const attacker = {
      species: "Garchomp",
      nature: "Jolly",
      evs: "32 Atk / 2 Def / 32 Spe",
    };
    const defender = { species: "Ditto", nature: "Hardy" };

    const result = calculateDamage(attacker, defender, "Earthquake");

    expect(result).toEqual({
      rolls: [151, 153, 154, 156, 157, 160, 162, 163, 165, 166, 169, 171, 172, 174, 175, 178],
      minPercent: 122.8,
      maxPercent: 144.7,
      koChanceText: "guaranteed OHKO",
      hitCount: 1,
      attackStatKey: "atk",
      defenseStatKey: "def",
      isSpreadMove: true,
    });
  });

  it("applies double weakness type effectiveness (Ice vs Dragon/Ground -> 4x)", () => {
    const attacker = { species: "Weavile", nature: "Jolly", evs: "32 Atk / 32 Spe" };
    const defender = { species: "Garchomp", nature: "Hardy" };

    const withIce = calculateDamage(attacker, defender, "Ice Punch");
    const withoutBonus = calculateDamage(
      { ...attacker, species: "Weavile" },
      { ...defender, species: "Ditto" },
      "Ice Punch",
    );

    // Sanity: the 4x-weak matchup should knock out a full-HP Garchomp in one hit.
    expect(withIce?.koChanceText).toBe("guaranteed OHKO");
    // And the same move/attacker against a neutral target should not.
    expect(withoutBonus?.koChanceText).not.toBe("guaranteed OHKO");
  });

  it("returns 0-damage 'immune' result for a type-immunity ability (Ground move vs. Levitate)", () => {
    const attacker = { species: "Garchomp", nature: "Jolly", evs: "32 Atk" };
    const defender = { species: "Gengar", nature: "Hardy", ability: "Levitate" };

    const result = calculateDamage(attacker, defender, "Earthquake");

    expect(result).toEqual({
      rolls: new Array(16).fill(0),
      minPercent: 0,
      maxPercent: 0,
      koChanceText: "immune",
      hitCount: 1,
      attackStatKey: "atk",
      defenseStatKey: "def",
      isSpreadMove: true,
    });
  });

  it("returns an 'immune' result (not 'not a KO in 4 hits') for a plain type-chart immunity (Electric vs. Ground)", () => {
    // Real bug report: Zap Cannon (Electric) vs. Ground-type Swampert
    // returned 0-damage rolls with koChanceText "not a KO in 4 hits" instead
    // of "immune" — the type chart's 0x multiplier zeroed the damage, but
    // only the ability-based immunity path (Levitate etc.) short-circuited
    // to the "immune" result; a type-based immunity with no special ability
    // involved fell through to the normal KO-chance text instead.
    const attacker = { species: "Raichu", nature: "Timid", evs: "32 SpA" };
    const defender = { species: "Swampert", nature: "Hardy" };

    const result = calculateDamage(attacker, defender, "Zap Cannon");

    expect(result).toEqual({
      rolls: new Array(16).fill(0),
      minPercent: 0,
      maxPercent: 0,
      koChanceText: "immune",
      hitCount: 1,
      attackStatKey: "spa",
      defenseStatKey: "spd",
      isSpreadMove: false,
    });
  });

  it("uses the Mega form's own ability, not the pasted (base form) one, when Mega toggled on", () => {
    // Real bug report: base Raichu's Lightning Rod (Electric immunity) was
    // incorrectly still being used for Mega Raichu Y, which actually has No
    // Guard (no immunity at all) — the pasted export's Ability: line only
    // ever reflects the base form.
    const baseRaichu = { species: "Raichu", ability: "Lightning Rod" };
    const megaRaichuY = { species: "Raichu", item: "Raichunite Y", ability: "Lightning Rod" };
    const attacker = { species: "Garchomp", nature: "Jolly", evs: "32 SpA" };

    const vsBase = calculateDamage(attacker, baseRaichu, "Thunder Punch");
    const vsMega = calculateDamage(attacker, megaRaichuY, "Thunder Punch");

    expect(vsBase?.koChanceText).toBe("immune");
    expect(vsMega?.koChanceText).not.toBe("immune");
    expect(vsMega?.rolls[0]).toBeGreaterThan(0);
  });

  it("applies STAB only when the move's type matches one of the attacker's own types", () => {
    const attacker = { species: "Garchomp", nature: "Hardy" };
    const defender = { species: "Ditto", nature: "Hardy" };

    // Earthquake (Ground) gets STAB on Garchomp (Dragon/Ground); Body Slam
    // (Normal) does not.
    const stabbed = calculateDamage(attacker, defender, "Earthquake");
    const unstabbed = calculateDamage(attacker, defender, "Body Slam");

    expect(stabbed).not.toBeNull();
    expect(unstabbed).not.toBeNull();
    // Both moves are 100 BP Physical — the only difference is STAB — so the
    // STAB'd roll should be noticeably higher despite the same base power.
    expect(stabbed!.rolls[0]).toBeGreaterThan(unstabbed!.rolls[0]);
  });

  it("applies a curated item modifier (Choice Band, physical-only)", () => {
    const defender = { species: "Ditto", nature: "Hardy" };
    const noItem = calculateDamage(
      { species: "Garchomp", nature: "Hardy" },
      defender,
      "Earthquake",
    );
    const withBand = calculateDamage(
      { species: "Garchomp", nature: "Hardy", item: "Choice Band" },
      defender,
      "Earthquake",
    );

    expect(withBand!.rolls[0]).toBeGreaterThan(noItem!.rolls[0]);
  });

  it("a type-resist Berry halves a super-effective hit (×0.5, not ×0.75) but leaves a neutral hit untouched", () => {
    const attacker = { species: "Weavile", nature: "Jolly", evs: "32 Atk / 32 Spe" };
    // Ice vs. Garchomp (Dragon/Ground) is a 4x super-effective matchup (see
    // the "double weakness" test above) — Yache Berry should exactly halve
    // this hit (confirmed against the NCP-VGC-Damage-Calculator reference's
    // own calcFinalMods: resist berries push 0x800/0x1000 = 0.5, not 0.75).
    const superEffectiveNoBerry = calculateDamage(
      attacker,
      { species: "Garchomp", nature: "Hardy" },
      "Ice Punch",
    );
    const superEffectiveWithBerry = calculateDamage(
      attacker,
      { species: "Garchomp", nature: "Hardy", item: "Yache Berry" },
      "Ice Punch",
    );
    expect(superEffectiveWithBerry!.rolls[0]).toBeLessThan(superEffectiveNoBerry!.rolls[0]);
    expect(superEffectiveWithBerry!.rolls.at(-1)).toBe(
      Math.floor(superEffectiveNoBerry!.rolls.at(-1)! * 0.5),
    );

    // Ice vs. Charizard (Fire/Flying) is neutral — Yache Berry only guards
    // against a SUPER-EFFECTIVE Ice hit, so it should be a no-op here.
    const neutralNoBerry = calculateDamage(
      attacker,
      { species: "Charizard", nature: "Hardy" },
      "Ice Punch",
    );
    const neutralWithBerry = calculateDamage(
      attacker,
      { species: "Charizard", nature: "Hardy", item: "Yache Berry" },
      "Ice Punch",
    );
    expect(neutralWithBerry!.rolls[0]).toBe(neutralNoBerry!.rolls[0]);
  });

  it("Chilan Berry unconditionally halves Normal-type damage, even when neutral", () => {
    const attacker = { species: "Garchomp", nature: "Hardy" };
    const noBerry = calculateDamage(attacker, { species: "Ditto", nature: "Hardy" }, "Tackle");
    const withBerry = calculateDamage(
      attacker,
      { species: "Ditto", nature: "Hardy", item: "Chilan Berry" },
      "Tackle",
    );

    expect(withBerry!.rolls[0]).toBe(Math.floor(noBerry!.rolls[0] * 0.5));
  });

  it("returns null for a Status move (no direct formula damage)", () => {
    const attacker = { species: "Garchomp" };
    const defender = { species: "Ditto" };
    expect(calculateDamage(attacker, defender, "Protect")).toBeNull();
  });

  it("returns null for a fixed/variable-damage move (power is null, not the standard formula)", () => {
    const attacker = { species: "Garchomp" };
    const defender = { species: "Ditto" };
    expect(calculateDamage(attacker, defender, "Seismic Toss")).toBeNull();
  });

  it("returns null for an unrecognized move name", () => {
    const attacker = { species: "Garchomp" };
    const defender = { species: "Ditto" };
    expect(calculateDamage(attacker, defender, "Not A Real Move")).toBeNull();
  });

  it("returns null when either species isn't in the base-stats table", () => {
    const real = { species: "Garchomp" };
    const fake = { species: "Not-A-Real-Pokemon" };
    expect(calculateDamage(fake, real, "Earthquake")).toBeNull();
    expect(calculateDamage(real, fake, "Earthquake")).toBeNull();
  });
});

describe("calculateDamage battle conditions (Full Singles Accuracy)", () => {
  const garchomp = { species: "Garchomp", nature: "Hardy" };
  const ditto = { species: "Ditto", nature: "Hardy" };

  it("burn halves Physical damage", () => {
    const normal = calculateDamage(garchomp, ditto, "Earthquake");
    const burned = calculateDamage(garchomp, ditto, "Earthquake", { attackerBurned: true });
    expect(burned!.rolls[0]).toBeLessThan(normal!.rolls[0]);
  });

  it("Guts cancels burn's halving and boosts Attack instead", () => {
    const gutsAttacker = { ...garchomp, ability: "Guts" };
    const burnedNoGuts = calculateDamage(garchomp, ditto, "Earthquake", { attackerBurned: true });
    const burnedWithGuts = calculateDamage(gutsAttacker, ditto, "Earthquake", {
      attackerBurned: true,
    });
    const unburned = calculateDamage(garchomp, ditto, "Earthquake");

    expect(burnedWithGuts!.rolls[0]).toBeGreaterThan(burnedNoGuts!.rolls[0]);
    // Guts doesn't just cancel the halving — it boosts Attack beyond baseline.
    expect(burnedWithGuts!.rolls[0]).toBeGreaterThan(unburned!.rolls[0]);
  });

  it("a critical hit increases damage", () => {
    const normal = calculateDamage(garchomp, ditto, "Earthquake");
    const crit = calculateDamage(garchomp, ditto, "Earthquake", { isCritical: true });
    expect(crit!.rolls[0]).toBeGreaterThan(normal!.rolls[0]);
  });

  it("Sun boosts a Fire move and weakens a Water move; Rain does the opposite", () => {
    const charizard = { species: "Charizard", nature: "Hardy" }; // Fire/Flying
    const noWeatherFire = calculateDamage(charizard, ditto, "Flamethrower");
    const sunFire = calculateDamage(charizard, ditto, "Flamethrower", { weather: "Sun" });
    const rainFire = calculateDamage(charizard, ditto, "Flamethrower", { weather: "Rain" });

    expect(sunFire!.rolls[0]).toBeGreaterThan(noWeatherFire!.rolls[0]);
    expect(rainFire!.rolls[0]).toBeLessThan(noWeatherFire!.rolls[0]);
  });

  it("Electric Terrain boosts a grounded attacker's Electric move but not a Flying-type's", () => {
    const flying = { species: "Charizard", nature: "Hardy" }; // Fire/Flying -> not grounded

    const groundedNoTerrain = calculateDamage(garchomp, ditto, "Thunder Punch");
    const groundedTerrain = calculateDamage(garchomp, ditto, "Thunder Punch", {
      terrain: "Electric",
    });
    const flyingNoTerrain = calculateDamage(flying, ditto, "Thunder Punch");
    const flyingTerrain = calculateDamage(flying, ditto, "Thunder Punch", { terrain: "Electric" });

    expect(groundedTerrain!.rolls[0]).toBeGreaterThan(groundedNoTerrain!.rolls[0]);
    expect(flyingTerrain!.rolls[0]).toBe(flyingNoTerrain!.rolls[0]);
  });

  it("reports whether the Field's weather/terrain changed the result (for the calc line)", () => {
    const charizard = { species: "Charizard", nature: "Hardy" };
    const terrainHit = calculateDamage(garchomp, ditto, "Thunder Punch", { terrain: "Electric" });
    expect(terrainHit!.terrainApplied).toBe(true);
    // A Flying-type isn't grounded, and an Earthquake isn't Electric: terrain didn't matter.
    expect(calculateDamage(charizard, ditto, "Thunder Punch", { terrain: "Electric" })!.terrainApplied).toBeFalsy();
    expect(calculateDamage(garchomp, ditto, "Earthquake", { terrain: "Electric" })!.terrainApplied).toBeFalsy();

    expect(calculateDamage(charizard, ditto, "Flamethrower", { weather: "Sun" })!.weatherApplied).toBe(true);
    expect(calculateDamage(garchomp, ditto, "Earthquake", { weather: "Sun" })!.weatherApplied).toBeFalsy();
    const tyranitar = { species: "Tyranitar", nature: "Hardy" };
    expect(calculateDamage(charizard, tyranitar, "Air Slash", { weather: "Sand" })!.weatherApplied).toBe(true);
  });

  it("Misty Terrain halves Dragon-type damage against a grounded defender", () => {
    const normal = calculateDamage(garchomp, ditto, "Dragon Claw");
    const misty = calculateDamage(garchomp, ditto, "Dragon Claw", { terrain: "Misty" });
    expect(misty!.rolls[0]).toBeLessThan(normal!.rolls[0]);
  });

  it("Sandstorm boosts a Rock-type defender's Sp. Def against a Special hit", () => {
    const charizard = { species: "Charizard", nature: "Hardy" };
    const tyranitar = { species: "Tyranitar", nature: "Hardy" }; // Rock/Dark
    const normal = calculateDamage(charizard, tyranitar, "Flamethrower");
    const sand = calculateDamage(charizard, tyranitar, "Flamethrower", { weather: "Sand" });
    expect(sand!.rolls[0]).toBeLessThan(normal!.rolls[0]);
  });

  it("Snow boosts an Ice-type defender's Def against a Physical hit", () => {
    const weavile = { species: "Weavile", nature: "Hardy" }; // Dark/Ice
    const normal = calculateDamage(garchomp, weavile, "Earthquake");
    const snow = calculateDamage(garchomp, weavile, "Earthquake", { weather: "Snow" });
    expect(snow!.rolls[0]).toBeLessThan(normal!.rolls[0]);
  });

  it("Reflect halves Physical damage but leaves Special untouched", () => {
    const normalPhysical = calculateDamage(garchomp, ditto, "Earthquake");
    const reflected = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderScreens: { reflect: true },
    });
    const normalSpecial = calculateDamage(garchomp, ditto, "Dragon Pulse");
    const reflectedSpecial = calculateDamage(garchomp, ditto, "Dragon Pulse", {
      defenderScreens: { reflect: true },
    });

    expect(reflected!.rolls[0]).toBeLessThan(normalPhysical!.rolls[0]);
    expect(reflectedSpecial!.rolls[0]).toBe(normalSpecial!.rolls[0]);
  });

  it("Light Screen halves Special damage but leaves Physical untouched", () => {
    const normalSpecial = calculateDamage(garchomp, ditto, "Dragon Pulse");
    const screened = calculateDamage(garchomp, ditto, "Dragon Pulse", {
      defenderScreens: { lightScreen: true },
    });
    const normalPhysical = calculateDamage(garchomp, ditto, "Earthquake");
    const screenedPhysical = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderScreens: { lightScreen: true },
    });

    expect(screened!.rolls[0]).toBeLessThan(normalSpecial!.rolls[0]);
    expect(screenedPhysical!.rolls[0]).toBe(normalPhysical!.rolls[0]);
  });

  it("Aurora Veil halves both Physical and Special damage", () => {
    const normalPhysical = calculateDamage(garchomp, ditto, "Earthquake");
    const veiledPhysical = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderScreens: { auroraVeil: true },
    });
    const normalSpecial = calculateDamage(garchomp, ditto, "Dragon Pulse");
    const veiledSpecial = calculateDamage(garchomp, ditto, "Dragon Pulse", {
      defenderScreens: { auroraVeil: true },
    });

    expect(veiledPhysical!.rolls[0]).toBeLessThan(normalPhysical!.rolls[0]);
    expect(veiledSpecial!.rolls[0]).toBeLessThan(normalSpecial!.rolls[0]);
  });

  it("screens are weaker in Doubles (×0xAAC/4096 ≈ 0.667) than Singles (×0x800/4096 = 0.5)", () => {
    // Confirmed against the NCP-VGC-Damage-Calculator reference's own
    // calcFinalMods: `field.format !== "Singles" ? 0xAAC : 0x800`. This
    // engine now chains modifiers the same way the real games do
    // (pokeRound applied at each stage, not one combined float
    // multiplication), so these are exact bit-for-bit expected rolls, not
    // an approximation.
    const singlesReflect = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderScreens: { reflect: true },
      isDoublesFormat: false,
    });
    const doublesReflect = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderScreens: { reflect: true },
      isDoublesFormat: true,
    });

    expect(singlesReflect!.rolls).toEqual([63, 63, 64, 65, 66, 66, 67, 68, 69, 69, 70, 71, 72, 72, 73, 74]);
    expect(doublesReflect!.rolls).toEqual([
      84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
    ]);
  });

  it("omitting isDoublesFormat behaves like Singles (the pre-fix default)", () => {
    const omitted = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderScreens: { reflect: true },
    });
    const explicitSingles = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderScreens: { reflect: true },
      isDoublesFormat: false,
    });
    expect(omitted).toEqual(explicitSingles);
  });
});

describe("calculateDamage field conditions", () => {
  const garchomp = { species: "Garchomp", nature: "Hardy" };
  const ditto = { species: "Ditto", nature: "Hardy" };

  it("Helping Hand boosts the attacker's damage", () => {
    const normal = calculateDamage(garchomp, ditto, "Earthquake");
    const helped = calculateDamage(garchomp, ditto, "Earthquake", {
      attackerHelpingHand: true,
    });
    expect(helped!.rolls[0]).toBeGreaterThan(normal!.rolls[0]);
  });

  it("Friend Guard reduces damage the defender takes", () => {
    const normal = calculateDamage(garchomp, ditto, "Earthquake");
    const guarded = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderFriendGuard: true,
    });
    expect(guarded!.rolls[0]).toBeLessThan(normal!.rolls[0]);
  });

  it("Protect blocks the hit entirely regardless of type", () => {
    const result = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderProtected: true,
    });
    expect(result).toEqual({
      rolls: new Array(16).fill(0),
      minPercent: 0,
      maxPercent: 0,
      koChanceText: "blocked by Protect",
      hitCount: 1,
      attackStatKey: "atk",
      defenseStatKey: "def",
      isSpreadMove: true,
    });
  });

  it("Unseen Fist and Piercing Drill's contact moves hit through Protect at a quarter of the damage", () => {
    for (const [species, ability, move] of [
      ["Golurk", "Unseen Fist", "Drain Punch"],
      ["Excadrill", "Piercing Drill", "Iron Head"],
    ]) {
      const attacker = { species, ability, nature: "Hardy" };
      const normal = calculateDamage(attacker, ditto, move);
      const protectedHit = calculateDamage(attacker, ditto, move, { defenderProtected: true });
      protectedHit!.rolls.forEach((roll, i) => {
        expect(Math.abs(roll - normal!.rolls[i] / 4)).toBeLessThanOrEqual(1);
      });
      expect(protectedHit!.koChanceText).not.toBe("blocked by Protect");
    }
  });

  it("Protect still blocks a non-contact move from Unseen Fist or Piercing Drill", () => {
    for (const ability of ["Unseen Fist", "Piercing Drill"]) {
      const attacker = { species: "Excadrill", ability, nature: "Hardy" };
      const result = calculateDamage(attacker, ditto, "Earthquake", { defenderProtected: true });
      expect(result!.koChanceText).toBe("blocked by Protect");
    }
  });

  it("Fairy Aura boosts Fairy-type move damage", () => {
    const sylveon = { species: "Sylveon", nature: "Hardy" };
    const normal = calculateDamage(sylveon, ditto, "Moonblast");
    const aura = calculateDamage(sylveon, ditto, "Moonblast", { fairyAura: true });
    expect(aura!.rolls[0]).toBeGreaterThan(normal!.rolls[0]);
  });

  it("Fairy Aura doesn't affect a non-Fairy move", () => {
    const normal = calculateDamage(garchomp, ditto, "Earthquake");
    const aura = calculateDamage(garchomp, ditto, "Earthquake", { fairyAura: true });
    expect(aura!.rolls[0]).toBe(normal!.rolls[0]);
  });

  it("Gravity lets a Ground-type move hit a Flying-type defender that's normally immune", () => {
    const charizard = { species: "Charizard", nature: "Hardy" }; // Fire/Flying
    const withoutGravity = calculateDamage(garchomp, charizard, "Earthquake");
    const withGravity = calculateDamage(garchomp, charizard, "Earthquake", { gravity: true });

    expect(withoutGravity!.koChanceText).toBe("immune");
    expect(withGravity!.koChanceText).not.toBe("immune");
    expect(withGravity!.rolls[0]).toBeGreaterThan(0);
  });

  it("Gravity negates Levitate's Ground-move immunity", () => {
    const levitator = { species: "Gengar", nature: "Hardy", ability: "Levitate" };
    const withoutGravity = calculateDamage(garchomp, levitator, "Earthquake");
    const withGravity = calculateDamage(garchomp, levitator, "Earthquake", { gravity: true });

    expect(withoutGravity!.koChanceText).toBe("immune");
    expect(withGravity!.koChanceText).not.toBe("immune");
  });

  it("Air Balloon grants Ground-move immunity, which Gravity negates", () => {
    const balloonDitto = { species: "Ditto", nature: "Hardy", item: "Air Balloon" };
    const withoutGravity = calculateDamage(garchomp, balloonDitto, "Earthquake");
    const withGravity = calculateDamage(garchomp, balloonDitto, "Earthquake", { gravity: true });

    expect(withoutGravity!.koChanceText).toBe("immune");
    expect(withGravity!.koChanceText).not.toBe("immune");
  });
});

describe("calculateDamage stat stages, status, and current HP", () => {
  const garchomp = { species: "Garchomp", nature: "Hardy" };
  const ditto = { species: "Ditto", nature: "Hardy" };

  it("a positive attacker stat stage boosts damage, a negative one lowers it", () => {
    const neutral = calculateDamage(garchomp, ditto, "Earthquake");
    const boosted = calculateDamage(garchomp, ditto, "Earthquake", {
      attackerStages: { atk: 1 },
    });
    const lowered = calculateDamage(garchomp, ditto, "Earthquake", {
      attackerStages: { atk: -1 },
    });

    expect(boosted!.rolls[0]).toBeGreaterThan(neutral!.rolls[0]);
    expect(lowered!.rolls[0]).toBeLessThan(neutral!.rolls[0]);
  });

  it("a positive defender stat stage lowers damage taken, a negative one raises it", () => {
    const neutral = calculateDamage(garchomp, ditto, "Earthquake");
    const defenderBoosted = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderStages: { def: 1 },
    });
    const defenderLowered = calculateDamage(garchomp, ditto, "Earthquake", {
      defenderStages: { def: -1 },
    });

    expect(defenderBoosted!.rolls[0]).toBeLessThan(neutral!.rolls[0]);
    expect(defenderLowered!.rolls[0]).toBeGreaterThan(neutral!.rolls[0]);
  });

  it("only the stat stage matching the move's category applies (Atk stage doesn't affect a Special move)", () => {
    const normal = calculateDamage(garchomp, ditto, "Dragon Pulse");
    const withAtkBoost = calculateDamage(garchomp, ditto, "Dragon Pulse", {
      attackerStages: { atk: 6 },
    });
    expect(withAtkBoost!.rolls[0]).toBe(normal!.rolls[0]);
  });

  it("a critical hit ignores a negative attacker stat stage", () => {
    const critAtNeutral = calculateDamage(garchomp, ditto, "Earthquake", { isCritical: true });
    const critWithLoweredAtk = calculateDamage(garchomp, ditto, "Earthquake", {
      isCritical: true,
      attackerStages: { atk: -2 },
    });
    expect(critWithLoweredAtk!.rolls[0]).toBe(critAtNeutral!.rolls[0]);
  });

  it("a critical hit still benefits from a positive attacker stat stage", () => {
    const critAtNeutral = calculateDamage(garchomp, ditto, "Earthquake", { isCritical: true });
    const critWithBoostedAtk = calculateDamage(garchomp, ditto, "Earthquake", {
      isCritical: true,
      attackerStages: { atk: 2 },
    });
    expect(critWithBoostedAtk!.rolls[0]).toBeGreaterThan(critAtNeutral!.rolls[0]);
  });

  it("a critical hit ignores a positive defender stat stage", () => {
    const critAtNeutral = calculateDamage(garchomp, ditto, "Earthquake", { isCritical: true });
    const critVsBoostedDef = calculateDamage(garchomp, ditto, "Earthquake", {
      isCritical: true,
      defenderStages: { def: 2 },
    });
    expect(critVsBoostedDef!.rolls[0]).toBe(critAtNeutral!.rolls[0]);
  });

  it("a critical hit still benefits from a negative defender stat stage", () => {
    const critAtNeutral = calculateDamage(garchomp, ditto, "Earthquake", { isCritical: true });
    const critVsLoweredDef = calculateDamage(garchomp, ditto, "Earthquake", {
      isCritical: true,
      defenderStages: { def: -2 },
    });
    expect(critVsLoweredDef!.rolls[0]).toBeGreaterThan(critAtNeutral!.rolls[0]);
  });

  it("Guts boosts Attack for any status, not just burn", () => {
    const gutsAttacker = { ...garchomp, ability: "Guts" };
    const healthy = calculateDamage(gutsAttacker, ditto, "Earthquake");
    const poisoned = calculateDamage(gutsAttacker, ditto, "Earthquake", {
      attackerStatused: true,
      attackerBurned: false,
    });
    expect(poisoned!.rolls[0]).toBeGreaterThan(healthy!.rolls[0]);
  });

  it("a defender at partial HP can be KO'd by a hit that wouldn't KO at full HP", () => {
    const atFullHp = calculateDamage(garchomp, ditto, "Dragon Claw");
    const atHalfHp = calculateDamage(garchomp, ditto, "Dragon Claw", {
      defenderCurrentHpPercent: 50,
    });

    expect(atFullHp!.koChanceText).not.toMatch(/OHKO/);
    expect(atHalfHp!.koChanceText).toMatch(/OHKO/);
    // minPercent/maxPercent stay relative to MAX hp regardless of current HP.
    expect(atHalfHp!.minPercent).toBe(atFullHp!.minPercent);
  });
});

describe("calculateDamage multi-hit moves and Focus Sash/Sturdy", () => {
  const garchomp = { species: "Garchomp", nature: "Hardy" };
  const ditto = { species: "Ditto", nature: "Hardy" };

  it("totals a fixed 2-hit move's damage across both hits (Dual Wingbeat vs. a single-hit move of equal power)", () => {
    // Dual Wingbeat and Tackle are both 40 BP Physical vs. this matchup (no
    // STAB/type bonus either way) — Dual Wingbeat should deal exactly double
    // Tackle's per-roll damage, since both hits share the same roll (the
    // same "same roll repeated" convention describeKoChance already uses).
    const dualWingbeat = calculateDamage(garchomp, ditto, "Dual Wingbeat");
    const tackle = calculateDamage(garchomp, ditto, "Tackle");

    expect(dualWingbeat!.hitCount).toBe(2);
    expect(dualWingbeat!.rolls).toEqual(tackle!.rolls.map((roll) => roll * 2));
  });

  it("returns hitCount 1 for an ordinary single-hit move", () => {
    const result = calculateDamage(garchomp, ditto, "Tackle");
    expect(result!.hitCount).toBe(1);
  });

  it("Triple Kick's power increases each hit (10/20/30), not a flat power×3", () => {
    const tripleKick = calculateDamage(garchomp, ditto, "Triple Kick");
    // Flat power×3 (30 BP effectively, tripled) would deal noticeably less
    // than the true 10+20+30=60 total effective power — a directional check
    // that's robust to the exact formula's rounding.
    const flatTriple = calculateDamage(garchomp, ditto, "Tackle"); // 40 BP single hit, for scale
    expect(tripleKick!.hitCount).toBe(3);
    expect(tripleKick!.rolls[0]).toBeGreaterThan(flatTriple!.rolls[0] * 3);
  });

  it("Focus Sash clips lethal damage to leave exactly 1 HP, from full HP only", () => {
    const sashDitto = { species: "Ditto", nature: "Hardy", item: "Focus Sash" };
    const result = calculateDamage(garchomp, sashDitto, "Earthquake");

    // Every roll would otherwise OHKO (per the very first test in this
    // file) — Sash should clip every single one down to exactly hp-1.
    expect(result!.rolls.every((roll) => roll === 122)).toBe(true);
    expect(result!.koChanceText).not.toBe("guaranteed OHKO");
  });

  it("Sturdy has the same effect as Focus Sash", () => {
    const sturdyDitto = { species: "Ditto", nature: "Hardy", ability: "Sturdy" };
    const result = calculateDamage(garchomp, sturdyDitto, "Earthquake");
    expect(result!.rolls.every((roll) => roll === 122)).toBe(true);
  });

  it("Focus Sash does NOT trigger when the defender isn't at full HP", () => {
    const sashDitto = { species: "Ditto", nature: "Hardy", item: "Focus Sash" };
    const result = calculateDamage(garchomp, sashDitto, "Earthquake", {
      defenderCurrentHpPercent: 90,
    });
    // Not clipped to a survival value — a real (if reduced) KO chance instead.
    expect(result!.rolls.every((roll) => roll === 122)).toBe(false);
  });

  it("Focus Sash saves the first sub-hit of a multi-hit move, but the second sub-hit still finishes the KO (Sash only triggers once)", () => {
    const sashDitto = { species: "Ditto", nature: "Hardy", item: "Focus Sash" };
    // +6 Atk makes a single Dual Wingbeat hit alone exceed Ditto's HP, so
    // this specifically exercises "Sash saves hit 1, hit 2 kills anyway".
    const result = calculateDamage(garchomp, sashDitto, "Dual Wingbeat", {
      attackerStages: { atk: 6 },
    });
    // Total damage exceeds Ditto's max HP (122 saved + a full second hit),
    // and the move still results in a KO overall.
    expect(result!.rolls[0]).toBeGreaterThan(123);
    expect(result!.koChanceText).toBe("guaranteed OHKO");
  });
});

describe("calculateDamage HP-scaled power moves (Water Spout, Eruption)", () => {
  const blastoise = { species: "Blastoise", nature: "Modest", evs: "32 SpA" };
  const ditto = { species: "Ditto", nature: "Hardy" };

  it("defaults to full (150) power when attackerCurrentHpPercent is omitted", () => {
    const omitted = calculateDamage(blastoise, ditto, "Water Spout");
    const explicitFull = calculateDamage(blastoise, ditto, "Water Spout", {
      attackerCurrentHpPercent: 100,
    });
    expect(omitted).toEqual(explicitFull);
  });

  it("halves Water Spout's damage at 50% attacker HP", () => {
    const fullHp = calculateDamage(blastoise, ditto, "Water Spout", {
      attackerCurrentHpPercent: 100,
    });
    const halfHp = calculateDamage(blastoise, ditto, "Water Spout", {
      attackerCurrentHpPercent: 50,
    });
    // floor(150 * 50/100) = 75, exactly half the base power, so the roll
    // list should also come out to roughly (integer-rounding aside) half.
    expect(halfHp!.rolls[0]).toBeLessThan(fullHp!.rolls[0]);
    expect(halfHp!.rolls[0]).toBeCloseTo(fullHp!.rolls[0] / 2, -1);
  });

  it("never drops power below 1, even at 0% HP", () => {
    const result = calculateDamage(blastoise, ditto, "Eruption", {
      attackerCurrentHpPercent: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.rolls[0]).toBeGreaterThan(0);
  });

  it("doesn't scale an ordinary fixed-power move's damage by attacker HP", () => {
    const fullHp = calculateDamage(blastoise, ditto, "Ice Beam", {
      attackerCurrentHpPercent: 100,
    });
    const lowHp = calculateDamage(blastoise, ditto, "Ice Beam", {
      attackerCurrentHpPercent: 10,
    });
    expect(lowHp!.rolls[0]).toBe(fullHp!.rolls[0]);
  });
});

describe("calculateDamage spread moves (doubles ×0.75)", () => {
  const garchomp = { species: "Garchomp", nature: "Jolly", evs: "32 Atk / 32 Spe" };
  const ditto = { species: "Ditto", nature: "Hardy" };

  it("Earthquake (a spread move) takes the ×0.75 reduction only when attackerHitsMultipleTargets is set", () => {
    const singleTarget = calculateDamage(garchomp, ditto, "Earthquake");
    const spreadHit = calculateDamage(garchomp, ditto, "Earthquake", {
      attackerHitsMultipleTargets: true,
    });
    expect(spreadHit!.rolls[0]).toBeLessThan(singleTarget!.rolls[0]);
    // The max roll should be exactly floor(singleTarget's max roll * 0.75).
    expect(spreadHit!.rolls.at(-1)).toBe(Math.floor(singleTarget!.rolls.at(-1)! * 0.75));
  });

  it("marks isSpreadMove: true for a spread move and false for an ordinary single-target move", () => {
    const spread = calculateDamage(garchomp, ditto, "Earthquake");
    const single = calculateDamage(garchomp, ditto, "Iron Head");
    expect(spread!.isSpreadMove).toBe(true);
    expect(single!.isSpreadMove).toBe(false);
  });

  it("doesn't apply the spread reduction to a non-spread move even if attackerHitsMultipleTargets is set", () => {
    const normal = calculateDamage(garchomp, ditto, "Iron Head");
    const flaggedAsMultiTarget = calculateDamage(garchomp, ditto, "Iron Head", {
      attackerHitsMultipleTargets: true,
    });
    expect(flaggedAsMultiTarget!.rolls[0]).toBe(normal!.rolls[0]);
  });

  it("doesn't reduce a spread move's damage when attackerHitsMultipleTargets is omitted (single remaining target)", () => {
    const omitted = calculateDamage(garchomp, ditto, "Earthquake");
    const explicitlyFalse = calculateDamage(garchomp, ditto, "Earthquake", {
      attackerHitsMultipleTargets: false,
    });
    expect(omitted).toEqual(explicitlyFalse);
  });
});

describe("calculateDamage recoil (move recoil + Life Orb)", () => {
  const garchomp = { species: "Garchomp", nature: "Jolly", evs: "32 Atk / 32 Spe" };
  const ditto = { species: "Ditto", nature: "Hardy" };

  it("has no recoilMinPercent/recoilMaxPercent for an ordinary move with no Life Orb", () => {
    const result = calculateDamage(garchomp, ditto, "Iron Head");
    expect(result!.recoilMinPercent).toBeUndefined();
    expect(result!.recoilMaxPercent).toBeUndefined();
  });

  it("computes recoil from a move's own recoilFraction (Take Down, 1/4 of damage dealt)", () => {
    const result = calculateDamage(garchomp, ditto, "Take Down");
    expect(result!.recoilMinPercent).toBeGreaterThan(0);
    expect(result!.recoilMaxPercent).toBeGreaterThanOrEqual(result!.recoilMinPercent!);
    // floor(dealt * 0.25) recoil, dealt itself is roughly a quarter of the
    // shown defender-facing damage percent (different HP pools), so just
    // sanity-check recoil is meaningfully smaller than the damage dealt.
    expect(result!.recoilMaxPercent!).toBeLessThan(result!.maxPercent);
  });

  it("Life Orb adds a flat ~10% max HP recoil (min equals max — not proportional to the roll)", () => {
    const withLifeOrb = calculateDamage(
      { ...garchomp, item: "Life Orb" },
      ditto,
      "Iron Head",
    );
    expect(withLifeOrb!.recoilMinPercent).toBe(withLifeOrb!.recoilMaxPercent);
    expect(withLifeOrb!.recoilMinPercent).toBeCloseTo(10, 0);
  });

  it("a recoil move's damage-proportional recoil and Life Orb's flat recoil stack", () => {
    // Life Orb also boosts the damage dealt (×1.3), which in turn boosts
    // the move's own proportional recoil too — so this only asserts the
    // stacking direction, not an exact combined value.
    const moveRecoilOnly = calculateDamage(garchomp, ditto, "Take Down");
    const stacked = calculateDamage({ ...garchomp, item: "Life Orb" }, ditto, "Take Down");
    expect(stacked!.recoilMinPercent!).toBeGreaterThan(moveRecoilOnly!.recoilMinPercent!);
  });
});

describe("calculateDamage Foul Play (uses the DEFENDER's own Attack stat)", () => {
  const ditto = { species: "Ditto", nature: "Hardy" };
  const highAtkAttacker = { species: "Garchomp", nature: "Adamant", evs: "32 Atk" };
  const lowAtkAttacker = { species: "Wynaut", nature: "Hardy" };
  // Same species/Def stat on both builds — only Atk differs (32 Atk Adamant
  // vs. no Atk investment and a further Atk-lowering nature) — isolates the
  // Attack-stat comparison from a Defense-stat confound.
  const highAtkDefender = { species: "Garchomp", nature: "Adamant", evs: "32 Atk" };
  const lowAtkDefender = { species: "Garchomp", nature: "Modest" };

  it("the attacker's own Attack investment has no effect on the damage dealt", () => {
    const fromHighAtk = calculateDamage(highAtkAttacker, highAtkDefender, "Foul Play");
    const fromLowAtk = calculateDamage(lowAtkAttacker, highAtkDefender, "Foul Play");
    expect(fromHighAtk!.rolls).toEqual(fromLowAtk!.rolls);
  });

  it("scales with the DEFENDER's own Attack stat instead", () => {
    const vsHighAtkDefender = calculateDamage(ditto, highAtkDefender, "Foul Play");
    const vsLowAtkDefender = calculateDamage(ditto, lowAtkDefender, "Foul Play");
    expect(vsHighAtkDefender!.rolls[0]).toBeGreaterThan(vsLowAtkDefender!.rolls[0]);
  });

  it("a positive defender Attack stage increases damage, a negative one decreases it", () => {
    const neutral = calculateDamage(ditto, highAtkDefender, "Foul Play");
    const boosted = calculateDamage(ditto, highAtkDefender, "Foul Play", {
      defenderStages: { atk: 2 },
    });
    const lowered = calculateDamage(ditto, highAtkDefender, "Foul Play", {
      defenderStages: { atk: -2 },
    });
    expect(boosted!.rolls[0]).toBeGreaterThan(neutral!.rolls[0]);
    expect(lowered!.rolls[0]).toBeLessThan(neutral!.rolls[0]);
  });

  it("the attacker's own Attack stat stage has no effect (only the defender's Attack stage does)", () => {
    const neutral = calculateDamage(ditto, highAtkDefender, "Foul Play");
    const attackerBoosted = calculateDamage(ditto, highAtkDefender, "Foul Play", {
      attackerStages: { atk: 6 },
    });
    expect(attackerBoosted!.rolls).toEqual(neutral!.rolls);
  });

  it("a critical hit ignores a negative defender Attack stage — the stat Foul Play actually uses", () => {
    const critNeutral = calculateDamage(ditto, highAtkDefender, "Foul Play", { isCritical: true });
    const critVsLoweredAtk = calculateDamage(ditto, highAtkDefender, "Foul Play", {
      isCritical: true,
      defenderStages: { atk: -2 },
    });
    expect(critVsLoweredAtk!.rolls[0]).toBe(critNeutral!.rolls[0]);
  });

  it("STAB still comes from the ATTACKER's own type, unaffected by the target-stat swap", () => {
    // Foul Play is Dark-type; Grimmsnarl (Dark/Fairy) gets STAB, Ditto (Normal) doesn't.
    const withStab = calculateDamage({ species: "Grimmsnarl", nature: "Hardy" }, highAtkDefender, "Foul Play");
    const withoutStab = calculateDamage(ditto, highAtkDefender, "Foul Play");
    expect(withStab!.rolls[0]).toBeGreaterThan(withoutStab!.rolls[0]);
  });
});

describe("calculateDamage Adaptability (STAB ×2.0 instead of ×1.5)", () => {
  // Newly implemented as part of the NCP-VGC-Damage-Calculator formula
  // audit — a prior comment in abilityDamageModifiers.ts claimed this was
  // "special-cased" elsewhere, but no such code actually existed anywhere
  // in calculateDamage.ts; Adaptability had no effect at all before this.
  const ditto = { species: "Ditto", nature: "Hardy" };

  it("boosts STAB to ×2.0 instead of the normal ×1.5", () => {
    const normalStab = calculateDamage({ species: "Garchomp", nature: "Hardy" }, ditto, "Earthquake");
    const adaptability = calculateDamage(
      { species: "Garchomp", nature: "Hardy", ability: "Adaptability" },
      ditto,
      "Earthquake",
    );
    expect(adaptability!.rolls[0]).toBeGreaterThan(normalStab!.rolls[0]);
  });

  it("has no effect on a move that doesn't get STAB in the first place", () => {
    // Ice Punch on Garchomp (Dragon/Ground) — Ice isn't one of Garchomp's
    // types, so there's no STAB for Adaptability to boost.
    const normal = calculateDamage({ species: "Garchomp", nature: "Hardy" }, ditto, "Ice Punch");
    const adaptability = calculateDamage(
      { species: "Garchomp", nature: "Hardy", ability: "Adaptability" },
      ditto,
      "Ice Punch",
    );
    expect(adaptability!.rolls).toEqual(normal!.rolls);
  });
});

describe("calculateDamage ability/item stage bucketing (bp/at/df/final)", () => {
  // None of these had dedicated tests before the formula-audit rewrite that
  // split the old single "modifier" float into 4 separately-staged chains
  // (bp/at/df/final) — this covers the ones that moved stage, or whose
  // exact value changed, to confirm the restructure didn't silently break
  // them.
  const ditto = { species: "Ditto", nature: "Hardy" };
  const garchomp = { species: "Garchomp", nature: "Hardy" };

  it("Technician boosts a move at or under 60 BP, but not one over it", () => {
    // Iron Head (80 BP) — too strong for Technician.
    const noTech = calculateDamage(garchomp, ditto, "Iron Head");
    const withTech = calculateDamage(
      { ...garchomp, ability: "Technician" },
      ditto,
      "Iron Head",
    );
    expect(withTech!.rolls).toEqual(noTech!.rolls);

    // Rock Tomb (50 BP) — within Technician's threshold.
    const noTechWeak = calculateDamage(garchomp, ditto, "Rock Tomb");
    const withTechWeak = calculateDamage(
      { ...garchomp, ability: "Technician" },
      ditto,
      "Rock Tomb",
    );
    expect(withTechWeak!.rolls[0]).toBeGreaterThan(noTechWeak!.rolls[0]);
  });

  it("Huge Power doubles Physical damage dealt (attack-stat stage)", () => {
    const normal = calculateDamage(garchomp, ditto, "Earthquake");
    const hugePower = calculateDamage(
      { ...garchomp, ability: "Huge Power" },
      ditto,
      "Earthquake",
    );
    expect(hugePower!.rolls[0]).toBeGreaterThan(normal!.rolls[0]);
  });

  it("Thick Fat halves Fire/Ice damage TAKEN (an attack-stat-stage reduction, not a final-damage one, per the reference)", () => {
    const normal = calculateDamage(garchomp, { species: "Ditto", nature: "Hardy", ability: "Thick Fat" }, "Ice Punch");
    const noThickFat = calculateDamage(garchomp, ditto, "Ice Punch");
    expect(normal!.rolls[0]).toBeLessThan(noThickFat!.rolls[0]);
  });

  it("Fur Coat halves Physical damage taken (a defense-stat-stage doubling)", () => {
    const normal = calculateDamage(garchomp, ditto, "Earthquake");
    const furCoat = calculateDamage(
      garchomp,
      { species: "Ditto", nature: "Hardy", ability: "Fur Coat" },
      "Earthquake",
    );
    expect(furCoat!.rolls[0]).toBeLessThan(normal!.rolls[0]);
  });

  it("Assault Vest boosts the holder's effective Sp. Def against Special moves only", () => {
    const normalSpecial = calculateDamage(garchomp, ditto, "Dragon Pulse");
    const vestSpecial = calculateDamage(
      garchomp,
      { species: "Ditto", nature: "Hardy", item: "Assault Vest" },
      "Dragon Pulse",
    );
    const normalPhysical = calculateDamage(garchomp, ditto, "Earthquake");
    const vestPhysical = calculateDamage(
      garchomp,
      { species: "Ditto", nature: "Hardy", item: "Assault Vest" },
      "Earthquake",
    );
    expect(vestSpecial!.rolls[0]).toBeLessThan(normalSpecial!.rolls[0]);
    expect(vestPhysical!.rolls[0]).toBe(normalPhysical!.rolls[0]);
  });

  it("Grassy Terrain halves Earthquake/Bulldoze against a grounded defender (newly modeled by the formula audit)", () => {
    const noTerrain = calculateDamage(garchomp, ditto, "Earthquake");
    const grassyTerrain = calculateDamage(garchomp, ditto, "Earthquake", { terrain: "Grassy" });
    expect(grassyTerrain!.rolls[0]).toBeLessThan(noTerrain!.rolls[0]);

    // Sanity: Grassy Terrain's general Grass-move boost is unrelated and
    // still applies normally to a Grass move — this new Earthquake/Bulldoze
    // case doesn't interfere with it.
    const noTerrainGrass = calculateDamage(garchomp, ditto, "Giga Drain");
    const grassyTerrainGrass = calculateDamage(garchomp, ditto, "Giga Drain", { terrain: "Grassy" });
    expect(grassyTerrainGrass!.rolls[0]).toBeGreaterThan(noTerrainGrass!.rolls[0]);
  });
});

/**
 * Golden values from Showdown's own damage calculator (@smogon/calc 0.12,
 * Gen 9 mechanics at level 50, Stat Points as EVs ×8 — Champions' stat
 * formula gives the same stats), checked roll for roll on 2026-10-14. Each
 * covers a rule added in that pass: move-flag abilities, -ate abilities,
 * weight/speed/HP-based power, stat overrides, Parental Bond, Aura Guard, Mega Sol.
 */
describe("matches Showdown's damage calc", () => {
  const cases: Array<[string, ParsedPokemon, ParsedPokemon, string, DamageCalcOptions, number, number]> = [
    ["Pixilate Hyper Voice (spread)", {species: "Sylveon",  ability: "Pixilate",  nature: "Modest",  evs: "31 SpA"}, {species: "Incineroar",  ability: "Intimidate",  evs: "31 HP"}, "Hyper Voice", {isDoublesFormat: true,  attackerHitsMultipleTargets: true}, 73, 87],
    ["Tough Claws Meteor Mash", {species: "Metagross",  ability: "Tough Claws",  nature: "Adamant",  evs: "31 Atk"}, {species: "Garchomp",  ability: "Rough Skin",  evs: "20 HP"}, "Meteor Mash", {isDoublesFormat: true}, 118, 139],
    ["Iron Fist Drain Punch", {species: "Conkeldurr",  ability: "Iron Fist",  nature: "Adamant",  evs: "31 Atk"}, {species: "Kingambit",  ability: "Defiant"}, "Drain Punch", {isDoublesFormat: true}, 304, 364],
    ["Strong Jaw Psychic Fangs", {species: "Tyrantrum",  ability: "Strong Jaw",  nature: "Jolly",  evs: "31 Atk"}, {species: "Amoonguss"}, "Psychic Fangs", {isDoublesFormat: true}, 182, 216],
    ["Sharpness Sacred Sword", {species: "Gallade",  ability: "Sharpness",  nature: "Adamant",  evs: "31 Atk"}, {species: "Kingambit",  ability: "Defiant"}, "Sacred Sword", {isDoublesFormat: true}, 420, 496],
    ["Mega Launcher Dark Pulse", {species: "Clawitzer",  ability: "Mega Launcher",  nature: "Modest",  evs: "31 SpA"}, {species: "Gholdengo",  ability: "Good as Gold"}, "Dark Pulse", {isDoublesFormat: true}, 154, 182],
    ["Sheer Force Life Orb Flamethrower", {species: "Nidoking",  item: "Life Orb",  ability: "Sheer Force",  nature: "Modest",  evs: "31 SpA"}, {species: "Rillaboom",  ability: "Grassy Surge"}, "Flamethrower", {isDoublesFormat: true}, 190, 226],
    ["Reckless Flare Blitz", {species: "Emboar",  ability: "Reckless",  nature: "Adamant",  evs: "31 Atk"}, {species: "Rillaboom",  ability: "Grassy Surge"}, "Flare Blitz", {isDoublesFormat: true}, 284, 336],
    ["Sand Force Earthquake in sand", {species: "Excadrill",  ability: "Sand Force",  nature: "Adamant",  evs: "31 Atk"}, {species: "Incineroar",  ability: "Intimidate"}, "Earthquake", {isDoublesFormat: true,  attackerHitsMultipleTargets: true,  weather: "Sand"}, 204, 242],
    ["Multiscale full HP", {species: "Glaceon",  nature: "Modest",  evs: "31 SpA"}, {species: "Dragonite",  ability: "Multiscale"}, "Ice Beam", {isDoublesFormat: true}, 168, 200],
    ["Multiscale at 90%", {species: "Glaceon",  nature: "Modest",  evs: "31 SpA"}, {species: "Dragonite",  ability: "Multiscale"}, "Ice Beam", {isDoublesFormat: true,  defenderCurrentHpPercent: 90}, 336, 400],
    ["Fluffy vs contact", {species: "Urshifu",  ability: "Unseen Fist",  nature: "Adamant",  evs: "31 Atk"}, {species: "Bewear",  ability: "Fluffy"}, "Close Combat", {isDoublesFormat: true}, 135, 160],
    ["Fluffy vs Fire", {species: "Charizard",  nature: "Modest",  evs: "31 SpA"}, {species: "Bewear",  ability: "Fluffy"}, "Flamethrower", {isDoublesFormat: true}, 224, 266],
    ["Punk Rock attacker", {species: "Toxtricity",  ability: "Punk Rock",  nature: "Modest",  evs: "31 SpA"}, {species: "Gholdengo"}, "Overdrive", {isDoublesFormat: true,  attackerHitsMultipleTargets: true}, 72, 85],
    ["Punk Rock defender", {species: "Sylveon",  ability: "Pixilate",  nature: "Modest",  evs: "31 SpA"}, {species: "Toxtricity",  ability: "Punk Rock"}, "Hyper Voice", {isDoublesFormat: true,  attackerHitsMultipleTargets: true}, 22, 26],
    ["Low Kick vs Snorlax", {species: "Rillaboom",  nature: "Adamant",  evs: "31 Atk"}, {species: "Snorlax",  ability: "Thick Fat"}, "Low Kick", {isDoublesFormat: true}, 204, 242],
    ["Grass Knot vs Gholdengo", {species: "Rillaboom",  nature: "Modest",  evs: "31 SpA"}, {species: "Gholdengo"}, "Grass Knot", {isDoublesFormat: true}, 19, 23],
    ["Heavy Slam", {species: "Copperajah",  ability: "Sheer Force",  nature: "Adamant",  evs: "31 Atk"}, {species: "Sylveon"}, "Heavy Slam", {isDoublesFormat: true}, 318, 374],
    ["Heavy Slam w/ Heavy Metal", {species: "Copperajah",  ability: "Heavy Metal",  nature: "Adamant",  evs: "31 Atk"}, {species: "Sylveon"}, "Heavy Slam", {isDoublesFormat: true}, 318, 374],
    ["Gyro Ball vs fast target", {species: "Ferrothorn",  nature: "Brave",  evs: "31 Atk"}, {species: "Dragapult",  nature: "Jolly",  evs: "31 Spe"}, "Gyro Ball", {isDoublesFormat: true}, 139, 165],
    ["Electro Ball", {species: "Regieleki",  ability: "Transistor",  nature: "Timid",  evs: "31 SpA / 31 Spe"}, {species: "Gyarados"}, "Electro Ball", {isDoublesFormat: true}, 300, 352],
    ["Flail at 10%", {species: "Dewgong",  nature: "Adamant",  evs: "31 Atk"}, {species: "Incineroar"}, "Flail", {isDoublesFormat: true,  attackerCurrentHpPercent: 10}, 68, 81],
    ["Body Press", {species: "Corviknight",  nature: "Impish",  evs: "31 Def"}, {species: "Kingambit"}, "Body Press", {isDoublesFormat: true}, 148, 176],
    ["Psyshock vs Assault Vest", {species: "Hatterene",  nature: "Modest",  evs: "31 SpA"}, {species: "Amoonguss",  item: "Assault Vest",  evs: "31 HP"}, "Psyshock", {isDoublesFormat: true}, 206, 246],
    ["Facade while burned", {species: "Ursaluna",  ability: "Bulletproof",  nature: "Adamant",  evs: "31 Atk"}, {species: "Incineroar"}, "Facade", {isDoublesFormat: true,  attackerBurned: true,  attackerStatused: true}, 151, 178],
    ["Knock Off vs item", {species: "Incineroar",  nature: "Adamant",  evs: "31 Atk"}, {species: "Amoonguss",  item: "Sitrus Berry"}, "Knock Off", {isDoublesFormat: true}, 111, 132],
    ["Knock Off vs no item", {species: "Incineroar",  nature: "Adamant",  evs: "31 Atk"}, {species: "Amoonguss"}, "Knock Off", {isDoublesFormat: true}, 75, 88],
    ["Acrobatics no item", {species: "Hawlucha",  nature: "Jolly",  evs: "31 Atk"}, {species: "Rillaboom"}, "Acrobatics", {isDoublesFormat: true}, 162, 192],
    ["Weather Ball in rain", {species: "Pelipper",  nature: "Modest",  evs: "31 SpA"}, {species: "Incineroar"}, "Weather Ball", {isDoublesFormat: true,  weather: "Rain"}, 252, 296],
    ["Terrain Pulse Electric", {species: "Raichu",  nature: "Timid",  evs: "31 SpA"}, {species: "Pelipper"}, "Terrain Pulse", {isDoublesFormat: true,  terrain: "Electric"}, 460, 544],
    ["Expanding Force Psychic Terrain", {species: "Indeedee-F",  nature: "Modest",  evs: "31 SpA"}, {species: "Amoonguss"}, "Expanding Force", {isDoublesFormat: true,  attackerHitsMultipleTargets: true,  terrain: "Psychic"}, 210, 248],
    ["Hex vs statused", {species: "Gengar",  nature: "Timid",  evs: "31 SpA"}, {species: "Incineroar"}, "Hex", {isDoublesFormat: true,  defenderStatused: true}, 60, 72],
    ["Stored Power +2/+2", {species: "Espathra",  nature: "Modest",  evs: "31 SpA"}, {species: "Amoonguss"}, "Stored Power", {isDoublesFormat: true,  attackerStages: {spa: 2,  spd: 2}}, 374, 444],
    ["Sniper crit", {species: "Kingdra",  ability: "Sniper",  nature: "Modest",  evs: "31 SpA"}, {species: "Incineroar"}, "Hydro Pump", {isDoublesFormat: true,  isCritical: true}, 408, 486],
    ["Solar Power in sun", {species: "Charizard",  ability: "Solar Power",  nature: "Modest",  evs: "31 SpA"}, {species: "Rillaboom"}, "Flamethrower", {isDoublesFormat: true,  weather: "Sun"}, 450, 530],
    ["Parental Bond", {species: "Kangaskhan-Mega",  ability: "Parental Bond",  nature: "Adamant",  evs: "31 Atk"}, {species: "Incineroar"}, "Double-Edge", {isDoublesFormat: true}, 146, 175],
    ["Hustle", {species: "Durant",  ability: "Hustle",  nature: "Jolly",  evs: "31 Atk"}, {species: "Sylveon"}, "Iron Head", {isDoublesFormat: true}, 254, 302],
    ["Water Bubble defender vs Fire", {species: "Charizard",  nature: "Modest",  evs: "31 SpA"}, {species: "Araquanid",  ability: "Water Bubble"}, "Flamethrower", {isDoublesFormat: true}, 30, 36],
    ["Water Bubble attacker", {species: "Araquanid",  ability: "Water Bubble",  nature: "Adamant",  evs: "31 Atk"}, {species: "Incineroar"}, "Liquidation", {isDoublesFormat: true}, 234, 276],
    ["Liquid Voice Hyper Voice", {species: "Primarina",  ability: "Liquid Voice",  nature: "Modest",  evs: "31 SpA"}, {species: "Incineroar"}, "Hyper Voice", {isDoublesFormat: true,  attackerHitsMultipleTargets: true}, 134, 158],
    ["Purifying Salt vs Ghost", {species: "Gengar",  nature: "Timid",  evs: "31 SpA"}, {species: "Garganacl",  ability: "Purifying Salt"}, "Shadow Ball", {isDoublesFormat: true}, 37, 45],
    ["Grass Pelt Grassy Terrain", {species: "Kingambit",  nature: "Adamant",  evs: "31 Atk"}, {species: "Gogoat",  ability: "Grass Pelt"}, "Iron Head", {isDoublesFormat: true,  terrain: "Grassy"}, 76, 90],
    ["Solar Beam in rain", {species: "Venusaur",  nature: "Modest",  evs: "31 SpA"}, {species: "Pelipper"}, "Solar Beam", {isDoublesFormat: true,  weather: "Rain"}, 63, 75],
    ["Punching Glove", {species: "Hitmonchan",  item: "Punching Glove",  nature: "Adamant",  evs: "31 Atk"}, {species: "Kingambit"}, "Drain Punch", {isDoublesFormat: true}, 232, 276],
    ["Aerilate Mega Salamence Double-Edge", {species: "Salamence",  item: "Salamencite",  ability: "Aerilate",  nature: "Adamant",  evs: "31 Atk"}, {species: "Rillaboom"}, "Double-Edge", {isDoublesFormat: true}, 318, 374],
    ["Water Spout at 50%", {species: "Kyogre",  nature: "Modest",  evs: "31 SpA"}, {species: "Incineroar"}, "Water Spout", {isDoublesFormat: true,  attackerHitsMultipleTargets: true,  attackerCurrentHpPercent: 50}, 128, 152],
    ["Foul Play", {species: "Grimmsnarl",  nature: "Careful"}, {species: "Kingambit",  nature: "Adamant",  evs: "31 Atk"}, "Foul Play", {isDoublesFormat: true}, 39, 46],
    ["Aura Guard vs contact", {species: "Garchomp",  nature: "Jolly",  evs: "32 Atk"}, {species: "Lucario",  item: "Lucarionite Z",  ability: "Inner Focus"}, "Dragon Claw", {isDoublesFormat: true}, 23, 27],
    ["Mega Sol Weather Ball (no weather)", {species: "Meganium",  item: "Meganiumite",  nature: "Modest",  evs: "32 SpA"}, {species: "Rillaboom"}, "Weather Ball", {isDoublesFormat: true}, 270, 318],
    ["Dragonize Mega Feraligatr Double-Edge", {species: "Feraligatr",  item: "Feraligite",  nature: "Adamant",  evs: "32 Atk"}, {species: "Garchomp"}, "Double-Edge", {isDoublesFormat: true}, 330, 390],
    ["Max SP 32 Close Combat", {species: "Lucario",  nature: "Adamant",  evs: "32 Atk"}, {species: "Kingambit",  evs: "32 HP / 32 Def"}, "Close Combat", {isDoublesFormat: true}, 280, 336],
  ];

  it.each(cases)("%s", (_name, attacker, defender, move, options, min, max) => {
    const result = calculateDamage(attacker, defender, move, options);
    expect([result?.rolls[0], result?.rolls[15]]).toEqual([min, max]);
  });
});

describe("Last Respects", () => {
  it("gains 50 power per fainted ally", () => {
    const attacker = { species: "Basculegion", ability: "Adaptability", nature: "Adamant", evs: "31 Atk" };
    const defender = { species: "Incineroar" };
    const none = calculateDamage(attacker, defender, "Last Respects", {});
    const two = calculateDamage(attacker, defender, "Last Respects", { attackerFaintedAllies: 2 });
    // 50 → 150 power: three times the damage, give or take rounding.
    const ratio = two!.rolls[15] / none!.rolls[15];
    expect(ratio).toBeGreaterThan(2.8);
    expect(ratio).toBeLessThan(3.1);
  });
});

describe("Rage Fist", () => {
  it("gains 50 power per time the user was hit, up to 6", () => {
    const attacker = { species: "Annihilape", nature: "Adamant", evs: "32 Atk" };
    const defender = { species: "Incineroar" };
    const none = calculateDamage(attacker, defender, "Rage Fist", {});
    const two = calculateDamage(attacker, defender, "Rage Fist", { attackerTimesHit: 2 });
    const capped = calculateDamage(attacker, defender, "Rage Fist", { attackerTimesHit: 9 });
    const six = calculateDamage(attacker, defender, "Rage Fist", { attackerTimesHit: 6 });
    // 50 → 150 power: three times the damage, give or take rounding.
    const ratio = two!.rolls[15] / none!.rolls[15];
    expect(ratio).toBeGreaterThan(2.8);
    expect(ratio).toBeLessThan(3.1);
    expect(capped!.rolls).toEqual(six!.rolls);
  });
});

describe("multi-hit moves", () => {
  // Totals checked against Showdown's damage calc (Gen 9, level 50, 248 Atk EVs = 31 SP).
  const technician = (species: string) => ({
    species,
    ability: "Technician",
    nature: "Jolly",
    evs: "31 Atk",
  });
  const defender = { species: "Incineroar" };

  it.each([
    ["Population Bomb", "Maushold", undefined, 10, 210, 250],
    ["Population Bomb", "Maushold", 4, 4, 84, 100],
    ["Bullet Seed", "Cinccino", undefined, 3, 27, 33],
    ["Bullet Seed", "Cinccino", 5, 5, 45, 55],
  ] as const)("%s from %s, %s hits requested", (move, species, hits, hitCount, min, max) => {
    const result = calculateDamage(technician(species), defender, move, { hits, isDoublesFormat: true });
    expect(result?.hitCount).toBe(hitCount);
    expect([result?.rolls[0], result?.rolls[15]]).toEqual([min, max]);
  });

  it("offers a hits choice only for moves whose hit count varies", () => {
    expect(moveHitRange("Population Bomb")).toEqual({ min: 1, max: 10, default: 10 });
    expect(moveHitRange("Bullet Seed")).toEqual({ min: 2, max: 5, default: 3 });
    expect(moveHitRange("Bullet Seed", "Skill Link")).toEqual({ min: 2, max: 5, default: 5 });
    expect(moveHitRange("Triple Axel")).toEqual({ min: 1, max: 3, default: 3 });
    expect(moveHitRange("Dual Wingbeat")).toBeNull();
    expect(moveHitRange("Flamethrower")).toBeNull();
  });
});
