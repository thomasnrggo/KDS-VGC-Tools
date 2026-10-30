import { NATURE_MODIFIERS } from "@/constants";
import type { BaseStats, StatKey } from "@/types";

type NatureStat = Exclude<StatKey, "hp">;

function natureWith(increased: NatureStat, decreased: NatureStat): string {
  return Object.keys(NATURE_MODIFIERS).find(
    (name) =>
      NATURE_MODIFIERS[name].increased === increased &&
      NATURE_MODIFIERS[name].decreased === decreased,
  )!;
}

/**
 * The nature after typing "+" or "-" next to a stat (Showdown's shortcut):
 * that stat becomes the raised (or lowered) one and the other side is kept.
 * Raising the lowered stat (or the reverse) swaps them. From a neutral
 * nature the other side is guessed from the base stats — the weaker attacking
 * stat is lowered, the stronger one raised. Null for HP, which no nature
 * touches.
 */
export function natureFromSign(
  currentNature: string,
  stat: StatKey,
  sign: "+" | "-",
  base: BaseStats,
): string | null {
  if (stat === "hp") return null;
  const current = NATURE_MODIFIERS[currentNature.toLowerCase()] ?? {};
  const weaker: NatureStat = base.atk <= base.spa ? "atk" : "spa";
  const stronger: NatureStat = weaker === "atk" ? "spa" : "atk";

  if (sign === "+") {
    let decreased = (current.decreased ?? weaker) as NatureStat;
    if (decreased === stat)
      decreased = (current.increased ?? (stat === weaker ? stronger : weaker)) as NatureStat;
    return natureWith(stat, decreased);
  }
  let increased = (current.increased ?? stronger) as NatureStat;
  if (increased === stat)
    increased = (current.decreased ?? (stat === stronger ? weaker : stronger)) as NatureStat;
  return natureWith(increased, stat);
}
