import movesData from "@/data/moves.json";
import { TERRAIN_SETTING_ABILITIES, WEATHER_SETTING_ABILITIES } from "@/constants";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import type { DamageCalcOptions, ParsedPokemon } from "@/types";
import type { MoveData } from "@/types/damage";

const MOVES = movesData as unknown as Record<string, MoveData>;

type Weather = NonNullable<DamageCalcOptions["weather"]>;
type Terrain = NonNullable<DamageCalcOptions["terrain"]>;

/** A doubles job a team usually wants covered. */
export type TeamRole =
  | "speedControl"
  | "trickRoom"
  | "fakeOut"
  | "redirection"
  | "intimidate"
  | "weather"
  | "terrain"
  | "spreadDamage";

/** Who on the team fills a role, and with what (a move or an ability). */
export interface RoleMember {
  index: number;
  /** The move's or ability's name. */
  via: string;
  kind: "move" | "ability";
}

const SPEED_CONTROL_MOVES = new Set([
  "tailwind",
  "icy-wind",
  "electroweb",
  "thunder-wave",
  "scary-face",
  "bulldoze",
  "rock-tomb",
  "glare",
  "nuzzle",
  "string-shot",
]);
const REDIRECTION_MOVES = new Set(["follow-me", "rage-powder", "spotlight", "ally-switch"]);
const REDIRECTION_ABILITIES = new Set(["Lightning Rod", "Storm Drain"]);
const PROTECT_MOVES = new Set([
  "protect",
  "detect",
  "spiky-shield",
  "kings-shield",
  "baneful-bunker",
  "silk-trap",
  "burning-bulwark",
  "obstruct",
]);
const WEATHER_MOVES: Record<string, Weather> = {
  "sunny-day": "Sun",
  "rain-dance": "Rain",
  sandstorm: "Sand",
  snowscape: "Snow",
};
const TERRAIN_MOVES: Record<string, Terrain> = {
  "electric-terrain": "Electric",
  "grassy-terrain": "Grassy",
  "psychic-terrain": "Psychic",
  "misty-terrain": "Misty",
};
const TERRAIN_SEEDS: Record<string, Terrain> = {
  "Electric Seed": "Electric",
  "Grassy Seed": "Grassy",
  "Psychic Seed": "Psychic",
  "Misty Seed": "Misty",
};
/** Abilities that only work in a weather. */
const WEATHER_ABILITIES: Record<string, Weather> = {
  "Swift Swim": "Rain",
  "Rain Dish": "Rain",
  Hydration: "Rain",
  Chlorophyll: "Sun",
  "Solar Power": "Sun",
  "Leaf Guard": "Sun",
  "Sand Rush": "Sand",
  "Sand Force": "Sand",
  "Slush Rush": "Snow",
};
/** Abilities that only work in a terrain. */
const TERRAIN_ABILITIES: Record<string, Terrain> = {
  "Surge Surfer": "Electric",
  "Quark Drive": "Electric",
  "Grass Pelt": "Grassy",
};
const CHOICE_ITEMS = new Set(["Choice Scarf", "Choice Band", "Choice Specs"]);

const moveKeys = (mon: ParsedPokemon) => (mon.moves ?? []).map(normalizeSpeciesKey);
const ability = (mon: ParsedPokemon) => resolveEffectiveAbility(mon.species, mon.item, mon.ability);
const moveName = (key: string) => MOVES[key]?.name ?? key;

