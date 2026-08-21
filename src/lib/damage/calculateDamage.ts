import movesData from "@/data/moves.json";
import typeChartData from "@/data/typeChart.json";
import speciesTypesData from "@/data/speciesTypes.json";
import { calculateFinalStats } from "@/lib/stats/calculateFinalStats";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import {
  SPECIES_ALIASES,
  ABILITY_DAMAGE_MODIFIERS,
  TYPE_IMMUNITY_ABILITIES,
  ITEM_DAMAGE_MODIFIERS,
} from "@/constants";
import type { AbilityDamageModifierSide } from "@/constants/abilityDamageModifiers";
import type {
  DamageCalcOptions,
  DamageResult,
  MoveCategory,
  MoveData,
  ParsedPokemon,
} from "@/types";

const MOVES = movesData as unknown as Record<string, MoveData>;
const TYPE_CHART = typeChartData as unknown as Record<string, Record<string, number>>;
const SPECIES_TYPES = speciesTypesData as unknown as Record<string, string[]>;

/** VGC ("Pokémon Champions") play is always Level 50 — see calculateFinalStats.ts. */
const LEVEL = 50;
/** floor(2*Level/5 + 2), the level term of the standard damage formula — a fixed constant at Level 50. */
const LEVEL_TERM = Math.floor((2 * LEVEL) / 5 + 2);
/** Showdown-calc convention: 16 rolls spanning 85%-100% damage in 1% steps. */
const DAMAGE_ROLL_PERCENTS = Array.from({ length: 16 }, (_, i) => 85 + i);
/** Pokémon's own fixed-point unit for chained damage modifiers — see pokeRound/chainMods. */
const FIXED_POINT = 0x1000;

/**
 * Game Freak's own rounding rule for a chained fixed-point modifier: exactly
 * .5 rounds DOWN, not up (unlike JS's `Math.round`, which rounds .5 up).
 * Confirmed against the NCP-VGC-Damage-Calculator reference's own
 * `pokeRound` — this is a real, documented internal-engine quirk, not an
 * arbitrary choice. Used every time a *combined* chain of modifiers is
 * applied to a stat/base-power/damage value; the intermediate accumulation
 * inside chainMods below uses standard rounding instead, matching the
 * reference's own two-different-rounding-functions split exactly.
 */
function pokeRound(num: number): number {
  return num % 1 > 0.5 ? Math.ceil(num) : Math.floor(num);
}

/**
 * Combines a list of 4096ths (`0x1000`) fixed-point modifiers into one,
 * via the real games' own sequential chaining — each step uses standard
 * round-half-up (matching the reference's `chainMods`, which differs from
 * `pokeRound` above on purpose: the *intermediate* steps use `Math.round`,
 * only the *final* application of the combined chain to a real value uses
 * `pokeRound`). A modifier exactly equal to `FIXED_POINT` (i.e. ×1, no
 * effect) is skipped, matching the reference skipping neutral entries.
 */
function chainMods(mods: number[]): number {
  let combined = FIXED_POINT;
  for (const mod of mods) {
    if (mod !== FIXED_POINT) {
      combined = Math.round((combined * mod) / FIXED_POINT);
    }
  }
  return combined;
}

/** Same species+item resolution as calculateFinalStats/resolveSpeciesImage, so typing always agrees with the form shown/computed elsewhere. */
function resolveTypes(species: string, item?: string): string[] | undefined {
  for (const key of candidateFormKeys(species, item)) {
    const entry = SPECIES_TYPES[key] ?? SPECIES_TYPES[SPECIES_ALIASES[key]];
    if (entry) return entry;
  }
  return undefined;
}

function resolveMove(name: string): MoveData | undefined {
  return MOVES[normalizeSpeciesKey(name)];
}

/** Gravity removes the Flying-type's chart immunity to Ground-type moves — the only 0x entry Ground has — so this ignores the Flying type in that one case rather than looking up the chart normally. */
function typeEffectiveness(moveType: string, defenderTypes: string[], gravity = false): number {
  const types =
    gravity && moveType === "Ground" ? defenderTypes.filter((t) => t !== "Flying") : defenderTypes;
  return types.reduce(
    (multiplier, defendingType) => multiplier * (TYPE_CHART[moveType]?.[defendingType] ?? 1),
    1,
  );
}

/** Not affected by Electric/Grassy/Psychic Terrain's boost or Misty Terrain's protection, and immune to Ground moves — unless Gravity is active, which grounds everyone regardless of type/ability/item. */
function isGrounded(
  types: string[],
  ability: string | undefined,
  item: string | undefined,
  gravity: boolean | undefined,
): boolean {
  if (gravity) return true;
  return !types.includes("Flying") && ability !== "Levitate" && item !== "Air Balloon";
}

