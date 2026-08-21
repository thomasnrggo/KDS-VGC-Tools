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
 * Deliberately deferred (not yet knowable from this app's data model):
 * - Contact-dependent abilities (Fluffy, Punk Rock's sound-move half) —
 *   moves.json doesn't carry per-move flags like `makesContact` yet.
 * - Evolution-stage-dependent items (Eviolite) — species.json doesn't
 *   track evolution stage.
 * - Pulse/bite/sound-move-scoped abilities (Mega Launcher, Strong Jaw, Punk
 *   Rock) — same missing per-move-flag gap as above.
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
}

export interface AbilityDamageModifier {
  /** Applied when the ATTACKER has this ability. */
  attacker?: AbilityDamageModifierSide;
  /** Applied when the DEFENDER has this ability. */
  defender?: AbilityDamageModifierSide;
}

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
};