/** Who covers each doubles role (empty when nobody does). */
export function teamRoles(team: ParsedPokemon[]): Record<TeamRole, RoleMember[]> {
  const roles: Record<TeamRole, RoleMember[]> = {
    speedControl: [],
    trickRoom: [],
    fakeOut: [],
    redirection: [],
    intimidate: [],
    weather: [],
    terrain: [],
    spreadDamage: [],
  };
  team.forEach((mon, index) => {
    const own = ability(mon) ?? "";
    for (const key of moveKeys(mon)) {
      const via = moveName(key);
      if (SPEED_CONTROL_MOVES.has(key)) roles.speedControl.push({ index, via, kind: "move" });
      if (key === "trick-room") roles.trickRoom.push({ index, via, kind: "move" });
      if (key === "fake-out") roles.fakeOut.push({ index, via, kind: "move" });
      if (REDIRECTION_MOVES.has(key)) roles.redirection.push({ index, via, kind: "move" });
      if (WEATHER_MOVES[key]) roles.weather.push({ index, via, kind: "move" });
      if (TERRAIN_MOVES[key]) roles.terrain.push({ index, via, kind: "move" });
      const data = MOVES[key];
      if (data?.isSpread && data.category !== "Status")
        roles.spreadDamage.push({ index, via, kind: "move" });
    }
    if (REDIRECTION_ABILITIES.has(own))
      roles.redirection.push({ index, via: own, kind: "ability" });
    if (own === "Intimidate") roles.intimidate.push({ index, via: own, kind: "ability" });
    if (WEATHER_SETTING_ABILITIES[own]) roles.weather.push({ index, via: own, kind: "ability" });
    if (TERRAIN_SETTING_ABILITIES[own]) roles.terrain.push({ index, via: own, kind: "ability" });
  });
  return roles;
}

/** How many of the team carry Protect (or a variant). */
export function protectCount(team: ParsedPokemon[]): number {
  return team.filter((mon) => moveKeys(mon).some((key) => PROTECT_MOVES.has(key))).length;
}

/** Something about a set that doesn't work the way it's built. */
export type SetIssue =
  /** A Terrain Seed (or a terrain ability) with no setter of that terrain on the team. */
  | { kind: "terrainNeverSet"; index: number; via: string; terrain: Terrain; clashes?: Terrain }
  /** A weather ability with no setter of that weather on the team. */
  | { kind: "weatherNeverSet"; index: number; via: string; weather: Weather }
  /** A Choice item with Protect — locked into one move, Protect is a wasted slot. */
  | { kind: "choiceProtect"; index: number; via: string; move: string }
  /** An Assault Vest with a status move it can't use. */
  | { kind: "vestStatus"; index: number; move: string };

/**
 * Sets that can't do what they're built for on this team: a Terrain Seed or
 * weather/terrain ability nobody on the team sets up for (an opposing setter
 * could still trigger it — the team just can't count on it; `clashes` names
 * the team's own other terrain, which replaces it), a Choice item with
 * Protect, an Assault Vest with status moves.
 */
export function setIssues(team: ParsedPokemon[]): SetIssue[] {
  const roles = teamRoles(team);
  const setterOf = (member: RoleMember) => {
    const key = normalizeSpeciesKey(member.via);
    return TERRAIN_SETTING_ABILITIES[member.via] ?? TERRAIN_MOVES[key];
  };
  const terrains = new Set(roles.terrain.map(setterOf).filter(Boolean));
  const weathers = new Set(
    roles.weather
      .map(
        (member) =>
          WEATHER_SETTING_ABILITIES[member.via] ?? WEATHER_MOVES[normalizeSpeciesKey(member.via)],
      )
      .filter(Boolean),
  );
  const issues: SetIssue[] = [];
  team.forEach((mon, index) => {
    const own = ability(mon) ?? "";
    const keys = moveKeys(mon);
    const terrainNeeds: [string, Terrain | undefined][] = [
      [mon.item ?? "", mon.item ? TERRAIN_SEEDS[mon.item] : undefined],
      [own, TERRAIN_ABILITIES[own]],
    ];
    for (const [via, terrain] of terrainNeeds) {
      if (!terrain || terrains.has(terrain)) continue;
      issues.push({ kind: "terrainNeverSet", index, via, terrain, clashes: [...terrains][0] });
    }
    const weather = WEATHER_ABILITIES[own];
    if (weather && !weathers.has(weather)) {
      issues.push({ kind: "weatherNeverSet", index, via: own, weather });
    }
    if (mon.item && CHOICE_ITEMS.has(mon.item)) {
      const protect = keys.find((key) => PROTECT_MOVES.has(key));
      if (protect)
        issues.push({ kind: "choiceProtect", index, via: mon.item, move: moveName(protect) });
    }
    if (mon.item === "Assault Vest") {
      const status = keys.find((key) => MOVES[key]?.category === "Status");
      if (status) issues.push({ kind: "vestStatus", index, move: moveName(status) });
    }
  });
  return issues;
}