/**
 * Sun/Rain boost their own type and weaken the opposite one, applied to
 * `baseDamage` (via `pokeRound`) before the 85-100% roll — NOT chained with
 * anything else, its own dedicated step, per the reference's
 * `calcGeneralMods`. Sand/Snow don't multiply damage directly (see the
 * Sp.Def/Def boost applied to the defense stat instead, before the
 * base-damage formula runs).
 */
function weatherBaseDamageMod4096(weather: DamageCalcOptions["weather"], moveType: string): number {
  if (weather === "Sun") return moveType === "Fire" ? 0x1800 : moveType === "Water" ? 0x800 : FIXED_POINT;
  if (weather === "Rain") return moveType === "Water" ? 0x1800 : moveType === "Fire" ? 0x800 : FIXED_POINT;
  return FIXED_POINT;
}

/** Electric/Grassy/Psychic Terrain boost their own type's move power, but only for a grounded attacker — an airborne (Flying-type/Levitate/Air Balloon) attacker gets nothing from them. Base-power stage (0x14CD, the modern Gen 8+ value — it was 0x1800/1.5 pre-Gen 8), same bucket as the defensive terrain effects below. */
function terrainAttackMod4096(
  terrain: DamageCalcOptions["terrain"],
  moveType: string,
  attackerGrounded: boolean,
): number {
  if (!attackerGrounded) return FIXED_POINT;
  if (terrain === "Electric" && moveType === "Electric") return 0x14cd;
  if (terrain === "Grassy" && moveType === "Grass") return 0x14cd;
  if (terrain === "Psychic" && moveType === "Psychic") return 0x14cd;
  return FIXED_POINT;
}

/**
 * Misty Terrain halves Dragon-type damage against a grounded defender;
 * Grassy Terrain also halves Earthquake/Bulldoze specifically against a
 * grounded defender (a real, separate mechanic surfaced by the formula
 * audit that hadn't been modeled before) — both are base-power stage,
 * same bucket the reference itself uses for these.
 */
function terrainDefenseMod4096(
  terrain: DamageCalcOptions["terrain"],
  moveType: string,
  moveKey: string,
  defenderGrounded: boolean,
): number {
  if (!defenderGrounded) return FIXED_POINT;
  if (terrain === "Misty" && moveType === "Dragon") return 0x800;
  if (terrain === "Grassy" && (moveKey === "earthquake" || moveKey === "bulldoze")) return 0x800;
  return FIXED_POINT;
}

/**
 * Reflect halves Physical damage taken, Light Screen halves Special, Aurora
 * Veil halves both (and replaces the need for the other two — not enforced
 * here, stacking is just up to what the caller passes in) — but only in
 * Singles. In Doubles/multi-battle formats, screens are weaker: ×2732/4096
 * (0xAAC, ≈0.667, not 0.5) per the real games' own fixed-point modifier
 * value — confirmed against the NCP-VGC-Damage-Calculator reference's
 * `calcFinalMods` (`field.format !== "Singles" ? 0xAAC : 0x800`). This app
 * defaults to Doubles (see battleFormat in DamageCalculator.tsx), so this
 * was a real, live gap until a user asked for a formula audit against that
 * reference. Final stage — chained together with every other end-of-roll
 * modifier (Friend Guard, resist berries, Life Orb, ...), not applied
 * separately.
 */
function screenMod4096(
  screens: DamageCalcOptions["defenderScreens"],
  category: MoveCategory,
  isDoublesFormat: boolean,
): number {
  const half = isDoublesFormat ? 0xaac : 0x800;
  if (!screens) return FIXED_POINT;
  if (screens.auroraVeil) return half;
  if (screens.reflect && category === "Physical") return half;
  if (screens.lightScreen && category === "Special") return half;
  return FIXED_POINT;
}

/** Stage -> [numerator, denominator] multiplier table, the standard Gen 3+ stat stage formula. */
const STAT_STAGE_MULTIPLIERS: Record<number, [number, number]> = {
  6: [8, 2],
  5: [7, 2],
  4: [6, 2],
  3: [5, 2],
  2: [4, 2],
  1: [3, 2],
  0: [2, 2],
  [-1]: [2, 3],
  [-2]: [2, 4],
  [-3]: [2, 5],
  [-4]: [2, 6],
  [-5]: [2, 7],
  [-6]: [2, 8],
};

function applyStatStage(stat: number, stage: number | undefined): number {
  const clamped = Math.max(-6, Math.min(6, Math.round(stage ?? 0)));
  const [numerator, denominator] = STAT_STAGE_MULTIPLIERS[clamped];
  return Math.floor((stat * numerator) / denominator);
}

/** Triple Kick and Triple Axel are the only two moves where each successive hit's power increases (hit N uses basePower * N) rather than staying flat across all hits. */
const INCREASING_POWER_MULTI_HIT_MOVES = new Set(["triple-kick", "triple-axel"]);

