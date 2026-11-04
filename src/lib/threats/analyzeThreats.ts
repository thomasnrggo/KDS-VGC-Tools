import movesData from "@/data/moves.json";
import { TERRAIN_SETTING_ABILITIES, WEATHER_SETTING_ABILITIES } from "@/constants";
import { calculateDamage, getMoveFlags, resolveTypes } from "@/lib/damage/calculateDamage";
import { computeBattleStat } from "@/lib/stats/battleStats";
import { calculateFinalStats } from "@/lib/stats/calculateFinalStats";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import type { DamageCalcOptions, ParsedPokemon } from "@/types";
import type { MoveData } from "@/types/damage";
import type { MetaThreatSet } from "./metaSets";

const MOVES = movesData as unknown as Record<string, MoveData>;

/** Who's faster: as built, with your Tailwind up, with theirs up, or under Trick Room. */
export type SpeedMode = "normal" | "tailwind" | "theirTailwind" | "trickRoom";

/** One side's best attack on the other. */
export interface Hit {
  move: string;
  minPercent: number;
  maxPercent: number;
  /** 0–1 (No Guard on either side makes it 1). */
  accuracy: number;
  priority: number;
}

/** How hard a threat hits one of yours: a sure OHKO, an OHKO on a high roll, a sure 2HKO. */
export type KoLevel = "ohko" | "rollOhko" | "twoHko";

/** How well one of yours handles a threat: KOs it (first, or after taking its hit), on a high roll, or 2HKOs it while barely scratched. */
export type AnswerLevel = "ko" | "rollKo" | "check";

/** A threat against one of your Pokémon. */
export interface Duel {
  theirs: Hit | null;
  yours: Hit | null;
  /** The threat's hit lands before yours (priority, then Speed). */
  theyMoveFirst: boolean;
  ko: KoLevel | null;
  answer: AnswerLevel | null;
}

export type DangerLevel = "high" | "medium" | "low";

export interface ThreatResult {
  set: MetaThreatSet;
  /** The field the duels were calced in — its own weather/terrain, else your team's. */
  weather?: DamageCalcOptions["weather"];
  terrain?: DamageCalcOptions["terrain"];
  speed: number;
  /** One per Pokémon on your team, in order. */
  duels: Duel[];
  /** How much it pressures your team, after your best answer — see analyzeThreats. */
  danger: number;
  level: DangerLevel;
  /** Danger weighted by how common the set is — the ranking. */
  score: number;
}

const ability = (mon: ParsedPokemon) => resolveEffectiveAbility(mon.species, mon.item, mon.ability);

/** The weather and terrain `threat` fights your team in: its own if it sets one, else your team's. */
export function fieldFor(threat: ParsedPokemon, team: ParsedPokemon[]): DamageCalcOptions {
  const weatherOf = (mon: ParsedPokemon) => WEATHER_SETTING_ABILITIES[ability(mon) ?? ""];
  const terrainOf = (mon: ParsedPokemon) => TERRAIN_SETTING_ABILITIES[ability(mon) ?? ""];
  return {
    weather: weatherOf(threat) ?? team.map(weatherOf).find(Boolean),
    terrain: terrainOf(threat) ?? team.map(terrainOf).find(Boolean),
  };
}

function speedOf(mon: ParsedPokemon, tailwind: boolean, field: DamageCalcOptions): number {
  const stats = calculateFinalStats(mon);
  if (!stats) return 0;
  return computeBattleStat("spe", {
    stats,
    stages: {},
    item: mon.item,
    ability: ability(mon),
    types: resolveTypes(mon.species, mon.item) ?? [],
    statused: false,
    paralyzed: false,
    weather: field.weather,
    terrain: field.terrain,
    tailwind,
  }).value;
}

/**
 * The attacker's best hit on the defender, by expected damage (max roll ×
 * accuracy): spread moves at the doubles ×0.75 (both foes are usually
 * there), -1 Attack against an Intimidate holder (it's in on the defender's
 * side), recharge moves (Hyper Beam) left out — nobody picks them for a KO.
 */
