import type { ParsedPokemon } from "@/types";

/** Whether a set has any Stat Points: a paste without an "EVs:" line (or with all zeros) leaves every stat at 0. */
export function hasStatPoints(mon: ParsedPokemon): boolean {
  return [...(mon.evs ?? "").matchAll(/(\d+)/g)].some((match) => Number(match[1]) > 0);
}
