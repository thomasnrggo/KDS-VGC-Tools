import type { VersusArchetype } from "@/lib/archetypes";
import { coverageGaps, weakSpots, type DefenseRow, type TeamCoverage } from "@/lib/teamCoverage";
import type { FieldSource, MetaTeamMatchup, SetIssue, ThreatResult } from "@/lib/threats";
import { speciesIdentity } from "@/lib/teamIdentity";

/**
 * The team page's Strategy → "Auto-detected" watch-outs: what's worth
 * knowing about the team's weaknesses, picked from what the other tabs
 * already work out — never new calcs. Each is shown live (recomputed as
 * the team changes) and links to the tab it comes from:
 *
 * - threats (Analysis → Threats): of the meta's most dangerous sets for this
 *   team, the ones nothing answers, or only one Pokémon does (lose it and
 *   there's no answer left) — with what they KO and who answers them; a
 *   threat two or more of yours answer isn't one to note — plus the ones
 *   added by hand;
 * - matchups (Meta): the archetypes to prep for, each with a common team of
 *   it (each Pokémon in its partners' weather) — the calcs or real games say
 *   it's hard — plus the teams added by hand, and weak cores;
 * - typing (Analysis → Coverage): types it's weak to, types it can't hit;
 * - sets (Analysis → Threats): sets that can't do what they're built for.
 *
 * Only what stands out is listed: a solid team gets a short list.
 */

export type Watchout =
  | {
      kind: "threat";
      species: string;
      item?: string;
      /** Yours it OHKOs for sure (its lowest roll KOs), with the move and damage. */
      ohkos: KoHit[];
      /** Yours it OHKOs on a high roll. */
      rollOhkos: KoHit[];
      /** Indexes of yours it 2HKOs. */
      twoHkos: number[];
      /** Every duel against your team, for the details card. */
      result: ThreatResult;
      /**
       * The weather and terrain the calcs ran in — its own, else your team's
       * (Grassy Terrain boosting a Leaf Storm) — only when it changed a hit,
       * a Speed or a priority, with who sets it.
       */
      weather?: string;
      terrain?: string;
      weatherBy?: FieldSource;
      terrainBy?: FieldSource;
      /** Indexes of yours that answer it (none or one, unless added by hand). */
      answeredBy: number[];
      /** Added by hand ("Be careful with" → +), listed whatever the calcs say. */
      pinned?: boolean;
    }
  | { kind: "weakTeam"; matchup: MetaTeamMatchup }
  | {
      kind: "prepFor";
      /** The archetype's classification primary (archetypeMatchups' opponent id). */
      archetype: string;
      /** Its most challenging common team: the worst score for you, or null when none of the common teams is of it. */
      matchup: MetaTeamMatchup | null;
      /** How teams like yours did against it in real games, when they struggled. */
      real?: VersusArchetype;
      /** Added by hand (Prep for → +): its team, listed whatever the calcs say — with its key in Team.watchTeams. */
      pinned?: boolean;
      pinnedKey?: string;
      /** An opponent from the Matchup Planner added by hand: its name there. */
      label?: string;
    }
  | { kind: "weakCore"; matchup: MetaTeamMatchup }
  | { kind: "archetype"; versus: VersusArchetype }
  | { kind: "weakType"; type: string; weak: number; resist: number; row: DefenseRow }
  | { kind: "coverageGap"; types: string[] }
  | { kind: "setIssue"; issue: SetIssue };

/** One of yours a threat knocks out: which, with what, for how much. */
export interface KoHit {
  index: number;
  move: string;
  minPercent: number;
  maxPercent: number;
}

export type WatchoutGroup = "threats" | "matchups" | "typing" | "sets";

export function watchoutGroup(watchout: Watchout): WatchoutGroup {
  switch (watchout.kind) {
    case "threat":
      return "threats";
    case "weakTeam":
    case "prepFor":
    case "weakCore":
    case "archetype":
      return "matchups";
    case "weakType":
    case "coverageGap":
      return "typing";
    case "setIssue":
      return "sets";
  }
}

