import movesData from "@/data/moves.json";
import { getMoveFlags } from "@/lib/damage/calculateDamage";
import { stripMegaSuffix } from "@/lib/species/megaForm";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import type { MetaPokemon } from "@/lib/meta/aggregateMeta";
import type { ParsedPokemon } from "@/types";
import type { MoveData } from "@/types/damage";
import {
  bestHit,
  fieldFor,
  threatMovesFirst,
  type SpeedMode,
  type ThreatMatchups,
} from "./analyzeThreats";
import { estimateSpread } from "./estimateSpread";

const MOVES = movesData as unknown as Record<string, MoveData>;

/** The opponent's speed control a team has to plan around. */
export type SpeedControlKind = "trickRoom" | "tailwind";

/** A common setter of it in the metagame. */
export interface SpeedControlSetter {
  /** The metagame entry's name (a Mega its own). */
  species: string;
  /** Share of all teams carrying the Pokémon. */
  usage: number;
  /** Share of its teams running the move. */
  share: number;
  /** One of yours KOs its common set (one with the move) before it moves: a sure KO, or on a high roll. */
  koedBy: { index: number; move: string; sure: boolean }[];
  /** Why Fake Out can't stop it: its ability (Armor Tail, Inner Focus, …) or its Psychic Terrain. */
  fakeOutBlockedBy?: string;
}

/** A way to stop the opponent's speed control, or play through it. */
export type CounterKind =
  /** Stops Trick Room or Tailwind before it's set. */
  | "taunt"
  /** Imprison with Trick Room of its own: the opponent can't use Trick Room at all. */
  | "imprison"
  /** Your own Trick Room — reverses theirs, or turns their Tailwind against them. */
  | "trickRoom"
  /** Your own Tailwind. */
  | "tailwind"
  /** Icy Wind, Electroweb, Thunder Wave, … */
  | "speedDrop"
  /** A damaging priority move — goes first whatever the speed. */
  | "priority"
  | "choiceScarf"
  /** Fake Out on the setter — delays it a turn. */
  | "fakeOut"
  /** KOs a common setter before it sets (Trick Room goes last, -7). */
  | "koSetter";

export interface Counter {
  kind: CounterKind;
  index: number;
  /** The move or item. */
  via: string;
}

export type SpeedControlVerdict = "unaffected" | "covered" | "partial" | "exposed";

export interface SpeedControlReport {
  kind: SpeedControlKind;
  setters: SpeedControlSetter[];
  /**
   * How many of your Pokémon the common threats move first against, on
   * average, as a share of the team — as built, and under the opponent's
   * speed control.
   */
  exposure: { normal: number; under: number };
  counters: Counter[];
  verdict: SpeedControlVerdict;
}

