import movesData from "@/data/moves.json";
import {
  NATURE_MODIFIERS,
  TERRAIN_SETTING_ABILITIES,
  WEATHER_SETTING_ABILITIES,
} from "@/constants";
import { resolveBaseStats } from "@/lib/stats/calculateFinalStats";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import type { ParsedPokemon } from "@/types";
import type { MoveData } from "@/types/damage";
import { threatMovesFirst, type ThreatMatchups } from "./analyzeThreats";

const MOVES = movesData as unknown as Record<string, MoveData>;

/** A Pokémon's job on the team. */
export type PokemonRole =
  /** Hits the common metagame hard. */
  | "pressure"
  /** KOs common threats before they move (speed, Choice Scarf, priority). */
  | "revengeKiller"
  /** Boosts itself to sweep. */
  | "setup"
  /** Helps its partner: Fake Out, redirection, speed control, Intimidate, … */
  | "support";

/** One of a Pokémon's roles, with what earns it. */
export interface RoleReason {
  role: PokemonRole;
  /** pressure / revengeKiller: how many of the common sets. */
  count?: number;
  /** setup / support: the moves. */
  via?: string[];
  /** support: its support ability (Intimidate, Prankster, …). */
  ability?: string;
}

export interface PokemonStyle {
  index: number;
  roles: RoleReason[];
  /** Of the common sets: how many it OHKOs (on a high roll at least), and of those, before they move. */
  kos: number;
  revenge: number;
}

/** The team's overall game plan. */
export type TeamArchetype = "trickRoom" | "weather" | "setup" | "hyperOffense" | "balance";

/** What the archetype is built around, and what else the team leans on. */
export interface TeamStyle {
  archetype: TeamArchetype;
  /** The weather of a weather team. */
  weather?: string;
  /** Tailwind, a Trick Room mode, setup options, a terrain, … — beyond the archetype. */
  extras: TeamExtra[];
  pokemon: PokemonStyle[];
  /** How many common sets the shares are out of. */
  commonSets: number;
}

export type TeamExtra =
  | { kind: "tailwind"; index: number }
  | { kind: "trickRoomMode"; index: number }
  | { kind: "setupOptions"; indexes: number[] }
  | { kind: "terrain"; terrain: string; index: number };

const SETUP_MOVES = new Set([
  "swords-dance",
  "nasty-plot",
  "calm-mind",
  "dragon-dance",
  "quiver-dance",
  "bulk-up",
  "belly-drum",
  "coil",
  "shell-smash",
  "shift-gear",
  "victory-dance",
  "tidy-up",
  "agility",
  "geomancy",
  "tail-glow",
  "growth",
  "work-up",
  "curse",
  "iron-defense",
  "cosmic-power",
  "acid-armor",
]);
const SUPPORT_MOVES = new Set([
  "fake-out",
  "follow-me",
  "rage-powder",
  "ally-switch",
  "tailwind",
  "trick-room",
  "icy-wind",
  "electroweb",
  "thunder-wave",
  "helping-hand",
  "wide-guard",
  "quick-guard",
  "will-o-wisp",
  "spore",
  "sleep-powder",
  "yawn",
  "encore",
  "taunt",
  "parting-shot",
  "snarl",
  "reflect",
  "light-screen",
  "aurora-veil",
  "haze",
  "clear-smog",
  "coaching",
  "life-dew",
  "pollen-puff",
  "heal-pulse",
  "feint",
  "imprison",
  "scary-face",
  "nuzzle",
  "glare",
  "decorate",
  "instruct",
  "safeguard",
]);
const SUPPORT_ABILITIES = new Set([
  "Intimidate",
  "Friend Guard",
  "Lightning Rod",
  "Storm Drain",
  "Prankster",
  "Hospitality",
]);
/** Abilities and moves that make the most of a weather. */
const WEATHER_USERS: Record<string, string[]> = {
  Rain: [
    "Swift Swim",
    "Rain Dish",
    "Hydration",
    "weather-ball",
    "hurricane",
    "thunder",
    "electro-shot",
  ],
  Sun: [
    "Chlorophyll",
    "Solar Power",
    "Protosynthesis",
    "weather-ball",
    "solar-beam",
    "solar-blade",
  ],
  Sand: ["Sand Rush", "Sand Force", "weather-ball"],
  Snow: ["Slush Rush", "weather-ball", "blizzard", "aurora-veil"],
};
/** The attacks a weather boosts ×1.5 — a Pokémon using them is using the weather too. */
const WEATHER_TYPES: Record<string, string> = { Rain: "Water", Sun: "Fire" };
/** A weather team has at least this many Pokémon besides the setter using it. */
const WEATHER_USERS_NEEDED = 2;

/** How many of the most-used sets the shares are measured on. */
const COMMON_SETS = 20;
/** A Pokémon applies pressure when it OHKOs (on a high roll at least) this share of the common sets. */
const PRESSURE_SHARE = 0.3;
/** A revenge killer KOs this share of them before they move. */
const REVENGE_SHARE = 0.3;
/** A Trick Room team has at least this many slow Pokémon: base Speed at most… */
const SLOW_BASE_SPEED = 65;

const moveKeys = (mon: ParsedPokemon) => (mon.moves ?? []).map(normalizeSpeciesKey);
const moveName = (key: string) => MOVES[key]?.name ?? key;
const ability = (mon: ParsedPokemon) =>
  resolveEffectiveAbility(mon.species, mon.item, mon.ability) ?? "";