export function bestHit(
  attacker: ParsedPokemon,
  defender: ParsedPokemon,
  field: DamageCalcOptions,
): Hit | null {
  const intimidated = ability(defender) === "Intimidate";
  const noGuard = ability(attacker) === "No Guard" || ability(defender) === "No Guard";
  let best: Hit | null = null;
  for (const move of attacker.moves ?? []) {
    const key = normalizeSpeciesKey(move);
    const data = MOVES[key];
    if (!data || data.category === "Status") continue;
    if (/must recharge|cannot move next turn/i.test(data.shortDesc ?? "")) continue;
    const result = calculateDamage(attacker, defender, move, {
      ...field,
      isDoublesFormat: true,
      attackerHitsMultipleTargets: !!data.isSpread,
      attackerStages: intimidated ? { atk: -1 } : undefined,
    });
    if (!result) continue;
    const accuracy = noGuard ? 1 : (data.accuracy ?? 100) / 100;
    // Grassy Glide's +1 only holds in Grassy Terrain (Showdown's data has 0).
    const priority =
      getMoveFlags(key).priority ?? (key === "grassy-glide" && field.terrain === "Grassy" ? 1 : 0);
    if (!best || result.maxPercent * accuracy > best.maxPercent * best.accuracy) {
      best = {
        move: data.name ?? move,
        minPercent: result.minPercent,
        maxPercent: result.maxPercent,
        accuracy,
        priority,
      };
    }
  }
  return best;
}

/** Whether a hit lands before the other side's: priority first, then Speed (reversed under Trick Room; a tie isn't first). */
function movesFirst(
  hit: Hit | null,
  speed: number,
  other: Hit | null,
  otherSpeed: number,
  trickRoom: boolean,
): boolean {
  const priority = hit?.priority ?? 0;
  const otherPriority = other?.priority ?? 0;
  if (priority !== otherPriority) return priority > otherPriority;
  return trickRoom ? speed < otherSpeed : speed > otherSpeed;
}

function koLevel(hit: Hit | null): KoLevel | null {
  if (!hit) return null;
  if (hit.minPercent >= 100) return "ohko";
  if (hit.maxPercent >= 100) return "rollOhko";
  if (hit.minPercent >= 50) return "twoHko";
  return null;
}

/** How much a KO level weighs in danger — before accuracy and Speed. */
const KO_WEIGHT: Record<KoLevel, number> = { ohko: 1, rollOhko: 0.75, twoHko: 0.4 };

function answerLevel(duel: Omit<Duel, "answer">): AnswerLevel | null {
  const { theirs, yours, theyMoveFirst } = duel;
  if (!yours) return null;
  // You get to hit back: it's slower, or its hit doesn't KO.
  const getsToHit = !theyMoveFirst || !theirs || theirs.maxPercent < 100;
  if (yours.minPercent >= 100 && getsToHit) return "ko";
  if (yours.maxPercent >= 100 && getsToHit) return "rollKo";
  if (yours.minPercent >= 50 && getsToHit && (theirs?.maxPercent ?? 0) < 50) return "check";
  return null;
}

const ANSWER_WEIGHT: Record<AnswerLevel, number> = { ko: 1, rollKo: 0.7, check: 0.5 };

/** A threat against one of yours before the speed mode is applied: both hits and both Speeds. */
export interface Matchup {
  theirs: Hit | null;
  yours: Hit | null;
  /** The threat's Speed, without and with Tailwind. */
  theirSpeed: number;
  theirTailwindSpeed: number;
  yourSpeed: number;
  yourTailwindSpeed: number;
}

/** A set's matchups against the whole team — the expensive part, the same in every speed mode. */
export interface ThreatMatchups {
  set: MetaThreatSet;
  /** The field the matchups were calced in — its own weather/terrain, else your team's. */
  weather?: DamageCalcOptions["weather"];
  terrain?: DamageCalcOptions["terrain"];
  /** One per Pokémon on your team, in order. */
  matchups: Matchup[];
}

