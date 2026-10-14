/**
 * Hand-curated, damage-calculator-relevant ability effects — deliberately a
 * small starting subset (the ~15-20 most common in VGC), not exhaustive.
 * Grows the same way megaStones.ts does: add an entry here whenever a real
 * matchup turns up a gap. Keys are ability names exactly as they appear in a
 * pasted Showdown export's `Ability:` line (matched case-insensitively by
 * the engine via normalizeSpeciesKey, same as everywhere else in this app).
 *
 * `multiplier4096` is the modifier expressed in the real games' own
 * fixed-point unit — 4096ths (`0x1000`), e.g. 6144 for ×1.5 — rather than an
 * approximate decimal. This matters for precision: this app now chains
 * modifiers together (`chainMods`/`pokeRound` in calculateDamage.ts,
 * matching the real games' own algorithm) exactly the way
 * NCP-VGC-Damage-Calculator's reference implementation does, and a decimal
 * like 1.3 re-converted to 4096ths can land on a different integer than the
 * game's actual constant (1.3 → round(1.3*4096) = 5325 = 0x14CD, but Life
 * Orb's real value is 0x14CC = 5324 — a 1-unit-per-4096 error that used to
 * be invisible when this engine just multiplied plain floats together, but
 * would compound once chained precisely). Every value below is the exact
 * hex constant from that reference's own `damage_MASTER.js`, not a
 * re-derived decimal.
 *
 * `stage` says which point in the real damage formula this modifier
 * actually applies at — confirmed against the reference file-by-file, not
 * assumed:
 * - "bp": modifies the move's own base power, before the base-damage
 *   formula runs (Technician, Dry Skin).
 * - "at": modifies the ATTACK stat used in the formula — this is where
 *   Huge Power/Pure Power live, but ALSO where a couple of nominally
 *   "defensive" abilities live in the real games (Thick Fat, Heatproof —
 *   the reference's own `calcAtMods` scopes these by the DEFENDER's
 *   ability even though the bucket is "attack stat mods"; kept in that
 *   same bucket here for the same reason).
 * - "df": modifies the DEFENSE stat (Fur Coat).
 * - "final": applied to the already-fully-formed damage number, once per
 *   85-100% roll, alongside STAB/type effectiveness/burn (Filter/Solid
 *   Rock, Ice Scales).
 *
 * Two kinds of effect modeled:
 * - Type immunity (a defending ability that reduces incoming damage from one
 *   type to zero, e.g. Levitate vs Ground) — see TYPE_IMMUNITY_ABILITIES.
 * - A chained fixed-point multiplier, scoped by move type/category/power on
 *   whichever side (attacker or defender) the ability sits on, applied at
 *   the `stage` above.
 *
 * Move-flag abilities (Tough Claws, Iron Fist, Strong Jaw, Mega Launcher,
 * Sharpness, Sheer Force, Reckless, Punk Rock, Fluffy) read
 * src/data/moveFlags.json (`npm run generate:calc-data`, from Showdown's data).
 *
 * Deliberately deferred:
 * - Evolution-stage-dependent items (Eviolite) — species.json doesn't
 *   track evolution stage.
 * - Abilities that depend on battle history (Analytic, Supreme Overlord's
 *   fainted allies, Stakeout).
 */

export interface AbilityDamageModifierSide {
  /** The multiplier in 4096ths (Pokémon's own fixed-point unit) — see the file header. */
  multiplier4096: number;
  /** Which stage of the real damage formula this applies at — see the file header. */
  stage: "bp" | "at" | "df" | "final";
  /** Restricts to these move types; omit for "any type". */
  types?: string[];
  /** Restricts to these move categories; omit for both. */
  categories?: Array<"Physical" | "Special">;
  /** Applies only when the move is super-effective (type multiplier > 1) against the defender — e.g. Filter/Solid Rock (defender side) or Expert Belt (attacker side). */
  onlySuperEffective?: boolean;
  /** Attacker-side only: applies only when the move's listed base power is at or under this (e.g. Technician). */
  maxBasePower?: number;
  /** Applies only to moves with this flag (src/data/moveFlags.json, from Showdown's data): contact (Tough Claws, Fluffy), punch (Iron Fist), bite (Strong Jaw), pulse (Mega Launcher), slicing (Sharpness), sound (Punk Rock), secondary effects (Sheer Force), recoil (Reckless). */
  flag?: MoveFlag;
  /** Applies only in these weathers (Sand Force, Solar Power). */
  weathers?: Array<"Sun" | "Rain" | "Sand" | "Snow">;
  /** Applies only in this terrain (Grass Pelt). */
  terrain?: "Electric" | "Grassy" | "Psychic" | "Misty";
  /** Applies only to a critical hit (Sniper). */
  onlyCritical?: boolean;
  /** Defender-side: applies only while the defender is at full HP (Multiscale, Shadow Shield). */
  defenderAtFullHp?: boolean;
}