/**
 * Foul Play's damage is computed off the DEFENDER's own Attack stat (and the
 * defender's own Attack stage) instead of the attacker's — everything else
 * about the hit (the attacker's own type for STAB, the attacker's item/
 * ability modifiers, the defender's Defense stat) is unaffected. This
 * naturally excludes the defender's ability-based Attack multipliers (Huge
 * Power, Guts, ...), matching the real mechanic, since `calculateFinalStats`
 * already keeps those out of the raw stat — they're applied as separate
 * damage-side modifiers elsewhere in this file, not baked into
 * `defenderStats.atk`. Confirmed against the reference's own
 * `attackSource = move.name === "Foul Play" ? defender : attacker`. Body
 * Press (uses the attacker's own DEFENSE as its attack stat), and Photon
 * Geyser/Light That Burns The Sky/Shell Side Arm/Tera Blast (use whichever
 * of Atk/SpA is higher) are related but different quirks the same reference
 * lists — deliberately left out of this fix since they weren't asked about.
 */
const TARGET_ATTACK_STAT_MOVES = new Set(["foul-play"]);

/**
 * Water Spout and Eruption's power scales with the ATTACKER's own current
 * HP: `floor(150 * currentHP / maxHP)`, minimum 1. moves.json stores 150 for
 * both (PokeAPI's full-HP value) since it has no notion of this scaling, so
 * without this the engine would always compute as if the attacker were at
 * full HP regardless of the Current HP slider. Other HP/weight/speed-scaled
 * moves (Flail, Reversal, Grass Knot, Gyro Ball, ...) are still deliberately
 * out of scope — PokeAPI reports `power: null` for those (a different kind
 * of gap, already handled by the early `!move.power` return below), whereas
 * these two are the only ones PokeAPI mislabels as a fixed value.
 */
const HP_SCALED_POWER_MOVES = new Set(["water-spout", "eruption"]);

function resolveMovePower(moveKey: string, basePower: number, attackerCurrentHpPercent: number | undefined): number {
  if (!HP_SCALED_POWER_MOVES.has(moveKey)) return basePower;
  const percent = attackerCurrentHpPercent ?? 100;
  return Math.max(1, Math.floor((basePower * percent) / 100));
}

/**
 * How many times a move hits this calculation. Fixed multi-hit moves (Dual
 * Wingbeat, Double Hit, Dragon Darts, ...) always use their exact count.
 * Variable ones (Bullet Seed, Icicle Spear, ...) default to 3 — the
 * probability-weighted expected value of the standard Gen 5+ 2/3/4/5-hit
 * distribution (35%/35%/15%/15%) is exactly 3, so this isn't an arbitrary
 * pick — unless the attacker has Skill Link, which guarantees the max.
 * Single-hit moves (no minHits/maxHits in the data) always return 1.
 */
function resolveHitCount(move: MoveData, hasSkillLink: boolean): number {
  if (move.minHits === undefined || move.maxHits === undefined) return 1;
  if (move.minHits === move.maxHits) return move.minHits;
  return hasSkillLink ? move.maxHits : 3;
}

/** Looks up one ability/item modifier "side" (see abilityDamageModifiers.ts) if its conditions match this move/matchup AND it belongs to the requested `stage` — returns the neutral `FIXED_POINT` (×1, a chainMods no-op) otherwise. */
function sideMod4096(
  side: AbilityDamageModifierSide | undefined,
  stage: AbilityDamageModifierSide["stage"],
  move: MoveData,
  typeMultiplier: number,
): number {
  if (!side || side.stage !== stage) return FIXED_POINT;
  if (side.types && !side.types.includes(move.type)) return FIXED_POINT;
  if (
    side.categories &&
    !side.categories.includes(move.category as Exclude<MoveCategory, "Status">)
  ) {
    return FIXED_POINT;
  }
  if (side.onlySuperEffective && typeMultiplier <= 1) return FIXED_POINT;
  if (side.maxBasePower !== undefined && (move.power ?? 0) > side.maxBasePower) return FIXED_POINT;
  return side.multiplier4096;
}

/**
 * Approximates KO chance by treating each hit as drawing the SAME roll
 * repeatedly, rather than convolving independent rolls per hit. Exact for the
 * "guaranteed" case (the worst roll repeated N times is a rigorous lower
 * bound — if even that clears the target's HP, every other combination
 * does too); an approximation otherwise, since the true chance for a
 * non-guaranteed N-hit KO depends on independent-roll combinations this
 * shortcut doesn't model. Same "close enough for a basic calculator"
 * trade-off as the ability/item multiplier tables (see
 * abilityDamageModifiers.ts's file header) — worth revisiting later.
 */