/**
 * What each Pokémon does and what the team is, from its sets and how they
 * fare against the common metagame (`matchups` — see threatMatchups):
 *
 * - pressure: OHKOs (on a high roll at least) 30% or more of the 20
 *   most-used sets — its own best hit, accuracy aside;
 * - revenge killer: KOs 30% or more of them before they move (speed,
 *   Choice Scarf, priority);
 * - setup: a boosting move; support: Fake Out, two support moves
 *   (redirection, speed control, Helping Hand, Will-O-Wisp, …), or one with a
 *   support ability (Intimidate, Prankster, Lightning Rod, …).
 *
 * A Pokémon with none of them has no clear job against the common metagame —
 * worth knowing too.
 *
 * The archetype, first that fits: Trick Room (a setter and 3+ slow
 * Pokémon — base Speed ≤65 or a −Speed nature), weather (a setter and two
 * Pokémon using it — its abilities, moves, or the attacks it boosts: Water in
 * rain, Fire in sun), setup (3+ setup users), hyper offense (4+ applying
 * pressure, at most one support), else balance. Extras name what else it
 * has: Tailwind, a Trick Room mode, setup options, a terrain.
 */
export function teamStyle(team: ParsedPokemon[], matchups: ThreatMatchups[]): TeamStyle {
  const common = [...matchups].sort((a, b) => b.set.usage - a.set.usage).slice(0, COMMON_SETS);

  const pokemon = team.map((mon, index): PokemonStyle => {
    const keys = moveKeys(mon);
    const roles: RoleReason[] = [];
    let kos = 0;
    let revenge = 0;
    for (const { matchups: duels } of common) {
      const duel = duels[index];
      if (!duel?.yours || duel.yours.maxPercent < 100) continue;
      kos += 1;
      if (!threatMovesFirst(duel, "normal")) revenge += 1;
    }
    // Listed in the order the tab reads them: support, pressure, revenge killer, setup.
    const support = keys.filter((key) => SUPPORT_MOVES.has(key)).map(moveName);
    const own = ability(mon);
    // Fake Out alone is a lead support's job in doubles.
    if (
      support.length >= 2 ||
      keys.includes("fake-out") ||
      (support.length === 1 && SUPPORT_ABILITIES.has(own))
    ) {
      roles.push({
        role: "support",
        via: support,
        ...(SUPPORT_ABILITIES.has(own) && { ability: own }),
      });
    }
    if (common.length && kos / common.length >= PRESSURE_SHARE) {
      roles.push({ role: "pressure", count: kos });
    }
    if (common.length && revenge / common.length >= REVENGE_SHARE) {
      roles.push({ role: "revengeKiller", count: revenge });
    }
    const setup = keys.filter((key) => SETUP_MOVES.has(key));
    if (setup.length) roles.push({ role: "setup", via: setup.map(moveName) });
    return { index, roles, kos, revenge };
  });

  const has = (index: number, role: PokemonRole) =>
    pokemon[index].roles.some((reason) => reason.role === role);
  const withMove = (key: string) => team.findIndex((mon) => moveKeys(mon).includes(key));
  const isSlow = (mon: ParsedPokemon) => {
    const base = resolveBaseStats(mon.species, mon.item);
    const nature = NATURE_MODIFIERS[mon.nature?.toLowerCase() ?? ""];
    return (base?.spe ?? 100) <= SLOW_BASE_SPEED || nature?.decreased === "spe";
  };

  const trickRoomSetter = withMove("trick-room");
  const slow = team.filter(isSlow).length;
  const weatherSetter = team.findIndex((mon) => WEATHER_SETTING_ABILITIES[ability(mon)]);
  const weather =
    weatherSetter >= 0 ? WEATHER_SETTING_ABILITIES[ability(team[weatherSetter])] : undefined;
  const usesWeather = (mon: ParsedPokemon, weather: string) =>
    WEATHER_USERS[weather].includes(ability(mon)) ||
    moveKeys(mon).some(
      (key) =>
        WEATHER_USERS[weather].includes(key) ||
        (MOVES[key]?.category !== "Status" && MOVES[key]?.type === WEATHER_TYPES[weather]),
    );
  const weatherUsers = weather
    ? team.filter((mon, index) => index !== weatherSetter && usesWeather(mon, weather)).length
    : 0;
  const setupUsers = team.flatMap((_, index) => (has(index, "setup") ? [index] : []));
  const pressureCount = team.filter((_, index) => has(index, "pressure")).length;
  const supportCount = team.filter((_, index) => has(index, "support")).length;

  const archetype: TeamArchetype =
    trickRoomSetter >= 0 && slow >= 3
      ? "trickRoom"
      : weather && weatherUsers >= WEATHER_USERS_NEEDED
        ? "weather"
        : setupUsers.length >= 3
          ? "setup"
          : pressureCount >= 4 && supportCount <= 1
            ? "hyperOffense"
            : "balance";

  const extras: TeamExtra[] = [];
  const tailwind = withMove("tailwind");
  if (tailwind >= 0) extras.push({ kind: "tailwind", index: tailwind });
  if (trickRoomSetter >= 0 && archetype !== "trickRoom") {
    extras.push({ kind: "trickRoomMode", index: trickRoomSetter });
  }
  if (setupUsers.length > 0 && archetype !== "setup") {
    extras.push({ kind: "setupOptions", indexes: setupUsers });
  }
  const terrainSetter = team.findIndex((mon) => TERRAIN_SETTING_ABILITIES[ability(mon)]);
  if (terrainSetter >= 0) {
    extras.push({
      kind: "terrain",
      terrain: TERRAIN_SETTING_ABILITIES[ability(team[terrainSetter])],
      index: terrainSetter,
    });
  }

  return {
    archetype,
    weather: archetype === "weather" ? weather : undefined,
    extras,
    pokemon,
    commonSets: common.length,
  };
}
