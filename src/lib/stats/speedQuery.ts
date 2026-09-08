/** Tolerance for a numeric Speed search — searching "150" surfaces 145-155. */
const SPEED_QUERY_TOLERANCE = 5;

/** Parses a search box value as a Speed number, e.g. "150" -> 150. Anything that isn't purely digits (blank, a name, "150 scarf") returns null so the caller falls back to name search. */
export function parseSpeedQuery(query: string): number | null {
  const trimmed = query.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** True when `value` is within ± SPEED_QUERY_TOLERANCE of a parsed Speed query. */
export function matchesSpeedQuery(value: number, target: number): boolean {
  return Math.abs(value - target) <= SPEED_QUERY_TOLERANCE;
}

export type SpeedQueryTier = "exact" | "higher" | "lower";

/** Classifies a Speed value matched by a numeric query relative to its target — "exact" (same value), "higher", or "lower" — so results can be color-coded by proximity direction. */
export function speedQueryTier(value: number, target: number): SpeedQueryTier {
  if (value === target) return "exact";
  return value > target ? "higher" : "lower";
}