export type MoveFlag =
  | "contact"
  | "punch"
  | "bite"
  | "pulse"
  | "slicing"
  | "sound"
  | "secondary"
  | "recoil";

export interface AbilityDamageModifier {
  /** Applied when the ATTACKER has this ability — a list when it has several separate effects. */
  attacker?: AbilityDamageModifierSide | AbilityDamageModifierSide[];
  /** Applied when the DEFENDER has this ability (Fluffy: half from contact, double from Fire). */
  defender?: AbilityDamageModifierSide | AbilityDamageModifierSide[];
}

/**
 * Abilities that turn Normal-type moves into another type and boost them
 * ×1.2 (0x1333) — handled in the engine before type effectiveness and STAB,
 * since the type change affects both. Liquid Voice turns sound moves into
 * Water without a boost (see the engine).
 */
export const TYPE_CHANGING_ABILITIES: Record<string, string> = {
  Pixilate: "Fairy",
  Aerilate: "Flying",
  Refrigerate: "Ice",
  Galvanize: "Electric",
  Dragonize: "Dragon",
};

/** Ability name -> the single type it grants full immunity to (as the defender). */
export const TYPE_IMMUNITY_ABILITIES: Record<string, string> = {
  Levitate: "Ground",
  "Water Absorb": "Water",
  "Volt Absorb": "Electric",
  "Storm Drain": "Water",
  "Sap Sipper": "Grass",
  "Flash Fire": "Fire",
  "Lightning Rod": "Electric",
  "Motor Drive": "Electric",
  "Well-Baked Body": "Fire",
  "Earth Eater": "Ground",
  // Pokémon Champions (Mega Eelektross) — Ground immunity, per Showdown's data.
  Eelevate: "Ground",
};

