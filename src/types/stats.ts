export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type NatureAffectedStatKey = Exclude<StatKey, "hp">;

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface NatureModifier {
  increased?: NatureAffectedStatKey;
  decreased?: NatureAffectedStatKey;
}

export interface FinalStats extends BaseStats {
  /** The nature-boosted/lowered stat, if the nature isn't neutral — for display coloring. */
  increasedStat?: NatureAffectedStatKey;
  decreasedStat?: NatureAffectedStatKey;
}
