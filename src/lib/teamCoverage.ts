import typeChartData from "@/data/typeChart.json";
import movesData from "@/data/moves.json";
import moveFlagsData from "@/data/moveFlags.json";
import {
  ABILITY_DAMAGE_MODIFIERS,
  TYPE_CHANGING_ABILITIES,
  TYPE_IMMUNITY_ABILITIES,
  WEATHER_SETTING_ABILITIES,
  type AbilityDamageModifierSide,
} from "@/constants";
import { resolveTypes } from "@/lib/damage/calculateDamage";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import type { ParsedPokemon } from "@/types";
import type { MoveData } from "@/types/damage";

const TYPE_CHART = typeChartData as Record<string, Record<string, number>>;
const MOVES = movesData as unknown as Record<string, MoveData>;
// Only the sound flag matters here (Liquid Voice).
const MOVE_FLAGS = moveFlagsData as unknown as Record<string, { sound?: boolean }>;

/** The 18 types in the games' own order (the order the coverage tables list them in). */
export const COVERAGE_TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
] as const;

/**
 * Moves whose damage ignores type effectiveness (fixed damage, a share of HP,
 * or a one-hit KO) — they say nothing about a team's type coverage.
 */
const TYPELESS_DAMAGE_MOVES = new Set([
  "seismic-toss",
  "night-shade",
  "super-fang",
  "natures-madness",
  "ruination",
  "endeavor",
  "final-gambit",
  "counter",
  "mirror-coat",
  "metal-burst",
  "comeuppance",
  "bide",
  "psywave",
  "dragon-rage",
  "sonic-boom",
  "guardian-of-alola",
  "fissure",
  "guillotine",
  "horn-drill",
  "sheer-cold",
]);

const WEATHER_BALL_TYPES = { Sun: "Fire", Rain: "Water", Sand: "Rock", Snow: "Ice" } as const;

/** One cell of the Defense table: how much damage a type does to a member, and what changed it from the plain type chart. */
export interface DefenseCell {
  multiplier: number;
  /** The ability or item that changed the type chart's number ("Levitate"), if any. */
  reason?: string;
}

export interface DefenseRow {
  type: string;
  cells: DefenseCell[];
  /** Members taking more than 1×. */
  weak: number;
  /** Members taking less than 1× — immunities included. */
  resist: number;
  /** resist − weak. */
  net: number;
}

export interface OffenseRow {
  type: string;
  /** Each member's best multiplier against this type, or null for a member with no damaging moves. */
  best: (number | null)[];
  /** The move behind each member's best multiplier (the first, on a tie). */
  bestMoves: (string | null)[];
  /** Members with a super-effective move against this type. */
  superEffective: number;
}

export interface TeamCoverage {
  defense: DefenseRow[];
  offense: OffenseRow[];
  /** Whether any member has a damaging move (otherwise the offense side says nothing). */
  hasMoves: boolean;
}

/** A defender ability's damage modifier that depends only on the attack's type — Thick Fat, not Multiscale or Fluffy's contact half. */
function isTypeOnlyModifier(side: AbilityDamageModifierSide): side is AbilityDamageModifierSide & {
  types: string[];
} {
  return (
    !!side.types &&
    !side.categories &&
    !side.flag &&
    !side.weathers &&
    !side.terrain &&
    !side.onlySuperEffective &&
    !side.onlyCritical &&
    !side.defenderAtFullHp &&
    side.maxBasePower === undefined
  );
}

function typeChart(attackType: string, defendingType: string): number {
  return TYPE_CHART[attackType]?.[defendingType] ?? 1;
}

/**
 * How much damage an attack of `attackType` does to a Pokémon with these
 * types, ability and item: the type chart across both its types, then
 * ability immunities and type-scoped ability modifiers, Wonder Guard, and Air
 * Balloon. Battle state (Gravity, Roost, Tar Shot, …) is out of scope.
 */
export function defensiveMultiplier(
  attackType: string,
  types: string[],
  ability?: string,
  item?: string,
): DefenseCell {
  const chart = types.reduce((total, type) => total * typeChart(attackType, type), 1);
  if (chart === 0) return { multiplier: 0 };
  if (ability && TYPE_IMMUNITY_ABILITIES[ability] === attackType) {
    return { multiplier: 0, reason: ability };
  }
  if (item === "Air Balloon" && attackType === "Ground") {
    return { multiplier: 0, reason: item };
  }
  if (ability === "Wonder Guard" && chart <= 1) {
    return { multiplier: 0, reason: ability };
  }

  const modifier = ability ? ABILITY_DAMAGE_MODIFIERS[ability]?.defender : undefined;
  const sides = modifier ? (Array.isArray(modifier) ? modifier : [modifier]) : [];
  let multiplier = chart;
  let changed = false;
  for (const side of sides) {
    if (isTypeOnlyModifier(side) && side.types.includes(attackType)) {
      multiplier *= side.multiplier4096 / 0x1000;
      changed = true;
    }
  }
  return changed ? { multiplier, reason: ability } : { multiplier };
}

