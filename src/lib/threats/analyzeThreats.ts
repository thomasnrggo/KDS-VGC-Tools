import movesData from "@/data/moves.json";
import { TERRAIN_SETTING_ABILITIES, WEATHER_SETTING_ABILITIES } from "@/constants";
import { calculateDamage, getMoveFlags, resolveTypes } from "@/lib/damage/calculateDamage";
import { computeBattleStat } from "@/lib/stats/battleStats";
import { calculateFinalStats } from "@/lib/stats/calculateFinalStats";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import type { DamageCalcOptions, ParsedPokemon } from "@/types";
import type { MoveData, StatStages } from "@/types/damage";
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
  /** The weather changed this hit (a sun-boosted Fire move, a Solar Beam with no charge…). */
  weatherApplied?: boolean;
  /** The terrain changed it — its damage, or its priority (Grassy Glide). */
  terrainApplied?: boolean;
}

/**
 * Your best hit after a setup move (Swords Dance, Nasty Plot…), for a setup
 * answer: a partner covers the setup turn (Fake Out, Follow Me, Rage
 * Powder), then it hits at the boosted stage — Intimidate included.
 */
export interface SetupHit extends Hit {
  /** The setup move. */
  setup: string;
  /** The attacking stat's stage the hit lands at (+2 Swords Dance − 1 Intimidate = +1). */
  stage: number;
  /** Your Speed after it, without and with Tailwind (Dragon Dance raises it). */
  speed: number;
  tailwindSpeed: number;
  /** Your Pokémon that cover the setup turn. */
  support: string[];
}

/** Where the weather and terrain a threat fights in come from: itself, its partners, or your team — and who sets it. */
export interface FieldSource {
  from: "own" | "partner" | "yours";
  /** The species that sets it. */
  by: string;
}

/** What a threat's field changed in its duels: any hit, either side's Speed, or a move's priority. */
export interface FieldEffect {
  weather?: FieldSource;
  terrain?: FieldSource;
  /** Whether each one changed a number shown in the duels. */
  weatherMattered: boolean;
  terrainMattered: boolean;
}

/** How hard a threat hits one of yours: a sure OHKO, an OHKO on a high roll, a sure 2HKO. */
export type KoLevel = "ohko" | "rollOhko" | "twoHko";

/** How well one of yours handles a threat: KOs it (first, or after taking its hit), on a high roll, or 2HKOs it while barely scratched. */
export type AnswerLevel = "ko" | "rollKo" | "check" | "wall" | "setup";

/** A threat against one of your Pokémon. */
export interface Duel {
  theirs: Hit | null;
  yours: Hit | null;
  /** The threat's hit lands before yours (priority, then Speed). */
  theyMoveFirst: boolean;
  ko: KoLevel | null;
  answer: AnswerLevel | null;
  /** The boosted hit, when it answers only after setting up (answer "setup"). */
  setup?: SetupHit;
}

export type DangerLevel = "high" | "medium" | "low";

