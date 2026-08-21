/**
 * Hand-curated, damage-calculator-relevant held-item effects — same
 * "small starting subset, grows as gaps are found" spirit as
 * abilityDamageModifiers.ts and megaStones.ts. Keys are item names exactly
 * as they appear in a pasted Showdown export's `@ Item` slot (matched
 * case-insensitively by the engine via normalizeSpeciesKey).
 *
 * `multiplier4096` and `stage` follow exactly the same convention as
 * abilityDamageModifiers.ts's own file header — every value here is the
 * exact hex constant from the NCP-VGC-Damage-Calculator reference's
 * `damage_MASTER.js`, not a re-derived decimal (this matters: Life Orb's
 * real value is 0x14CC/4096 = 1.2998..., NOT the "1.3" this app previously
 * stored, which would round to a different 4096ths integer — 0x14CD — once
 * chained precisely with other modifiers).
 *
 * Deliberately deferred: Eviolite (needs evolution-stage data this app
 * doesn't track), Rocky Helmet/Life Orb recoil (affects the *holder's* own
 * HP, not the target's damage taken, so out of scope for a damage-received
 * calculation), Berries that trigger on low HP (needs a damage-simulation
 * loop, not a single-hit calc).
 */

import type { AbilityDamageModifierSide } from "./abilityDamageModifiers";

export interface ItemDamageModifier {
  /** Applied when the ATTACKER holds this item. */
  attacker?: AbilityDamageModifierSide;
  /** Applied when the DEFENDER holds this item. */
  defender?: AbilityDamageModifierSide;
}

/** ×1.2 (0x1333/4096), base-power stage, type-scoped. */
const TYPE_BOOSTING_ITEMS: Record<string, string> = {
  Charcoal: "Fire",
  "Mystic Water": "Water",
  "Miracle Seed": "Grass",
  Magnet: "Electric",
  "Never-Melt Ice": "Ice",
  "Black Belt": "Fighting",
  "Poison Barb": "Poison",
  "Soft Sand": "Ground",
  "Sharp Beak": "Flying",
  "Silver Powder": "Bug",
  "Hard Stone": "Rock",
  "Spell Tag": "Ghost",
  "Dragon Fang": "Dragon",
  "Black Glasses": "Dark",
  "Metal Coat": "Steel",
  "Pixie Plate": "Fairy",
  "Fairy Feather": "Fairy",
  "Silk Scarf": "Normal",
};

/**
 * Type-resist Berries (Occa, Passho, etc.) — held by the DEFENDER, HALVE
 * damage from a super-effective hit of the matching type (a flat ×0.5,
 * `final` stage — confirmed against the reference's own `calcFinalMods`,
 * `finalMods.push(0x800)`). One per type except Normal, which has no
 * natural "super-effective" case for a berry to key off — Chilan Berry
 * fills that gap below as an unconditional halving instead, the one
 * genuinely different member of this family (same 0x800, just without the
 * onlySuperEffective condition).
 */
const TYPE_RESIST_BERRIES: Record<string, string> = {
  "Babiri Berry": "Steel",
  "Charti Berry": "Rock",
  "Chople Berry": "Fighting",
  "Coba Berry": "Flying",
  "Colbur Berry": "Dark",
  "Haban Berry": "Dragon",
  "Kasib Berry": "Ghost",
  "Kebia Berry": "Poison",
  "Occa Berry": "Fire",
  "Passho Berry": "Water",
  "Payapa Berry": "Psychic",
  "Rindo Berry": "Grass",
  "Roseli Berry": "Fairy",
  "Shuca Berry": "Ground",
  "Tanga Berry": "Bug",
  "Wacan Berry": "Electric",
  "Yache Berry": "Ice",
};

export const ITEM_DAMAGE_MODIFIERS: Record<string, ItemDamageModifier> = {
  // ×1.5, attack-stat stage.
  "Choice Band": { attacker: { multiplier4096: 0x1800, stage: "at", categories: ["Physical"] } },
  "Choice Specs": { attacker: { multiplier4096: 0x1800, stage: "at", categories: ["Special"] } },
  // ×1.2998... (0x14CC), final stage — every damage-affecting item other
  // than the type-boosters/Muscle Band/Wise Glasses lives in `final`, not
  // `bp`, per the reference's own `calcFinalMods`.
  "Life Orb": { attacker: { multiplier4096: 0x14cc, stage: "final" } },
  // ×1.2 (0x1333), final stage, only against a super-effective hit.
  "Expert Belt": { attacker: { multiplier4096: 0x1333, stage: "final", onlySuperEffective: true } },
  // ×1.1 (0x1199), base-power stage.
  "Muscle Band": { attacker: { multiplier4096: 0x1199, stage: "bp", categories: ["Physical"] } },
  "Wise Glasses": { attacker: { multiplier4096: 0x1199, stage: "bp", categories: ["Special"] } },
  // ×1.5, defense-stat stage — boosts the holder's Sp. Def directly (not a
  // final-damage reducer, unlike this app's earlier "1/1.5 on the final
  // number" approximation).
  "Assault Vest": { defender: { multiplier4096: 0x1800, stage: "df", categories: ["Special"] } },
  // ×0.5 (0x800), final stage, unconditional (no onlySuperEffective check)
  // — Normal-type moves are never super-effective against anything, so
  // Chilan just always halves damage from a Normal-type hit instead.
  "Chilan Berry": { defender: { multiplier4096: 0x800, stage: "final", types: ["Normal"] } },
  ...Object.fromEntries(
    Object.entries(TYPE_BOOSTING_ITEMS).map(([item, type]) => [
      item,
      { attacker: { multiplier4096: 0x1333, stage: "bp", types: [type] } },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(TYPE_RESIST_BERRIES).map(([item, type]) => [
      item,
      { defender: { multiplier4096: 0x800, stage: "final", types: [type], onlySuperEffective: true } },
    ]),
  ),
};