/**
 * The type(s) a damaging move attacks with in this Pokémon's hands, or none
 * for a Status or typeless-damage move. Weather Ball takes the weather of any
 * setter on the team (several setters, several types), else stays Normal.
 */
export function moveAttackTypes(
  moveName: string,
  ability: string | undefined,
  teamWeathers: (keyof typeof WEATHER_BALL_TYPES)[],
): string[] {
  const key = normalizeSpeciesKey(moveName);
  const move = MOVES[key];
  if (!move || move.category === "Status" || TYPELESS_DAMAGE_MOVES.has(key)) return [];
  if (key === "weather-ball" && teamWeathers.length > 0) {
    return [...new Set(teamWeathers.map((weather) => WEATHER_BALL_TYPES[weather]))];
  }
  if (move.type === "Normal" && ability && TYPE_CHANGING_ABILITIES[ability]) {
    return [TYPE_CHANGING_ABILITIES[ability]];
  }
  if (ability === "Liquid Voice" && MOVE_FLAGS[key]?.sound) return ["Water"];
  return [move.type];
}

/** How effective a move of `attackType` is against one defending type, with the moves and abilities that break the usual chart. */
function offensiveMultiplier(
  moveName: string,
  attackType: string,
  defendingType: string,
  ability: string | undefined,
): number {
  const key = normalizeSpeciesKey(moveName);
  if (key === "freeze-dry" && defendingType === "Water") return 2;
  if (key === "thousand-arrows" && defendingType === "Flying") return 1;
  if (
    defendingType === "Ghost" &&
    (attackType === "Normal" || attackType === "Fighting") &&
    (ability === "Scrappy" || ability === "Mind's Eye")
  ) {
    return 1;
  }
  let multiplier = typeChart(attackType, defendingType);
  if (key === "flying-press") multiplier *= typeChart("Flying", defendingType);
  return multiplier;
}

/** A team's defensive and offensive type coverage — see PLANNING.md's "Team coverage". */
export function analyzeTeamCoverage(pokemon: ParsedPokemon[]): TeamCoverage {
  const members = pokemon.map((mon) => ({
    mon,
    types: resolveTypes(mon.species, mon.item) ?? [],
    ability: resolveEffectiveAbility(mon.species, mon.item, mon.ability),
  }));
  const teamWeathers = [
    ...new Set(
      members.flatMap(({ ability }) =>
        ability && WEATHER_SETTING_ABILITIES[ability] ? [WEATHER_SETTING_ABILITIES[ability]] : [],
      ),
    ),
  ];
  const attacks = members.map(({ mon, ability }) =>
    (mon.moves ?? []).flatMap((move) =>
      moveAttackTypes(move, ability, teamWeathers).map((type) => ({ move, type })),
    ),
  );

  const defense = COVERAGE_TYPES.map((type): DefenseRow => {
    const cells = members.map(({ mon, types, ability }) =>
      defensiveMultiplier(type, types, ability, mon.item),
    );
    const weak = cells.filter((cell) => cell.multiplier > 1).length;
    const resist = cells.filter((cell) => cell.multiplier < 1).length;
    return { type, cells, weak, resist, net: resist - weak };
  });

  const offense = COVERAGE_TYPES.map((type): OffenseRow => {
    const picks = attacks.map((memberAttacks, index) => {
      let pick: { multiplier: number; move: string } | null = null;
      for (const attack of memberAttacks) {
        const multiplier = offensiveMultiplier(
          attack.move,
          attack.type,
          type,
          members[index].ability,
        );
        if (!pick || multiplier > pick.multiplier) pick = { multiplier, move: attack.move };
      }
      return pick;
    });
    const best = picks.map((pick) => pick?.multiplier ?? null);
    return {
      type,
      best,
      bestMoves: picks.map((pick) => pick?.move ?? null),
      superEffective: best.filter((value) => value !== null && value > 1).length,
    };
  });

  return { defense, offense, hasMoves: attacks.some((memberAttacks) => memberAttacks.length > 0) };
}

/** Types more of the team is weak to than resists, or 3+ members are weak to — worst first. */
export function weakSpots(coverage: TeamCoverage): DefenseRow[] {
  return coverage.defense
    .filter((row) => row.net < 0 || row.weak >= 3)
    .sort((a, b) => a.net - b.net || b.weak - a.weak);
}

/** Types nothing on the team hits super effectively. */
export function coverageGaps(coverage: TeamCoverage): OffenseRow[] {
  return coverage.hasMoves ? coverage.offense.filter((row) => row.superEffective === 0) : [];
}