function describeKoChance(rolls: number[], defenderHp: number): string {
  for (let hits = 1; hits <= 4; hits++) {
    const koCount = rolls.filter((roll) => roll * hits >= defenderHp).length;
    const label = hits === 1 ? "OHKO" : `${hits}HKO`;
    if (koCount === rolls.length) return `guaranteed ${label}`;
    if (koCount > 0) {
      const chance = Math.round((koCount / rolls.length) * 1000) / 10;
      return `${chance}% chance to ${label}`;
    }
  }
  return "not a KO in 4 hits";
}

function roundPercent(damage: number, hp: number): number {
  return Math.round((damage / hp) * 1000) / 10;
}

/**
 * Computes a move's TOTAL damage range from `attacker` against `defender`
 * (both already-parsed Pokémon — species/item/ability/nature/Stat Points, as
 * captured from a Showdown paste), plus optional battle-state `options`
 * (weather/terrain/screens/burn/critical hit/Helping Hand/Friend Guard/
 * Protect/Fairy Aura/Gravity/stat stages/current HP). "Total" matters for
 * multi-hit moves (Dual Wingbeat, Bullet Seed, ...) — see resolveHitCount
 * and DamageResult.hitCount. A spread move (MoveData.isSpread — Earthquake,
 * Rock Slide, Water Spout, ...) takes the standard doubles ×0.75 reduction
 * when `options.attackerHitsMultipleTargets` is set; a single-target hit
 * from the same move (the partner already fainted, or it just wasn't aimed
 * at both foes) correctly doesn't. Helping Hand and Friend Guard are really
 * doubles ally effects but are modeled as flat toggles here since this app
 * doesn't track a separate partner Pokémon.
 *
 * Modifiers are applied via the real games' own fixed-point "chain
 * modifiers" system — base power, the attack stat, and the defense stat
 * each get their own chain of 4096ths modifiers applied via `chainMods` +
 * `pokeRound`, matching the exact stage each real modifier applies at
 * (confirmed move-by-move, ability-by-ability against the
 * NCP-VGC-Damage-Calculator reference's own `damage_SV.js`/
 * `damage_MASTER.js` rather than approximated as a single end-of-calculation
 * multiplier, which is what this engine did before this pass and could
 * drift by a rounding step or two under enough stacked modifiers). The
 * 85%-100% random roll is applied immediately after the base-damage
 * formula — BEFORE STAB/type effectiveness/burn/every other end-stage
 * modifier — per the reference's own order, not last.
 *
 * Critical hits apply a flat ×1.5 to `baseDamage` via plain `Math.floor`
 * (confirmed NOT `pokeRound` here — the reference's own `calcGeneralMods`
 * uses `Math.floor` specifically for this one step) and correctly ignore a
 * negative attacker stage / positive defender stage for the relevant stat,
 * but don't ignore defensive abilities like Solid Rock/Filter — a
 * deliberate simplification.
 *
 * Foul Play uses the DEFENDER's own Attack stat and Attack stage instead of
 * the attacker's — see TARGET_ATTACK_STAT_MOVES — everything else about the
 * hit (STAB from the attacker's type, the attacker's item/ability
 * modifiers) is unaffected.
 *
 * Recoil (MoveData.recoilFraction — Wave Crash, Flare Blitz, ...) and Life
 * Orb's flat 10% max HP are both reported back as
 * DamageResult.recoilMinPercent/recoilMaxPercent, a percent of the
 * ATTACKER's own max HP — undefined (no note) when neither applies, and the
 * two sources stack when both do (a non-Mega recoil-move holder can also
 * carry Life Orb).
 *
 * Focus Sash and Sturdy are modeled per hit: whichever hit would otherwise
 * reduce the defender from full HP to 0 instead leaves it at 1, and the
 * save only applies once (a later hit — whether from the same multi-hit
 * move or a later describeKoChance "turn" — starts from non-full HP and
 * gets no further protection).
 *
 * Returns `null` when either Pokémon's form isn't in the static species
 * data, the move isn't recognized, or the move doesn't do direct formula
 * damage (Status moves, and fixed/variable-damage moves like Seismic Toss
 * or Counter — PokeAPI's `power` is `null` for these, which this
 * deliberately doesn't special-case yet).
 *
 * Abilities are resolved through resolveEffectiveAbility, not read straight
 * off `pokemon.ability` — a Mega form's ability is often different from
 * (and always independent of) the base form's, but a pasted export's
 * Ability: line only ever records the base form's, since Showdown has no
 * separate slot for "ability after Mega Evolving". See
 * megaFormAbilities.ts.
 */