/**
 * Every set calced against each of your Pokémon, both ways (the damage
 * calculator, in the field it'd fight in), with every Speed a mode needs.
 * Your Pokémon without Stat Points need a spread first (see withSpread).
 */
export function threatMatchups(team: ParsedPokemon[], sets: MetaThreatSet[]): ThreatMatchups[] {
  return sets.flatMap((set) => {
    const threat = set.pokemon;
    if (!calculateFinalStats(threat)) return [];
    const field = fieldFor(threat, team);
    const theirSpeed = speedOf(threat, false, field);
    const theirTailwindSpeed = speedOf(threat, true, field);
    return [
      {
        set,
        weather: field.weather,
        terrain: field.terrain,
        matchups: team.map((mon): Matchup => ({
          theirs: bestHit(threat, mon, field),
          yours: bestHit(mon, threat, field),
          theirSpeed,
          theirTailwindSpeed,
          yourSpeed: speedOf(mon, false, field),
          yourTailwindSpeed: speedOf(mon, true, field),
        })),
      },
    ];
  });
}

/** Whether the threat's hit lands first in a speed mode. */
export function threatMovesFirst(matchup: Matchup, mode: SpeedMode): boolean {
  const theirSpeed = mode === "theirTailwind" ? matchup.theirTailwindSpeed : matchup.theirSpeed;
  const yourSpeed = mode === "tailwind" ? matchup.yourTailwindSpeed : matchup.yourSpeed;
  return movesFirst(matchup.theirs, theirSpeed, matchup.yours, yourSpeed, mode === "trickRoom");
}

/**
 * The sets most dangerous to your team in a speed mode, first:
 *
 * - pressure: for each of yours it OHKOs (1), may OHKO (0.75) or 2HKOs
 *   (0.4), times its move's accuracy, ×1.3 when it moves first;
 * - your best answer: one of yours that KOs it (1 × accuracy), may KO it
 *   (0.7 × accuracy) — either before it moves, or after surviving its hit —
 *   or 2HKOs it while taking under half (0.5);
 * - danger = pressure × (1 − 0.7 × answer); the ranking weighs it by the
 *   square root of the set's usage, so a common set ranks above a rare one
 *   without drowning out a rare set that sweeps.
 */
export function rankThreats(all: ThreatMatchups[], mode: SpeedMode = "normal"): ThreatResult[] {
  return all
    .map(({ set, weather, terrain, matchups }): ThreatResult => {
      let pressure = 0;
      let answer = 0;
      const duels = matchups.map((matchup): Duel => {
        const { theirs, yours } = matchup;
        const theyMoveFirst = threatMovesFirst(matchup, mode);
        const ko = koLevel(theirs);
        if (ko && theirs) pressure += KO_WEIGHT[ko] * theirs.accuracy * (theyMoveFirst ? 1.3 : 1);
        const level = answerLevel({ theirs, yours, theyMoveFirst, ko });
        if (level && yours) {
          answer = Math.max(
            answer,
            ANSWER_WEIGHT[level] * (level === "check" ? 1 : yours.accuracy),
          );
        }
        return { theirs, yours, theyMoveFirst, ko, answer: level };
      });
      const danger = pressure * (1 - 0.7 * answer);
      return {
        set,
        weather,
        terrain,
        speed:
          (mode === "theirTailwind" ? matchups[0]?.theirTailwindSpeed : matchups[0]?.theirSpeed) ??
          0,
        duels,
        danger,
        level: danger >= 1.5 ? "high" : danger >= 0.8 ? "medium" : "low",
        score: danger * Math.sqrt(set.usage),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** threatMatchups then rankThreats, for one mode. */
export function analyzeThreats(
  team: ParsedPokemon[],
  sets: MetaThreatSet[],
  mode: SpeedMode = "normal",
): ThreatResult[] {
  return rankThreats(threatMatchups(team, sets), mode);
}