const SPEED_DROP_MOVES = new Set([
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

/** Abilities that make Fake Out fail on (or not flinch) their holder. */
const FAKE_OUT_PROOF = new Set(["Armor Tail", "Queenly Majesty", "Dazzling", "Inner Focus"]);

/** Counters that answer it by themselves; the rest only help. */
const STRONG: Record<SpeedControlKind, Set<CounterKind>> = {
  trickRoom: new Set(["taunt", "imprison", "trickRoom", "koSetter"]),
  tailwind: new Set(["tailwind", "trickRoom", "speedDrop"]),
};

const MOVE_NAME: Record<SpeedControlKind, string> = {
  trickRoom: "Trick Room",
  tailwind: "Tailwind",
};
const UNDER: Record<SpeedControlKind, SpeedMode> = {
  trickRoom: "trickRoom",
  tailwind: "theirTailwind",
};

/** How many of the most-used sets exposure averages over. */
const EXPOSURE_SETS = 20;

/** The share of the team the most-used sets move first against, on average, in a mode. */
export function speedExposure(all: ThreatMatchups[], mode: SpeedMode): number {
  const common = [...all].sort((a, b) => b.set.usage - a.set.usage).slice(0, EXPOSURE_SETS);
  if (common.length === 0) return 0;
  const shares = common.map(
    ({ matchups }) =>
      matchups.filter((matchup) => threatMovesFirst(matchup, mode)).length /
      Math.max(matchups.length, 1),
  );
  return shares.reduce((sum, share) => sum + share, 0) / shares.length;
}

/** A setter's common set with the move: its most common full set that has it, else its most common moves with it. */
function setterSet(entry: MetaPokemon, move: string): ParsedPokemon {
  const set = entry.sets.find((candidate) => candidate.moves.includes(move));
  const moves =
    set?.moves ??
    [move, ...entry.moves.map((m) => m.name).filter((name) => name !== move)].slice(0, 4);
  const parsed: ParsedPokemon = {
    species: stripMegaSuffix(entry.species),
    item: set?.item ?? entry.items[0]?.name,
    ability: set?.ability ?? entry.abilities[0]?.name,
    nature: set?.nature ?? entry.natures[0]?.name,
    moves,
  };
  return { ...parsed, evs: estimateSpread(parsed) };
}

/** The metagame's common setters of a speed control, most used first — and which of yours KO them before they set it. */
export function speedControlSetters(
  meta: MetaPokemon[],
  kind: SpeedControlKind,
  team: ParsedPokemon[],
  { minShare = 0.25, limit = 4 } = {},
): SpeedControlSetter[] {
  const move = MOVE_NAME[kind];
  return meta
    .flatMap((entry) => {
      const share = entry.moves.find((m) => m.name === move)?.share ?? 0;
      return share >= minShare ? [{ entry, share }] : [];
    })
    .sort((a, b) => b.entry.usage * b.share - a.entry.usage * a.share)
    .slice(0, limit)
    .map(({ entry, share }): SpeedControlSetter => {
      const setter = setterSet(entry, move);
      // Trick Room goes last (-7), so a KO stops it whoever's faster; a
      // Focus Sash or Sturdy holder survives one. Tailwind isn't counted:
      // it goes when its user does (Prankster first).
      const ability = resolveEffectiveAbility(setter.species, setter.item, setter.ability) ?? "";
      const sturdy = setter.item === "Focus Sash" || ability === "Sturdy";
      // Psychic Terrain stops priority moves on grounded Pokémon — its own setter included.
      const fakeOutBlockedBy = FAKE_OUT_PROOF.has(ability)
        ? ability
        : ability === "Psychic Surge"
          ? "Psychic Terrain"
          : undefined;
      const field = fieldFor(setter, team);
      const koedBy =
        kind !== "trickRoom" || sturdy
          ? []
          : team.flatMap((mon, index) => {
              const hit = bestHit(mon, setter, field);
              if (!hit || hit.maxPercent < 100 || hit.accuracy < 1) return [];
              return [{ index, move: hit.move, sure: hit.minPercent >= 100 }];
            });
      return { species: entry.species, usage: entry.usage, share, koedBy, fakeOutBlockedBy };
    });
}

/** Your team's ways to stop a speed control, or play through it. */
export function speedControlCounters(
  team: ParsedPokemon[],
  kind: SpeedControlKind,
  setters: SpeedControlSetter[],
): Counter[] {
  const counters: Counter[] = [];
  const setsGrassy = team.some(
    (mon) => resolveEffectiveAbility(mon.species, mon.item, mon.ability) === "Grassy Surge",
  );
  team.forEach((mon, index) => {
    const keys = (mon.moves ?? []).map(normalizeSpeciesKey);
    const add = (counterKind: CounterKind, key: string) =>
      counters.push({ kind: counterKind, index, via: MOVES[key]?.name ?? key });
    for (const key of keys) {
      if (key === "taunt") add("taunt", key);
      if (key === "trick-room") add("trickRoom", key);
      if (kind === "trickRoom") {
        if (key === "imprison" && keys.includes("trick-room")) add("imprison", key);
        // Only if it works on one of the common setters.
        if (key === "fake-out" && setters.some((setter) => !setter.fakeOutBlockedBy)) {
          add("fakeOut", key);
        }
      } else {
        if (key === "tailwind") add("tailwind", key);
        if (SPEED_DROP_MOVES.has(key)) add("speedDrop", key);
        const data = MOVES[key];
        const priority =
          getMoveFlags(key).priority ?? (key === "grassy-glide" && setsGrassy ? 1 : 0);
        if (data && data.category !== "Status" && priority > 0 && key !== "fake-out") {
          add("priority", key);
        }
      }
    }
    if (kind === "tailwind" && mon.item === "Choice Scarf") {
      counters.push({ kind: "choiceScarf", index, via: mon.item });
    }
  });
  for (const setter of setters) {
    for (const ko of setter.koedBy) {
      if (!counters.some((c) => c.kind === "koSetter" && c.index === ko.index)) {
        counters.push({ kind: "koSetter", index: ko.index, via: ko.move });
      }
    }
  }
  return counters;
}

/**
 * How the team stands against the opponent's Trick Room or Tailwind: the
 * common setters, how much more often the common threats would move first
 * (exposure), your counters, and a verdict — unaffected (it barely changes
 * who moves first), covered (two or more kinds of strong counter), partial
 * (one, or only helpers like Fake Out or a priority move), or exposed (none).
 */
export function speedControlReport(
  team: ParsedPokemon[],
  meta: MetaPokemon[],
  all: ThreatMatchups[],
  kind: SpeedControlKind,
): SpeedControlReport {
  const setters = speedControlSetters(meta, kind, team);
  const counters = speedControlCounters(team, kind, setters);
  const exposure = { normal: speedExposure(all, "normal"), under: speedExposure(all, UNDER[kind]) };
  const strongKinds = new Set(
    counters.filter((counter) => STRONG[kind].has(counter.kind)).map((counter) => counter.kind),
  );
  const verdict: SpeedControlVerdict =
    exposure.under - exposure.normal < 0.15
      ? "unaffected"
      : strongKinds.size >= 2
        ? "covered"
        : strongKinds.size === 1 || counters.length > 0
          ? "partial"
          : "exposed";
  return { kind, setters, exposure, counters, verdict };
}
