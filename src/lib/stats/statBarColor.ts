/**
 * Showdown's base-stat bar color: red for the lowest stats, through yellow,
 * to green, then teal for the highest (hue = base × 180 / 255).
 */
export function statBarColor(base: number): string {
  const hue = Math.min(360, Math.floor((base * 180) / 255));
  return `hsl(${hue}, 85%, 45%)`;
}

/**
 * The scale a base-stat bar is drawn on: 20 is (almost) empty, 200 full.
 * Base stats run from 1 (Shedinja's HP) to 255 (Blissey's), but 98% sit
 * between 20 and 160 — a 0–255 bar would squeeze them all into the middle.
 */
export const BAR_MIN_BASE_STAT = 20;
export const BAR_MAX_BASE_STAT = 200;

/** A base stat's bar width, as a percentage — a sliver even at the bottom, full from 200 up. */
export function statBarWidth(base: number): number {
  const share = (base - BAR_MIN_BASE_STAT) / (BAR_MAX_BASE_STAT - BAR_MIN_BASE_STAT);
  return Math.max(3, Math.min(100, share * 100));
}