export interface ThreatResult {
  set: MetaThreatSet;
  /** The field the duels were calced in — its own weather/terrain, else your team's. */
  weather?: DamageCalcOptions["weather"];
  terrain?: DamageCalcOptions["terrain"];
  /** Who set that field, and whether it changed anything. */
  field: FieldEffect;
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

/**
 * The weather and terrain `threat` fights your team in: its own if it sets
 * one, else its partners' (`partners` — the rest of a meta team or core: a
 * Chlorophyll Venusaur beside Charizard Y is in sun), else your team's.
 */
export function fieldFor(
  threat: ParsedPokemon,
  team: ParsedPokemon[],
  partners: ParsedPokemon[] = [],
): DamageCalcOptions {
  const weatherOf = (mon: ParsedPokemon) => WEATHER_SETTING_ABILITIES[ability(mon) ?? ""];
  const terrainOf = (mon: ParsedPokemon) => TERRAIN_SETTING_ABILITIES[ability(mon) ?? ""];
  return {
    weather:
      weatherOf(threat) ??
      partners.map(weatherOf).find(Boolean) ??
      team.map(weatherOf).find(Boolean),
    terrain:
      terrainOf(threat) ??
      partners.map(terrainOf).find(Boolean) ??
      team.map(terrainOf).find(Boolean),
  };
}

/** Who sets `threat`'s weather and terrain, in fieldFor's order: itself, a partner, your team. */
export function fieldSources(
  threat: ParsedPokemon,
  team: ParsedPokemon[],
  partners: ParsedPokemon[] = [],
): { weather?: FieldSource; terrain?: FieldSource } {
  const find = (setsIt: (mon: ParsedPokemon) => unknown): FieldSource | undefined => {
    if (setsIt(threat)) return { from: "own", by: threat.species };
    const partner = partners.find(setsIt);
    if (partner) return { from: "partner", by: partner.species };
    const yours = team.find(setsIt);
    return yours ? { from: "yours", by: yours.species } : undefined;
  };
  return {
    weather: find((mon) => WEATHER_SETTING_ABILITIES[ability(mon) ?? ""]),
    terrain: find((mon) => TERRAIN_SETTING_ABILITIES[ability(mon) ?? ""]),
  };
}

function speedOf(
  mon: ParsedPokemon,
  tailwind: boolean,
  field: DamageCalcOptions,
  stage = 0,
): number {
  const stats = calculateFinalStats(mon);
  if (!stats) return 0;
  return computeBattleStat("spe", {
    stats,
    stages: stage ? { spe: stage } : {},
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
  const hit = bestHitAt(attacker, defender, field);
  if (!hit) return null;
  const plain: Partial<typeof hit> = { ...hit };
  delete plain.stage;
  return plain as Hit;
}

/** bestHit at boosted stages (a setup move's), with the attacking stat's stage it lands at. */
function bestHitAt(
  attacker: ParsedPokemon,
  defender: ParsedPokemon,
  field: DamageCalcOptions,
  boosts: StatStages = {},
): (Hit & { stage: number }) | null {
  const intimidated = ability(defender) === "Intimidate";
  const clamp = (stage: number) => Math.max(-6, Math.min(6, stage));
  const stages: StatStages = {
    atk: clamp((boosts.atk ?? 0) - (intimidated ? 1 : 0)),
    spa: clamp(boosts.spa ?? 0),
  };
  const noGuard = ability(attacker) === "No Guard" || ability(defender) === "No Guard";
  let best: (Hit & { stage: number }) | null = null;
  for (const move of attacker.moves ?? []) {
    const key = normalizeSpeciesKey(move);
    const data = MOVES[key];
    if (!data || data.category === "Status") continue;
    if (/must recharge|cannot move next turn/i.test(data.shortDesc ?? "")) continue;
    const result = calculateDamage(attacker, defender, move, {
      ...field,
      isDoublesFormat: true,
      attackerHitsMultipleTargets: !!data.isSpread,
      attackerStages: stages.atk || stages.spa ? stages : undefined,
    });
    if (!result) continue;
    const accuracy = noGuard ? 1 : (data.accuracy ?? 100) / 100;
    // Grassy Glide's +1 only holds in Grassy Terrain (Showdown's data has 0).
    const priority =
      getMoveFlags(key).priority ?? (key === "grassy-glide" && field.terrain === "Grassy" ? 1 : 0);
    if (!best || result.maxPercent * accuracy > best.maxPercent * best.accuracy) {
      const terrainPriority = key === "grassy-glide" && field.terrain === "Grassy";
      best = {
        move: data.name ?? move,
        minPercent: result.minPercent,
        maxPercent: result.maxPercent,
        accuracy,
        priority,
        stage: (data.category === "Physical" ? stages.atk : stages.spa) ?? 0,
        ...(result.weatherApplied ? { weatherApplied: true } : {}),
        ...(result.terrainApplied || terrainPriority ? { terrainApplied: true } : {}),
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

/** A wall takes at most this much from the threat's best hit… */
export const WALL_TAKES = 25;
/** …and 3HKOs it back. */
export const WALL_HITS_BACK = 100 / 3;

function answerLevel(duel: Omit<Duel, "answer">): AnswerLevel | null {
  const { theirs, yours, theyMoveFirst } = duel;
  if (!yours) return null;
  // You get to hit back: it's slower, or its hit doesn't KO.
  const getsToHit = !theyMoveFirst || !theirs || theirs.maxPercent < 100;
  if (yours.minPercent >= 100 && getsToHit) return "ko";
  if (yours.maxPercent >= 100 && getsToHit) return "rollKo";
  if (yours.minPercent >= 50 && getsToHit && (theirs?.maxPercent ?? 0) < 50) return "check";
  // Walls it: shrugs off its best hit and 3HKOs it back — Floette's Moonblast
  // against a Mega Dragonite whose Heat Wave does a fifth.
  if (yours.minPercent >= WALL_HITS_BACK && (theirs?.maxPercent ?? 0) <= WALL_TAKES) return "wall";
  return null;
}

const ANSWER_WEIGHT: Record<AnswerLevel, number> = {
  ko: 1,
  rollKo: 0.7,
  check: 0.5,
  wall: 0.5,
  // It costs a turn and can be played around (a switch, a Protect).
  setup: 0.5,
};

/**
 * Whether one of yours answers a threat after setting up: a partner covers
 * the setup turn, then its boosted hit surely KOs — moving first, or
 * surviving the threat's hit. Only when it has no answer without setting up.
 */
function setupAnswer(matchup: Matchup, mode: SpeedMode): SetupHit | null {
  const setup = matchup.yoursAfterSetup;
  if (!setup || setup.minPercent < 100) return null;
  const theirSpeed = mode === "theirTailwind" ? matchup.theirTailwindSpeed : matchup.theirSpeed;
  const yourSpeed = mode === "tailwind" ? setup.tailwindSpeed : setup.speed;
  const theyMoveFirst = movesFirst(
    matchup.theirs,
    theirSpeed,
    setup,
    yourSpeed,
    mode === "trickRoom",
  );
  const getsToHit = !theyMoveFirst || !matchup.theirs || matchup.theirs.maxPercent < 100;
  return getsToHit ? setup : null;
}

/** Stat-boosting moves, and their boosts — a setup answer's (see SetupHit). */
const SETUP_MOVES: Record<string, StatStages> = {
  "swords-dance": { atk: 2 },
  "nasty-plot": { spa: 2 },
  "tail-glow": { spa: 3 },
  "shell-smash": { atk: 2, spa: 2, spe: 2 },
  "calm-mind": { spa: 1 },
  "dragon-dance": { atk: 1, spe: 1 },
  "quiver-dance": { spa: 1, spe: 1 },
  "victory-dance": { atk: 1, spe: 1 },
  "tidy-up": { atk: 1, spe: 1 },
  "shift-gear": { atk: 1, spe: 2 },
  "bulk-up": { atk: 1 },
  coil: { atk: 1 },
  "hone-claws": { atk: 1 },
  howl: { atk: 1 },
  "work-up": { atk: 1, spa: 1 },
  growth: { atk: 1, spa: 1 },
};

/** A Pokémon's setup move (the one that boosts its attacks most), if it has one. */
export function setupMoveOf(mon: ParsedPokemon): string | undefined {
  const total = (boosts: StatStages) => (boosts.atk ?? 0) + (boosts.spa ?? 0);
  return (mon.moves ?? [])
    .filter((name) => SETUP_MOVES[normalizeSpeciesKey(name)])
    .sort(
      (a, b) =>
        total(SETUP_MOVES[normalizeSpeciesKey(b)]) - total(SETUP_MOVES[normalizeSpeciesKey(a)]),
    )[0];
}

/** Moves that cover a partner's setup turn. */
const SUPPORT_MOVES = new Set(["fake-out", "follow-me", "rage-powder"]);

/** A Pokémon's setup move — the one that boosts most — and who on its team covers it; null when either is missing. */
function setupOf(
  mon: ParsedPokemon,
  team: ParsedPokemon[],
): { move: string; boosts: StatStages; support: string[] } | null {
  const move = setupMoveOf(mon);
  if (!move) return null;
  const support = team
    .filter(
      (other) =>
        other !== mon &&
        (other.moves ?? []).some((name) => SUPPORT_MOVES.has(normalizeSpeciesKey(name))),
    )
    .map((other) => other.species);
  if (support.length === 0) return null;
  return { move, boosts: SETUP_MOVES[normalizeSpeciesKey(move)], support };
}

/** A threat against one of yours before the speed mode is applied: both hits and both Speeds. */
export interface Matchup {
  theirs: Hit | null;
  yours: Hit | null;
  /** The threat's Speed, without and with Tailwind. */
  theirSpeed: number;
  theirTailwindSpeed: number;
  yourSpeed: number;
  yourTailwindSpeed: number;
  /** Your best hit after setting up, when you have a setup move and a partner to cover it. */
  yoursAfterSetup?: SetupHit;
}

/** A set's matchups against the whole team — the expensive part, the same in every speed mode. */
export interface ThreatMatchups {
  set: MetaThreatSet;
  /** The field the matchups were calced in — its own weather/terrain, else your team's. */
  weather?: DamageCalcOptions["weather"];
  terrain?: DamageCalcOptions["terrain"];
  /** One per Pokémon on your team, in order. */
  matchups: Matchup[];
  /** Who set that field, and whether it changed anything. */
  field: FieldEffect;
}

/**
 * Every set calced against each of your Pokémon, both ways (the damage
 * calculator, in the field it'd fight in), with every Speed a mode needs.
 * Your Pokémon without Stat Points need a spread first (see withSpread).
 */
export function threatMatchups(
  team: ParsedPokemon[],
  sets: MetaThreatSet[],
  partners: ParsedPokemon[] = [],
): ThreatMatchups[] {
  return sets.flatMap((set) => {
    const threat = set.pokemon;
    if (!calculateFinalStats(threat)) return [];
    const field = fieldFor(
      threat,
      team,
      partners.filter((partner) => partner !== threat),
    );
    const theirSpeed = speedOf(threat, false, field);
    const theirTailwindSpeed = speedOf(threat, true, field);
    const matchups = team.map((mon): Matchup => {
      const setup = setupOf(mon, team);
      const boosted = setup && bestHitAt(mon, threat, field, setup.boosts);
      return {
        theirs: bestHit(threat, mon, field),
        yours: bestHit(mon, threat, field),
        theirSpeed,
        theirTailwindSpeed,
        yourSpeed: speedOf(mon, false, field),
        yourTailwindSpeed: speedOf(mon, true, field),
        ...(setup && boosted
          ? {
              yoursAfterSetup: {
                ...boosted,
                setup: setup.move,
                speed: speedOf(mon, false, field, setup.boosts.spe),
                tailwindSpeed: speedOf(mon, true, field, setup.boosts.spe),
                support: setup.support,
              },
            }
          : {}),
      };
    });
    // Whether the field changed a number: a hit, or anyone's Speed (Chlorophyll, Surge Surfer).
    const hits = matchups.flatMap((matchup) => [matchup.theirs, matchup.yours]);
    const changesSpeed = (only: DamageCalcOptions) =>
      [threat, ...team].some((mon) => speedOf(mon, false, only) !== speedOf(mon, false, {}));
    const sources = fieldSources(
      threat,
      team,
      partners.filter((partner) => partner !== threat),
    );
    return [
      {
        set,
        weather: field.weather,
        terrain: field.terrain,
        matchups,
        field: {
          ...sources,
          weatherMattered:
            !!field.weather &&
            (hits.some((hit) => hit?.weatherApplied) || changesSpeed({ weather: field.weather })),
          terrainMattered:
            !!field.terrain &&
            (hits.some((hit) => hit?.terrainApplied) || changesSpeed({ terrain: field.terrain })),
        },
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
 *   2HKOs it while taking under half (0.5), or walls it: takes a quarter at
 *   most and 3HKOs it back (0.5);
 * - danger = pressure × (1 − 0.7 × answer); the ranking weighs it by the
 *   square root of the set's usage, so a common set ranks above a rare one
 *   without drowning out a rare set that sweeps.
 */
export function rankThreats(all: ThreatMatchups[], mode: SpeedMode = "normal"): ThreatResult[] {
  return all
    .map(({ set, weather, terrain, matchups, field }): ThreatResult => {
      let pressure = 0;
      let answer = 0;
      const duels = matchups.map((matchup): Duel => {
        const { theirs, yours } = matchup;
        const theyMoveFirst = threatMovesFirst(matchup, mode);
        const ko = koLevel(theirs);
        if (ko && theirs) pressure += KO_WEIGHT[ko] * theirs.accuracy * (theyMoveFirst ? 1.3 : 1);
        const direct = answerLevel({ theirs, yours, theyMoveFirst, ko });
        const setup = direct ? null : setupAnswer(matchup, mode);
        const level: AnswerLevel | null = direct ?? (setup ? "setup" : null);
        if (direct && yours) {
          answer = Math.max(
            answer,
            ANSWER_WEIGHT[direct] * (direct === "check" || direct === "wall" ? 1 : yours.accuracy),
          );
        } else if (setup) {
          answer = Math.max(answer, ANSWER_WEIGHT.setup * setup.accuracy);
        }
        return { theirs, yours, theyMoveFirst, ko, answer: level, ...(setup ? { setup } : {}) };
      });
      const danger = pressure * (1 - 0.7 * answer);
      return {
        set,
        weather,
        terrain,
        field,
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
