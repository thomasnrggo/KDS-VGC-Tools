import movesData from "@/data/moves.json";
import { NATURE_MODIFIERS } from "@/constants";
import { hasStatPoints } from "@/lib/hasStatPoints";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import type { ParsedPokemon, StatKey } from "@/types";
import type { MoveData } from "@/types/damage";

const MOVES = movesData as unknown as Record<string, MoveData>;

/** The paste's EVs-line labels. */
const LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

/** Items a bulky set holds (which spends its points on HP over Speed). */
const BULKY_ITEMS = new Set(["Sitrus Berry", "Assault Vest", "Leftovers", "Rocky Helmet"]);

/** 32 / 32 / 2 — the 66 Stat Points of a typical two-stat spread. */
function spread(first: StatKey, second: StatKey, rest: StatKey): string {
  return `32 ${LABELS[first]} / 32 ${LABELS[second]} / 2 ${LABELS[rest]}`;
}

/**
 * A plausible spread for a set without one — open team sheets list moves,
 * item, ability and nature, never Stat Points. Read from the nature and
 * item like a player would: a defensive nature maxes HP and that defense; a
 * Speed-lowering one (Trick Room) HP and the attacking stat; +Speed or
 * Choice Scarf the attacking stat and Speed; a bulky item HP and the
 * attacking stat; anything else the attacking stat and Speed. The attacking
 * stat is the one most of its attacks use (no attacks: both defenses).
 */
export function estimateSpread(mon: ParsedPokemon): string {
  const attacks = (mon.moves ?? [])
    .map((move) => MOVES[normalizeSpeciesKey(move)])
    .filter((move) => move && move.category !== "Status");
  const physical = attacks.filter((move) => move.category === "Physical").length;
  const offense: StatKey | null =
    attacks.length === 0 ? null : physical >= attacks.length - physical ? "atk" : "spa";
  const nature = NATURE_MODIFIERS[mon.nature?.toLowerCase() ?? ""] ?? {};
  if (nature.increased === "def") return spread("hp", "def", "spd");
  if (nature.increased === "spd") return spread("hp", "spd", "def");
  if (!offense) return spread("hp", "def", "spd");
  if (nature.decreased === "spe") return spread("hp", offense, "def");
  if (nature.increased === "spe" || mon.item === "Choice Scarf")
    return spread(offense, "spe", "hp");
  if (mon.item && BULKY_ITEMS.has(mon.item)) return spread("hp", offense, "spe");
  return spread(offense, "spe", "hp");
}

/** The set as it is if it has Stat Points, else with an estimated spread (and says which). */
export function withSpread(mon: ParsedPokemon): { pokemon: ParsedPokemon; estimated: boolean } {
  if (hasStatPoints(mon)) return { pokemon: mon, estimated: false };
  return { pokemon: { ...mon, evs: estimateSpread(mon) }, estimated: true };
}
