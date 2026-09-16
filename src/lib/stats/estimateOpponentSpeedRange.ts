import { calculateFinalStats } from "./calculateFinalStats";
import { NATURE_MODIFIERS } from "@/constants/natures";
import type { ParsedPokemon } from "@/types";

const MAX_STAT_POINTS = 32;
const POSITIVE_SPEED_NATURE = "Jolly";
const NEGATIVE_SPEED_NATURE = "Brave";

/** Same pattern as computeSpeedTiers.ts's private speedFor — any Speed-lowering/-boosting nature is numerically identical for .spe, so "Brave"/"Jolly" stand in whenever the real nature is unknown. */
function speedFor(species: string, nature: string, statPoints: number, item?: string): number {
  const evs = statPoints > 0 ? `${statPoints} Spe` : undefined;
  return calculateFinalStats({ species, nature, evs, item })?.spe ?? 0;
}

export interface SpeedRange {
  min: number;
  max: number;
}

/**
 * Best-effort Speed for an opponent Pokémon parsed off a real tournament
 * team sheet, where Stat Points are essentially never revealed. A known
 * Speed-affecting nature is treated as a strong signal of full Speed
 * investment in that direction — a real Jolly/Timid/Hasty/Naive opponent is
 * overwhelmingly likely running max Speed (why else run the nature?), and a
 * Brave/Relaxed/Quiet/Sassy one is just as likely running 0 (Trick Room, or
 * simply not caring about a stat that nature already worked against) — so
 * those collapse to a single assumed value (min === max) rather than a
 * range, and the UI shows one number instead of a min-max spread.
 *
 * Nature known but Speed-neutral: still a range — only Stat Points (0-32)
 * vary, no directional assumption to make.
 * Nature unknown: full swing between the worst (Speed-lowering, 0 SP) and
 * best (Speed-boosting, 32 SP) case, matching computeSpeedTiers'
 * minSpeed/maxSpeed for the same species.
 *
 * Item is always passed through when known — Choice Scarf/Iron Ball shift
 * the result identically regardless of which branch below runs, and every
 * other item is a no-op on Speed, so there's no case where including it
 * would be wrong.
 */
export function estimateOpponentSpeedRange(pokemon: ParsedPokemon): SpeedRange {
  const { species, item, nature } = pokemon;
  const natureModifier = nature ? NATURE_MODIFIERS[nature.toLowerCase()] : undefined;

  if (natureModifier?.increased === "spe") {
    const value = speedFor(species, nature!, MAX_STAT_POINTS, item);
    return { min: value, max: value };
  }
  if (natureModifier?.decreased === "spe") {
    const value = speedFor(species, nature!, 0, item);
    return { min: value, max: value };
  }

  return {
    min: speedFor(species, nature ?? NEGATIVE_SPEED_NATURE, 0, item),
    max: speedFor(species, nature ?? POSITIVE_SPEED_NATURE, MAX_STAT_POINTS, item),
  };
}