/** Among the top threats (the Threats tab's "Nothing answers" looks at as many). */
export const THREATS_CONSIDERED = 15;
/** Threats listed. */
export const THREATS_LISTED = 4;
/** Meta teams the calcs score at or below this are "weak against" (the Meta matchups tab's "Weak"). */
export const WEAK_TEAM_SCORE = -0.75;
const WEAK_TEAMS_LISTED = 2;
const WEAK_CORES_LISTED = 2;
const ARCHETYPES_LISTED = 2;
const WEAK_TYPES_LISTED = 3;

/**
 * The threats worth a note: of the top THREATS_CONSIDERED sets (ranked, the
 * team as built), each Pokémon once — its most dangerous set — when nothing
 * on the team answers it, or only one Pokémon does and it OHKOs something.
 * Unanswered ones first.
 */
export function threatWatchouts(ranked: ThreatResult[]): Watchout[] {
  const seen = new Set<string>();
  const picked: ThreatWatchout[] = [];
  for (const result of ranked.slice(0, THREATS_CONSIDERED)) {
    if (seen.has(result.set.species)) continue;
    seen.add(result.set.species);
    const watchout = threatWatchout(result);
    if (isNotableThreat(watchout)) picked.push(watchout);
  }
  // Stable: unanswered first, each side in rank order.
  return [
    ...picked.filter((w) => w.answeredBy.length === 0),
    ...picked.filter((w) => w.answeredBy.length > 0),
  ].slice(0, THREATS_LISTED);
}

export type ThreatWatchout = Extract<Watchout, { kind: "threat" }>;

/**
 * Whether a threat is worth a note: nothing answers it and it KOs something
 * in one or two hits, or only one of yours answers it directly (others may
 * after setting up) and it OHKOs something.
 * Two answers or more: handled. Answered and only chipping (2HKOs — bulky
 * support like Incineroar): not one either.
 */
export function isNotableThreat(watchout: ThreatWatchout): boolean {
  // An answer that needs setting up first (Swords Dance behind Fake Out) is
  // shown, but doesn't make a threat handled: it costs a turn and can be
  // played around.
  const direct = watchout.answeredBy.filter(
    (index) => watchout.result.duels[index]?.answer !== "setup",
  );
  if (direct.length > 1) return false;
  const anyOhko = watchout.ohkos.length + watchout.rollOhkos.length > 0;
  if (watchout.answeredBy.length > 0) return anyOhko;
  return anyOhko || watchout.twoHkos.length > 0;
}

/** Key members of a prep team shown with a line each. */
const PREP_KEYS_LISTED = 2;

/**
 * What makes a meta team a challenge: its members that are notable threats
 * to you (isNotableThreat, in the field they fight in beside their
 * partners), unanswered ones first, then the most dangerous — or, when none
 * is on its own, its single most dangerous member. Each with its watch-out,
 * for the threat card.
 */
export function prepKeyThreats(matchup: MetaTeamMatchup): ThreatWatchout[] {
  const members = matchup.their
    .map((mon) => threatWatchout(mon.result))
    .sort((a, b) => b.result.danger - a.result.danger);
  const notable = members.filter(isNotableThreat);
  if (notable.length === 0) return members.slice(0, 1);
  return [
    ...notable.filter((w) => w.answeredBy.length === 0),
    ...notable.filter((w) => w.answeredBy.length > 0),
  ].slice(0, PREP_KEYS_LISTED);
}