export const ABILITY_DAMAGE_MODIFIERS: Record<string, AbilityDamageModifier> = {
  // ×1.5, base-power stage, base power ≤60 only.
  Technician: { attacker: { multiplier4096: 0x1800, stage: "bp", maxBasePower: 60 } },
  // ×2.0, attack-stat stage, Physical only.
  "Huge Power": { attacker: { multiplier4096: 0x2000, stage: "at", categories: ["Physical"] } },
  "Pure Power": { attacker: { multiplier4096: 0x2000, stage: "at", categories: ["Physical"] } },
  // ×0.75, final stage, only against a super-effective hit.
  Filter: { defender: { multiplier4096: 0xc00, stage: "final", onlySuperEffective: true } },
  "Solid Rock": { defender: { multiplier4096: 0xc00, stage: "final", onlySuperEffective: true } },
  // ×0.5, attack-stat stage (yes — the reference scopes these as attack-stat
  // reducers, not final-damage ones, even though they're defender-side).
  "Thick Fat": { defender: { multiplier4096: 0x800, stage: "at", types: ["Fire", "Ice"] } },
  Heatproof: { defender: { multiplier4096: 0x800, stage: "at", types: ["Fire"] } },
  // ×0.5, final stage, Special only.
  "Ice Scales": { defender: { multiplier4096: 0x800, stage: "final", categories: ["Special"] } },
  // ×2.0, defense-stat stage, Physical only.
  "Fur Coat": { defender: { multiplier4096: 0x2000, stage: "df", categories: ["Physical"] } },
  // ×1.25, base-power stage, Fire-type moves only.
  "Dry Skin": { defender: { multiplier4096: 0x1400, stage: "bp", types: ["Fire"] } },

  // Move-flag boosts, base-power stage (values from the same reference).
  "Tough Claws": { attacker: { multiplier4096: 0x14cd, stage: "bp", flag: "contact" } },
  "Iron Fist": { attacker: { multiplier4096: 0x1333, stage: "bp", flag: "punch" } },
  "Strong Jaw": { attacker: { multiplier4096: 0x1800, stage: "bp", flag: "bite" } },
  "Mega Launcher": { attacker: { multiplier4096: 0x1800, stage: "bp", flag: "pulse" } },
  Sharpness: { attacker: { multiplier4096: 0x1800, stage: "bp", flag: "slicing" } },
  "Sheer Force": { attacker: { multiplier4096: 0x14cd, stage: "bp", flag: "secondary" } },
  Reckless: { attacker: { multiplier4096: 0x1333, stage: "bp", flag: "recoil" } },
  // Punk Rock: its own sound moves ×1.3; sound moves against it halved.
  "Punk Rock": {
    attacker: { multiplier4096: 0x14cd, stage: "bp", flag: "sound" },
    defender: { multiplier4096: 0x800, stage: "final", flag: "sound" },
  },
  "Sand Force": {
    attacker: {
      multiplier4096: 0x14cd,
      stage: "bp",
      types: ["Rock", "Ground", "Steel"],
      weathers: ["Sand"],
    },
  },
  "Steely Spirit": { attacker: { multiplier4096: 0x1800, stage: "bp", types: ["Steel"] } },

  // Attack-stat boosts.
  Hustle: { attacker: { multiplier4096: 0x1800, stage: "at", categories: ["Physical"] } },
  "Gorilla Tactics": { attacker: { multiplier4096: 0x1800, stage: "at", categories: ["Physical"] } },
  "Solar Power": {
    attacker: { multiplier4096: 0x1800, stage: "at", categories: ["Special"], weathers: ["Sun"] },
  },
  Steelworker: { attacker: { multiplier4096: 0x1800, stage: "at", types: ["Steel"] } },
  "Dragon's Maw": { attacker: { multiplier4096: 0x1800, stage: "at", types: ["Dragon"] } },
  Transistor: { attacker: { multiplier4096: 0x14cd, stage: "at", types: ["Electric"] } },
  "Rocky Payload": { attacker: { multiplier4096: 0x1800, stage: "at", types: ["Rock"] } },
  // Pokémon Champions: "offensive stat ×1.5 while using a Fire-type attack" (Showdown's data).
  "Fire Mane": { attacker: { multiplier4096: 0x1800, stage: "at", types: ["Fire"] } },
  // Water Bubble: its own Water moves ×2; Fire moves against it halved.
  "Water Bubble": {
    attacker: { multiplier4096: 0x2000, stage: "at", types: ["Water"] },
    defender: { multiplier4096: 0x800, stage: "at", types: ["Fire"] },
  },
  "Purifying Salt": { defender: { multiplier4096: 0x800, stage: "at", types: ["Ghost"] } },

  // Defense-stat boosts.
  "Grass Pelt": {
    defender: { multiplier4096: 0x1800, stage: "df", categories: ["Physical"], terrain: "Grassy" },
  },

  // Final-damage modifiers.
  Sniper: { attacker: { multiplier4096: 0x1800, stage: "final", onlyCritical: true } },
  Multiscale: { defender: { multiplier4096: 0x800, stage: "final", defenderAtFullHp: true } },
  "Shadow Shield": { defender: { multiplier4096: 0x800, stage: "final", defenderAtFullHp: true } },
  "Prism Armor": { defender: { multiplier4096: 0xc00, stage: "final", onlySuperEffective: true } },
  // Pokémon Champions (Mega Lucario Z): halves contact-move damage, like
  // Fluffy's contact half (per Showdown's Champions damage calc).
  "Aura Guard": { defender: { multiplier4096: 0x800, stage: "final", flag: "contact" } },
  Fluffy: {
    defender: [
      { multiplier4096: 0x800, stage: "final", flag: "contact" },
      { multiplier4096: 0x2000, stage: "final", types: ["Fire"] },
    ],
  },
};