export function calculateDamage(
  attacker: ParsedPokemon,
  defender: ParsedPokemon,
  moveName: string,
  options: DamageCalcOptions = {},
): DamageResult | null {
  const resolvedMove = resolveMove(moveName);
  if (!resolvedMove || resolvedMove.category === "Status" || !resolvedMove.power) return null;
  // Re-bound to a non-optional local (power narrowed to `number`, not
  // `number | null`) — TS's control-flow narrowing from the guard above
  // doesn't carry into the nested closures below (baseDamageForHit, the
  // rolls.map callback), so every `move.` reference from here on needs this
  // narrowed binding, not the original `resolvedMove`.
  const move = { ...resolvedMove, power: resolvedMove.power as number };
  const moveKey = normalizeSpeciesKey(moveName);
  // Narrowed to a plain number so it stays typed correctly inside the
  // rolls-computation closure below (TS can't carry the `!move.power` guard
  // across a captured object property). Water Spout/Eruption get scaled down
  // from moves.json's stored full-HP value here — see resolveMovePower. This
  // is the "raw" power the bp-stage modifier chain (below) then multiplies
  // further, mirroring the reference's own basePowerFunc -> calcBPMods split.
  const rawMovePower: number = resolveMovePower(moveKey, move.power, options.attackerCurrentHpPercent);

  const isPhysical = move.category === "Physical";
  const attackStatKey: "atk" | "spa" = isPhysical ? "atk" : "spa";
  const defenseStatKey: "def" | "spd" = isPhysical ? "def" : "spd";

  const attackerStats = calculateFinalStats(attacker);
  const defenderStats = calculateFinalStats(defender);
  if (!attackerStats || !defenderStats) return null;

  const attackerTypes = resolveTypes(attacker.species, attacker.item);
  const defenderTypes = resolveTypes(defender.species, defender.item);
  if (!attackerTypes || !defenderTypes) return null;

  // Mega Evolution replaces the ability entirely — a pasted export's
  // Ability: line only ever reflects the base form, so this can differ from
  // pokemon.ability whenever the held item is a Mega Stone with a curated
  // override (see megaFormAbilities.ts).
  const attackerAbility = resolveEffectiveAbility(
    attacker.species,
    attacker.item,
    attacker.ability,
  );
  const defenderAbility = resolveEffectiveAbility(
    defender.species,
    defender.item,
    defender.ability,
  );

  const hitCount = resolveHitCount(move, attackerAbility === "Skill Link");

  // A defender that used Protect blocks the hit entirely, regardless of type
  // — checked before type effectiveness since it isn't a type interaction.
  if (options.defenderProtected) {
    return {
      rolls: new Array(DAMAGE_ROLL_PERCENTS.length).fill(0),
      minPercent: 0,
      maxPercent: 0,
      koChanceText: "blocked by Protect",
      hitCount,
      attackStatKey,
      defenseStatKey,
      isSpreadMove: !!move.isSpread,
    };
  }

  const typeMultiplier = typeEffectiveness(move.type, defenderTypes, options.gravity);

  // Levitate's Ground immunity is negated by Gravity (like the Flying-type
  // chart immunity handled inside typeEffectiveness above) — the other
  // ability immunities (Water Absorb, Flash Fire, ...) are unrelated to
  // being airborne, so Gravity doesn't touch those.
  const levitateNegatedByGravity =
    options.gravity && defenderAbility === "Levitate" && move.type === "Ground";

  // Immune either from the raw type chart (e.g. Ground vs. Electric), an
  // ability override (Levitate, Water Absorb, ...), or Air Balloon's
  // Ground-move immunity (also negated by Gravity) — no formula damage
  // applies in any of these cases, so this short-circuits before any of it
  // runs.
  if (
    typeMultiplier === 0 ||
    (defenderAbility &&
      TYPE_IMMUNITY_ABILITIES[defenderAbility] === move.type &&
      !levitateNegatedByGravity) ||
    (defender.item === "Air Balloon" && move.type === "Ground" && !options.gravity)
  ) {
    return {
      rolls: new Array(DAMAGE_ROLL_PERCENTS.length).fill(0),
      minPercent: 0,
      maxPercent: 0,
      koChanceText: "immune",
      hitCount,
      attackStatKey,
      defenseStatKey,
      isSpreadMove: !!move.isSpread,
    };
  }

  const attackerGrounded = isGrounded(attackerTypes, attackerAbility, attacker.item, options.gravity);
  const defenderGrounded = isGrounded(defenderTypes, defenderAbility, defender.item, options.gravity);

  // A critical hit ignores a NEGATIVE attacker stage and a POSITIVE defender
  // stage for the specific stat this move uses — the real Gen 6+ crit
  // mechanic — not all stat stages, just the offense/defense pair actually
  // in play for this hit. For Foul Play, the "attacker" stat/stage below
  // means the DEFENDER's own Attack/Attack stage — see
  // TARGET_ATTACK_STAT_MOVES — so a crit still ignores whichever stage is
  // unfavorable to the hit's damage output, just sourced from the other
  // Pokémon.
  const usesTargetAttackStat = TARGET_ATTACK_STAT_MOVES.has(moveKey);
  const rawAttackStat = usesTargetAttackStat ? defenderStats.atk : attackerStats[attackStatKey];
  const attackerStage = usesTargetAttackStat
    ? options.defenderStages?.atk
    : options.attackerStages?.[attackStatKey];
  const effectiveAttackerStage = options.isCritical
    ? Math.max(attackerStage ?? 0, 0)
    : attackerStage;
  const stageAdjustedAttackStat = applyStatStage(rawAttackStat, effectiveAttackerStage);

  const defenderStage = options.defenderStages?.[defenseStatKey];
  const effectiveDefenderStage = options.isCritical
    ? Math.min(defenderStage ?? 0, 0)
    : defenderStage;
  const stageAdjustedDefenseStat = applyStatStage(defenderStats[defenseStatKey], effectiveDefenderStage);

  // Guts both cancels burn's halving and separately boosts Attack ×1.5 while
  // afflicted by ANY status condition (not just burn) — two distinct effects
  // that don't fit abilityDamageModifiers.ts's "flat multiplier scoped by
  // type/category" shape, so (like Adaptability's STAB interaction below)
  // it's special-cased here instead of listed in that table. Confirmed
  // against the reference: Guts' ×1.5 lives in the SAME attack-stat-stage
  // bucket as Huge Power, chained together with it below.
  const hasGuts = attackerAbility === "Guts";
  const isStatused = options.attackerBurned || options.attackerStatused;
  const applyBurn = !!options.attackerBurned && isPhysical && !hasGuts;

  //////////////////////////////////////////////////////////////////////////
  // Stage 1: base power — bp-stage modifiers chained onto rawMovePower.
  //////////////////////////////////////////////////////////////////////////
  const bpModsBase: number[] = [
    options.attackerHelpingHand ? 0x1800 : FIXED_POINT,
    terrainAttackMod4096(options.terrain, move.type, attackerGrounded),
    terrainDefenseMod4096(options.terrain, move.type, moveKey, defenderGrounded),
    options.fairyAura && move.type === "Fairy" ? 0x1548 : FIXED_POINT,
    sideMod4096(
      attacker.item ? ITEM_DAMAGE_MODIFIERS[attacker.item]?.attacker : undefined,
      "bp",
      move,
      typeMultiplier,
    ),
    sideMod4096(
      defender.item ? ITEM_DAMAGE_MODIFIERS[defender.item]?.defender : undefined,
      "bp",
      move,
      typeMultiplier,
    ),
    sideMod4096(
      defenderAbility ? ABILITY_DAMAGE_MODIFIERS[defenderAbility]?.defender : undefined,
      "bp",
      move,
      typeMultiplier,
    ),
  ];
  // Technician only applies if the power BEFORE it (but after every other bp
  // mod) is still ≤60 — matches the reference's own "tempBP" pre-check
  // rather than checking the move's raw listed power.
  const attackerAbilityBpModExceptTechnician = sideMod4096(
    attackerAbility && attackerAbility !== "Technician"
      ? ABILITY_DAMAGE_MODIFIERS[attackerAbility]?.attacker
      : undefined,
    "bp",
    move,
    typeMultiplier,
  );
  const bpModsBeforeTechnician = [...bpModsBase, attackerAbilityBpModExceptTechnician];
  const tempBasePower = Math.max(1, pokeRound((rawMovePower * chainMods(bpModsBeforeTechnician)) / FIXED_POINT));
  const technicianMod =
    attackerAbility === "Technician" && tempBasePower <= 60 ? 0x1800 : FIXED_POINT;
  const bpModsChain = chainMods([...bpModsBeforeTechnician, technicianMod]);
  /** Applies the bp-stage chain to a given hit's raw power — a separate function (not a single precomputed value) since Triple Kick/Axel's power varies hit to hit. */
  function finalBasePowerForHit(power: number): number {
    return Math.max(1, pokeRound((power * bpModsChain) / FIXED_POINT));
  }

  //////////////////////////////////////////////////////////////////////////
  // Stage 2: attack stat — at-stage modifiers chained onto the
  // stage-adjusted raw attack stat.
  //////////////////////////////////////////////////////////////////////////
  const atMods: number[] = [
    sideMod4096(
      attacker.item ? ITEM_DAMAGE_MODIFIERS[attacker.item]?.attacker : undefined,
      "at",
      move,
      typeMultiplier,
    ),
    hasGuts && isStatused && isPhysical ? 0x1800 : FIXED_POINT,
    sideMod4096(
      attackerAbility ? ABILITY_DAMAGE_MODIFIERS[attackerAbility]?.attacker : undefined,
      "at",
      move,
      typeMultiplier,
    ),
    sideMod4096(
      defenderAbility ? ABILITY_DAMAGE_MODIFIERS[defenderAbility]?.defender : undefined,
      "at",
      move,
      typeMultiplier,
    ),
  ];
  const finalAttackStat = Math.max(1, pokeRound((stageAdjustedAttackStat * chainMods(atMods)) / FIXED_POINT));

  //////////////////////////////////////////////////////////////////////////
  // Stage 3: defense stat — Sand/Snow's boost applies directly (its own
  // pokeRound step, "unlike all other defense modifiers" per the
  // reference), THEN df-stage modifiers chain on top of that.
  //////////////////////////////////////////////////////////////////////////
  let sandSnowAdjustedDefenseStat = stageAdjustedDefenseStat;
  if (options.weather === "Sand" && !isPhysical && defenderTypes.includes("Rock")) {
    sandSnowAdjustedDefenseStat = pokeRound((sandSnowAdjustedDefenseStat * 3) / 2);
  }
  if (options.weather === "Snow" && isPhysical && defenderTypes.includes("Ice")) {
    sandSnowAdjustedDefenseStat = pokeRound((sandSnowAdjustedDefenseStat * 3) / 2);
  }
  const dfMods: number[] = [
    sideMod4096(
      defender.item ? ITEM_DAMAGE_MODIFIERS[defender.item]?.defender : undefined,
      "df",
      move,
      typeMultiplier,
    ),
    sideMod4096(
      defenderAbility ? ABILITY_DAMAGE_MODIFIERS[defenderAbility]?.defender : undefined,
      "df",
      move,
      typeMultiplier,
    ),
  ];
  const finalDefenseStat = Math.max(
    1,
    pokeRound((sandSnowAdjustedDefenseStat * chainMods(dfMods)) / FIXED_POINT),
  );

  //////////////////////////////////////////////////////////////////////////
  // Stage 4: STAB — its own dedicated step (not chained with anything else,
  // per the reference), applied per-roll further down. Adaptability
  // replaces ×1.5 with ×2.0 outright rather than stacking with it.
  //////////////////////////////////////////////////////////////////////////
  const hasStab = attackerTypes.includes(move.type);
  const stabMod4096 = !hasStab ? FIXED_POINT : attackerAbility === "Adaptability" ? 0x2000 : 0x1800;

  //////////////////////////////////////////////////////////////////////////
  // Stage 5: the finalMods chain — everything applied once per roll,
  // together, AFTER STAB/type effectiveness/burn.
  //////////////////////////////////////////////////////////////////////////
  const finalMods: number[] = [
    screenMod4096(options.defenderScreens, move.category, !!options.isDoublesFormat),
    options.defenderFriendGuard ? 0xc00 : FIXED_POINT,
    sideMod4096(
      attacker.item ? ITEM_DAMAGE_MODIFIERS[attacker.item]?.attacker : undefined,
      "final",
      move,
      typeMultiplier,
    ),
    sideMod4096(
      defender.item ? ITEM_DAMAGE_MODIFIERS[defender.item]?.defender : undefined,
      "final",
      move,
      typeMultiplier,
    ),
    sideMod4096(
      attackerAbility ? ABILITY_DAMAGE_MODIFIERS[attackerAbility]?.attacker : undefined,
      "final",
      move,
      typeMultiplier,
    ),
    sideMod4096(
      defenderAbility ? ABILITY_DAMAGE_MODIFIERS[defenderAbility]?.defender : undefined,
      "final",
      move,
      typeMultiplier,
    ),
  ];
  const finalModsChain = chainMods(finalMods);

  function calcBaseDamage(rawPower: number): number {
    const power = finalBasePowerForHit(rawPower);
    return (
      Math.floor(Math.floor((LEVEL_TERM * power * finalAttackStat) / finalDefenseStat) / 50) + 2
    );
  }

  /**
   * baseDamage for one hit, with Spread/Weather/Crit applied — each its OWN
   * pokeRound (or, for Crit, plain floor) step directly on baseDamage,
   * BEFORE the 85-100% roll — per the reference's exact order, not chained
   * together and not applied after the roll like every other modifier.
   */
  function baseDamageForHit(power: number): number {
    let baseDamage = calcBaseDamage(power);
    if (move.isSpread && options.attackerHitsMultipleTargets) {
      baseDamage = pokeRound((baseDamage * 0xc00) / FIXED_POINT);
    }
    const weatherMod = weatherBaseDamageMod4096(options.weather, move.type);
    if (weatherMod !== FIXED_POINT) {
      baseDamage = pokeRound((baseDamage * weatherMod) / FIXED_POINT);
    }
    if (options.isCritical) {
      // Confirmed plain Math.floor here, not pokeRound — the reference's
      // own calcGeneralMods uses Math.floor specifically for this step.
      baseDamage = Math.floor(baseDamage * 1.5);
    }
    return baseDamage;
  }

  // minPercent/maxPercent are always relative to MAX hp (that's what "this
  // move deals 62% of this Pokémon's HP" means), but whether it actually KOs
  // depends on CURRENT hp — a defender already chipped down needs less.
  const defenderMaxHp = defenderStats.hp;
  const defenderCurrentHp =
    options.defenderCurrentHpPercent !== undefined
      ? Math.max(1, Math.round((options.defenderCurrentHpPercent / 100) * defenderMaxHp))
      : defenderMaxHp;

  const isIncreasingPowerMove = INCREASING_POWER_MULTI_HIT_MOVES.has(moveKey);
  const hasFocusSashOrSturdy = defender.item === "Focus Sash" || defenderAbility === "Sturdy";

  // Recoil: the move's own recoil (if any) is proportional to the damage
  // actually DEALT this roll (post Focus Sash/Sturdy clipping — a
  // simplification; the real games base recoil on the raw pre-clip damage,
  // but that distinction only matters in the rare case a Sash/Sturdy save
  // also happens to be a recoil move). Life Orb's is a flat 10% of the
  // attacker's own max HP, added once per roll (not per hit) since it's a
  // fixed post-move cost, not scaled by damage dealt.
  const hasLifeOrb = attacker.item === "Life Orb";
  const lifeOrbRecoil = hasLifeOrb ? Math.ceil(attackerStats.hp / 10) : 0;
  const hasRecoil = !!move.recoilFraction || hasLifeOrb;

  // Precomputed once for ordinary moves (power doesn't vary per hit) —
  // Triple Kick/Axel recompute it inside the loop below instead, since
  // their power (and therefore baseDamage) changes hit to hit.
  const flatBaseDamageForHit = isIncreasingPowerMove ? undefined : baseDamageForHit(rawMovePower);

  // Simulated hit-by-hit per roll scenario (all sub-hits of one scenario
  // share the same 85-100% roll, per the same "same roll repeated"
  // convention describeKoChance already uses) so a multi-hit move's total
  // damage, and a Focus Sash/Sturdy save partway through, both fall out of
  // the same loop rather than needing separate special-case math.
  const recoilRolls: number[] = [];
  const rolls = DAMAGE_ROLL_PERCENTS.map((percent) => {
    let hp = defenderCurrentHp;
    let sashOrSturdyConsumed = false;
    let totalDealt = 0;
    let totalMoveRecoil = 0;
    for (let hit = 0; hit < hitCount; hit++) {
      if (hp <= 0) break; // already fainted from an earlier hit this sequence — no further hits land
      const baseDamage =
        flatBaseDamageForHit ?? baseDamageForHit(rawMovePower * (hit + 1));

      // The random 85-100% roll applies FIRST, right after baseDamage —
      // before STAB/type effectiveness/burn/finalMods — per the reference's
      // own order (not last, as this engine did before this pass).
      let damage = Math.floor((baseDamage * percent) / 100);
      // STAB (its own pokeRound step).
      damage = pokeRound((damage * stabMod4096) / FIXED_POINT);
      // Type effectiveness (plain floor — the multiplier itself, e.g. 0.5/
      // 2/4, is an exact fraction with no fixed-point rounding concern).
      damage = Math.floor(damage * typeMultiplier);
      // Burn (plain floor).
      if (applyBurn) {
        damage = Math.floor(damage / 2);
      }
      // Every other end-stage modifier, chained together, one pokeRound.
      if (finalModsChain !== FIXED_POINT) {
        damage = pokeRound((damage * finalModsChain) / FIXED_POINT);
      }

      // Raw, uncapped — a normal lethal hit still reports its true (possibly
      // overkill) value, matching how a single hit's roll list already shows
      // e.g. 151-178 against 123 max HP. Only Focus Sash/Sturdy, triggered
      // from exactly full HP and only once, actually clips the damage dealt.
      let dealt = Math.max(1, damage);
      if (dealt >= hp) {
        if (hp === defenderMaxHp && hasFocusSashOrSturdy && !sashOrSturdyConsumed) {
          dealt = hp - 1;
          sashOrSturdyConsumed = true;
          hp = 1;
        } else {
          hp = 0;
        }
      } else {
        hp -= dealt;
      }
      totalDealt += dealt;
      if (move.recoilFraction) totalMoveRecoil += Math.floor(dealt * move.recoilFraction);
    }
    recoilRolls.push(totalMoveRecoil + lifeOrbRecoil);
    return totalDealt;
  });

  return {
    rolls,
    minPercent: roundPercent(rolls[0], defenderMaxHp),
    maxPercent: roundPercent(rolls[rolls.length - 1], defenderMaxHp),
    koChanceText: describeKoChance(rolls, defenderCurrentHp),
    hitCount,
    attackStatKey,
    defenseStatKey,
    isSpreadMove: !!move.isSpread,
    ...(hasRecoil
      ? {
          recoilMinPercent: roundPercent(recoilRolls[0], attackerStats.hp),
          recoilMaxPercent: roundPercent(recoilRolls[recoilRolls.length - 1], attackerStats.hp),
        }
      : {}),
  };
}