/** One threat's watch-out — its KOs, answers and field — whether or not it'd be listed. */
export function threatWatchout(result: ThreatResult): ThreatWatchout {
  const hits = (level: "ohko" | "rollOhko"): KoHit[] =>
    result.duels.flatMap((duel, index) =>
      duel.ko === level && duel.theirs
        ? [
            {
              index,
              move: duel.theirs.move,
              minPercent: duel.theirs.minPercent,
              maxPercent: duel.theirs.maxPercent,
            },
          ]
        : [],
    );
  return {
    kind: "threat",
    species: result.set.species,
    item: result.set.pokemon.item,
    ohkos: hits("ohko"),
    rollOhkos: hits("rollOhko"),
    twoHkos: result.duels.flatMap((duel, index) => (duel.ko === "twoHko" ? [index] : [])),
    answeredBy: result.duels.flatMap((duel, index) => (duel.answer ? [index] : [])),
    result,
    ...(result.weather && result.field.weatherMattered
      ? { weather: result.weather, weatherBy: result.field.weather }
      : {}),
    ...(result.terrain && result.field.terrainMattered
      ? { terrain: result.terrain, terrainBy: result.field.terrain }
      : {}),
  };
}

/**
 * "Be careful with": the Pokémon added by hand first (`pinned` — each one's
 * most dangerous set, whatever the calcs say; one with no metagame set is
 * left out), then the ones picked from the calcs (threatWatchouts), each
 * Pokémon once.
 */
export function carefulWithWatchouts(ranked: ThreatResult[], pinned: string[] = []): Watchout[] {
  const added = pinned.flatMap((species) => {
    const result = ranked.find((candidate) => candidate.set.species === species);
    return result ? [{ ...threatWatchout(result), pinned: true }] : [];
  });
  const auto = threatWatchouts(ranked).filter(
    (watchout) => watchout.kind !== "threat" || !pinned.includes(watchout.species),
  );
  return [...added, ...auto];
}

/** The common teams the calcs score the team as weak against, worst first. */
export function weakTeamWatchouts(teams: MetaTeamMatchup[]): Watchout[] {
  return teams
    .filter((matchup) => matchup.score <= WEAK_TEAM_SCORE)
    .sort((a, b) => a.score - b.score)
    .slice(0, WEAK_TEAMS_LISTED)
    .map((matchup) => ({ kind: "weakTeam", matchup }));
}

/** The common cores (3–4 Pokémon) the calcs score the team as weak against, worst first. */
export function weakCoreWatchouts(cores: MetaTeamMatchup[]): Watchout[] {
  return cores
    .filter((matchup) => matchup.score <= WEAK_TEAM_SCORE)
    .sort((a, b) => a.score - b.score)
    .slice(0, WEAK_CORES_LISTED)
    .map((matchup) => ({ kind: "weakCore", matchup }));
}

/** A meta team the calcs score at or below this is a challenge (the Meta matchups tab's "Unfavored"). */
export const PREP_SCORE = -0.25;
const PREP_LISTED = 3;

/**
 * "Prep for": the archetypes worth preparing for, each with one specific
 * common team of it to prep against. An archetype is listed when the calcs
 * score one of its common teams unfavored for you, or teams like yours lost
 * to it in real games (`hard`, archetypeMatchups'); its team is the one that
 * scores worst for you. Worst first — real results and calcs together.
 * `primaryOf` names a meta team's archetype (its classification primary).
 */
export function prepWatchouts(
  teams: MetaTeamMatchup[],
  primaryOf: (matchup: MetaTeamMatchup) => string,
  hard: VersusArchetype[] = [],
): Watchout[] {
  const worst = new Map<string, MetaTeamMatchup>();
  for (const matchup of teams) {
    const primary = primaryOf(matchup);
    const current = worst.get(primary);
    if (!current || matchup.score < current.score) worst.set(primary, matchup);
  }
  const archetypes = new Set([
    ...[...worst].filter(([, matchup]) => matchup.score <= PREP_SCORE).map(([id]) => id),
    ...hard.map((versus) => versus.opponent),
  ]);
  // How badly: below 50% in real games counts like an unfavored calc.
  const severity = (id: string) => {
    const real = hard.find((versus) => versus.opponent === id);
    const score = worst.get(id)?.score ?? 0;
    return Math.min(score, 0) * -1 + (real ? (0.5 - real.winRate) * 4 : 0);
  };
  return [...archetypes]
    .sort((a, b) => severity(b) - severity(a))
    .slice(0, PREP_LISTED)
    .map((archetype) => {
      const real = hard.find((versus) => versus.opponent === archetype);
      return {
        kind: "prepFor" as const,
        archetype,
        matchup: worst.get(archetype) ?? null,
        ...(real ? { real } : {}),
      };
    });
}

