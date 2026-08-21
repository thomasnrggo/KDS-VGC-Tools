export type MoveCategory = "Physical" | "Special" | "Status";

export interface MoveData {
  power: number | null;
  type: string;
  category: MoveCategory;
  /** Real English display name (e.g. "Will-O-Wisp", "U-turn") — used by the move-search combobox instead of title-casing the slug key, which mangles those exact cases. */
  name?: string;
  /** Only present for multi-hit moves (Dual Wingbeat: 2/2, Bullet Seed: 2/5, ...) — absent entirely for ordinary single-hit moves. */
  minHits?: number;
  maxHits?: number;
  /** Only present (and true) for moves that target "all-other-pokemon" or "all-opponents" (Earthquake, Rock Slide, Water Spout, ...) — eligible for the doubles ×0.75 spread-move reduction when actually used against 2+ targets. Absent entirely for ordinary single-target moves. */
  isSpread?: boolean;
  /** Only present for moves with real recoil (Take Down: 0.25, Double-Edge/Flare Blitz/Volt Tackle/Brave Bird/Wood Hammer: 1/3, Head Smash: 0.5, ...) — the fraction of damage DEALT the attacker takes back. Absent for drain moves (Giga Drain heals instead) and flat-self-cost moves (Mind Blown, Struggle) — see generate-move-data.mjs's file header for the full scoping. */
  recoilFraction?: number;
}

export interface DamageResult {
  /** 16 TOTAL damage values (85%-100% rolls, ascending) across all of hitCount's hits, against the defender's raw HP stat. */
  rolls: number[];
  minPercent: number;
  maxPercent: number;
  /** e.g. "guaranteed 2HKO", "37.5% chance to 3HKO" — see calculateDamage.ts for how this is derived. */
  koChanceText: string;
  /** How many times this move hit — 1 for ordinary moves, see calculateDamage.ts's resolveHitCount for multi-hit moves. */
  hitCount: number;
  /** Which stat this move's damage was actually computed from, for display (e.g. "32 Atk Garchomp ... vs. 4 HP / 0 Def Ditto"). */
  attackStatKey: "atk" | "spa";
  defenseStatKey: "def" | "spd";
  /** Whether this move's own data marks it as a spread move (Earthquake, Rock Slide, ...) — independent of whether `attackerHitsMultipleTargets` was actually set, so the UI can label "spread move, single target" differently from "spread move, 2 targets" (the ×0.75 case). */
  isSpreadMove: boolean;
  /**
   * Self-damage the ATTACKER takes from using this move — from the move's
   * own recoil (Wave Crash, Flare Blitz, ...) plus Life Orb's flat 10% max
   * HP if the attacker holds it, whichever/both apply. Expressed as a
   * percent of the ATTACKER's own max HP (not the defender's, unlike every
   * other percent field here), mirroring minPercent/maxPercent's
   * relationship to the defender. Undefined when neither source applies —
   * the UI shows no "(recoil)" note in that case. When only Life Orb
   * applies (a flat cost, not proportional to the roll), min and max come
   * out equal.
   */
  recoilMinPercent?: number;
  recoilMaxPercent?: number;
}

/** Stat stage boosts/drops (-6 to +6), Attack through Speed — HP has no stage in the real games, so it's excluded. */
export interface StatStages {
  atk?: number;
  def?: number;
  spa?: number;
  spd?: number;
  spe?: number;
}

/**
 * Battle-state options for a single calculateDamage call — deliberately
 * separate from ParsedPokemon, since these describe the moment of the hit
 * (what's active on the field, what status the attacker has right now),
 * not the Pokémon's own identity/build.
 */
export interface DamageCalcOptions {
  isCritical?: boolean;
  /** Only burn affects damage dealt (halves Physical damage, unless the attacker has Guts) — other statuses don't factor into a single-hit calculation. */
  attackerBurned?: boolean;
  /** Attacker has ANY status condition (burn, poison, paralysis, sleep, freeze) — separate from attackerBurned since abilities like Guts trigger on any status, not just burn specifically. */
  attackerStatused?: boolean;
  weather?: "Sun" | "Rain" | "Sand" | "Snow";
  terrain?: "Electric" | "Grassy" | "Psychic" | "Misty";
  defenderScreens?: {
    reflect?: boolean;
    lightScreen?: boolean;
    auroraVeil?: boolean;
  };
  /** An ally used Helping Hand on the attacker this turn — modeled as a flat ×1.5, since this app doesn't track a doubles partner Pokémon separately. */
  attackerHelpingHand?: boolean;
  /** The defender's ally has Friend Guard — reduces damage the defender takes by 25%. */
  defenderFriendGuard?: boolean;
  /** The defender used Protect (or a variant) this turn — the hit is blocked entirely. Not modeling moves that bypass Protect (Feint, etc.). */
  defenderProtected?: boolean;
  /** Field-wide (not a side condition) — boosts Fairy-type move damage for both sides. */
  fairyAura?: boolean;
  /** Field-wide — grounds every Pokémon, so Ground-type moves hit Flying-types/Levitate holders that would normally be immune. */
  gravity?: boolean;
  /** Current stat stages for the attacking/defending Pokémon — only the relevant offensive/defensive stat for this move actually gets used. */
  attackerStages?: StatStages;
  defenderStages?: StatStages;
  /** Defender's current HP as a percent of its max (0-100) — KO-chance text is computed against this, but minPercent/maxPercent stay relative to max HP (matching how real calculators report it). Defaults to 100 (full HP) when omitted. */
  defenderCurrentHpPercent?: number;
  /** Attacker's current HP as a percent of its max (0-100) — only matters for the two HP-scaled-power moves (Water Spout, Eruption), whose base power is `floor(150 * currentHP / maxHP)`. Defaults to 100 (full HP, i.e. full 150 power) when omitted. */
  attackerCurrentHpPercent?: number;
  /** The attacker's move is being used against 2 targets this turn (both opposing Pokémon, or an ally too for an "all-other-pokemon"-targeted move) — only has an effect when the move itself is a spread move (`MoveData.isSpread`), in which case it applies the standard doubles ×0.75 reduction. A spread move used against a single remaining target (e.g. after its partner fainted) should leave this false/omitted. */
  attackerHitsMultipleTargets?: boolean;
  /** Field-wide — whether this calculation is happening in a Doubles/multi-battle format at all (independent of `attackerHitsMultipleTargets`, which is about this specific move's target count). Currently only affects screens: Reflect/Light Screen/Aurora Veil reduce damage by ×2732/4096 (≈0.667) in Doubles instead of the Singles value of ×0.5 — the real games' own value, confirmed against the NCP-VGC-Damage-Calculator reference. Defaults to the Singles (×0.5) behavior when omitted. */
  isDoublesFormat?: boolean;
}