/** A team's key for "Prep for" teams added by hand (Team.watchTeams): its species, Megas as their base, sorted. */
export function teamKey(species: string[]): string {
  return species.map(speciesIdentity).sort().join("|");
}

/** A Matchup Planner opponent's key among "Prep for" teams added by hand (Team.watchTeams), beside common meta teams' teamKey. */
export function opponentWatchKey(id: string): string {
  return `opponent:${id}`;
}

/**
 * "Prep for" with the teams added by hand (`pinned`: teamKey for a common
 * meta team, opponentWatchKey for an opponent) first — each scored by the
 * calcs, whatever its score, through `resolve`; one that's gone (no longer a
 * common team, an opponent deleted) is left out — then the ones picked
 * (prepWatchouts), minus a pick whose team was added, and a pick with no
 * team of its own whose archetype a team added by hand is of (folded into it,
 * real results and all).
 */
export function prepWithPinned(
  picked: Watchout[],
  pinned: string[],
  resolve: (key: string) => { matchup: MetaTeamMatchup; label?: string } | undefined,
  primaryOf: (matchup: MetaTeamMatchup) => string,
): Watchout[] {
  const added = pinned.flatMap((key) => {
    const found = resolve(key);
    return found
      ? [
          {
            kind: "prepFor" as const,
            archetype: primaryOf(found.matchup),
            matchup: found.matchup,
            pinned: true,
            pinnedKey: key,
            ...(found.label ? { label: found.label } : {}),
          },
        ]
      : [];
  });
  // A pick with no team of its own (only real results) is folded into a
  // team added by hand of the same archetype — its real results with it.
  const folded = (watchout: Watchout) =>
    watchout.kind === "prepFor" &&
    !watchout.matchup &&
    added.some((entry) => entry.archetype === watchout.archetype);
  const withReal = added.map((entry) => {
    const pick = picked.find(
      (watchout) =>
        watchout.kind === "prepFor" && watchout.archetype === entry.archetype && watchout.real,
    );
    return pick?.kind === "prepFor" && pick.real ? { ...entry, real: pick.real } : entry;
  });
  const rest = picked.filter(
    (watchout) =>
      watchout.kind !== "prepFor" ||
      (folded(watchout) === false &&
        (!watchout.matchup || !pinned.includes(teamKey(watchout.matchup.combo.species)))),
  );
  return [...withReal, ...rest];
}

/** The archetypes teams like this one lost to in real games (archetypeMatchups' "hard"), worst first. */
export function archetypeWatchouts(hard: VersusArchetype[]): Watchout[] {
  return [...hard]
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, ARCHETYPES_LISTED)
    .map((versus) => ({ kind: "archetype", versus }));
}

/** Types the team is weak to (the Coverage tab's "Watch out"), and those it can't hit super effectively. */
export function typingWatchouts(coverage: TeamCoverage): Watchout[] {
  const weak: Watchout[] = weakSpots(coverage)
    .slice(0, WEAK_TYPES_LISTED)
    .map((row) => ({ kind: "weakType", type: row.type, weak: row.weak, resist: row.resist, row }));
  const gaps = coverageGaps(coverage).map((row) => row.type);
  return gaps.length ? [...weak, { kind: "coverageGap", types: gaps }] : weak;
}

export function setIssueWatchouts(issues: SetIssue[]): Watchout[] {
  return issues.map((issue) => ({ kind: "setIssue", issue }));
}
