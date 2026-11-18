import { stripMegaSuffix } from "@/lib/species/megaForm";
import { withMetaSpread, type MetaSpreads } from "@/lib/meta/metaSpreads";
import type { MetaCombo, MetaPokemon } from "@/lib/meta/aggregateMeta";
import type { ParsedPokemon } from "@/types";
import {
  fieldFor,
  rankThreats,
  threatMatchups,
  threatMovesFirst,
  WALL_HITS_BACK,
  WALL_TAKES,
  type Hit,
  type Matchup,
  type ThreatMatchups,
  type ThreatResult,
} from "./analyzeThreats";
import { withSpread } from "./estimateSpread";
import { metaBaseSet, metaSetItems, type MetaThreatSet } from "./metaSets";

/**
 * Your team against the metagame's common teams and cores (docs/archetypes.md —
 * "Meta matchups"): which you're strong or weak against, from the calcs.
 *
 * Each meta Pokémon is built once — its most common set: item, moves,
 * ability, nature, and the admin's spread where there is one — and calced
 * against your team both ways (threatMatchups: who KOs whom, who moves
 * first), in the field it fights in beside its partners (their weather and
 * terrain — a Chlorophyll Venusaur beside Charizard Y is in sun). A team or
 * core is then scored from those duels:
 *
 * - their pressure: v1's danger for each of their Pokémon (OHKO 1 / roll 0.75
 *   / 2HKO 0.4 per one of yours, ×accuracy, ×1.3 moving first, reduced by
 *   your best answer), summed;
 * - your pressure: the same from your side, each of yours against them;
 * - score = (yours − theirs) per Pokémon of theirs: above 0 you're favored.
 *
 * Normal Speed only (no Tailwind / Trick Room modes), one set per Pokémon, all
 * of theirs against all of yours (not team preview).
 */

const KO_WEIGHT = { ohko: 1, rollOhko: 0.75, twoHko: 0.4 } as const;
type KoLevel = keyof typeof KO_WEIGHT;
const ANSWER_WEIGHT = { ko: 1, rollKo: 0.7, check: 0.5 } as const;

function koLevel(hit: Hit | null): KoLevel | null {
  if (!hit) return null;
  if (hit.minPercent >= 100) return "ohko";
  if (hit.maxPercent >= 100) return "rollOhko";
  if (hit.minPercent >= 50) return "twoHko";
  return null;
}

/** How well `defender` answers `attacker`: KOs it (moving first, or surviving its hit), 2HKOs it barely scratched, or walls it. */
function answerWeight(
  attackerHit: Hit | null,
  defenderHit: Hit | null,
  attackerMovesFirst: boolean,
): number {
  if (!defenderHit) return 0;
  const getsToHit = !attackerMovesFirst || !attackerHit || attackerHit.maxPercent < 100;
  if (!getsToHit) return 0;
  if (defenderHit.minPercent >= 100) return ANSWER_WEIGHT.ko * defenderHit.accuracy;
  if (defenderHit.maxPercent >= 100) return ANSWER_WEIGHT.rollKo * defenderHit.accuracy;
  if (defenderHit.minPercent >= 50 && (attackerHit?.maxPercent ?? 0) < 50) {
    return ANSWER_WEIGHT.check;
  }
  // Walls it (as analyzeThreats' answerLevel).
  if (defenderHit.minPercent >= WALL_HITS_BACK && (attackerHit?.maxPercent ?? 0) <= WALL_TAKES) {
    return ANSWER_WEIGHT.check;
  }
  return 0;
}

/** A meta team or core (MetaCombo) → its Pokémon's most common set, as calc sets. Members with no metagame entry are left out. */
export function comboSets(
  species: string[],
  metaPokemon: MetaPokemon[],
  spreads?: MetaSpreads,
): MetaThreatSet[] {
  return species.flatMap((name) => {
    // The list is by usage: the first entry of the species (a Mega or not) is its usual form.
    const entry = metaPokemon.find((candidate) => stripMegaSuffix(candidate.species) === name);
    if (!entry) return [];
    const item = metaSetItems(entry, { minShare: 0, perPokemon: 1 })[0]?.name;
    const { pokemon, fromAdmin } = withMetaSpread(metaBaseSet(entry, item), entry.species, spreads);
    return [
      {
        id: `${entry.species}|${item ?? ""}`,
        species: entry.species,
        pokemon,
        spreadFromAdmin: fromAdmin,
        share: 1,
        usage: entry.usage,
        winRate: entry.winRate,
      },
    ];
  });
}

/** How a meta team's score reads: strong ≥ 0.75, favored ≥ 0.25, even, unfavored ≤ −0.25, weak ≤ −0.75. */
export type MatchupLevel = "strong" | "favored" | "even" | "unfavored" | "weak";

export function matchupLevel(score: number): MatchupLevel {
  if (score >= 0.75) return "strong";
  if (score >= 0.25) return "favored";
  if (score > -0.25) return "even";
  if (score > -0.75) return "unfavored";
  return "weak";
}

/** One of their Pokémon in the matchup. */
export interface TheirPokemon {
  set: MetaThreatSet;
  /** How hard it pressures your team after your best answer (v1's danger). */
  danger: number;
  /** Indexes of yours it OHKOs (for sure or on a roll). */
  ohkos: number[];
  /** Indexes of yours that answer it. */
  answeredBy: number[];
  /** Its duels against your team, in the field it fights in beside its partners — for a threat card. */
  result: ThreatResult;
}

/** One of yours in the matchup. */
export interface YourPokemon {
  index: number;
  danger: number;
  /** Their Pokémon (by index in `their`) it OHKOs. */
  ohkos: number[];
  /** Whether any of theirs answers it. */
  answered: boolean;
}

export interface MetaTeamMatchup {
  combo: MetaCombo;
  /** "team" for a full team, "core" for a 3–4 Pokémon combination. */
  kind: "team" | "core";
  their: TheirPokemon[];
  yours: YourPokemon[];
  theirPressure: number;
  yourPressure: number;
  /** (yours − theirs) per Pokémon of theirs; above 0 you're favored. */
  score: number;
}

/**
 * Scores one meta team or core against your team from its Pokémon's
 * precomputed duels (`theirs`: each one's threatMatchups against your team,
 * in the field it fights in beside its partners).
 */
export function scoreCombo(
  combo: MetaCombo,
  kind: MetaTeamMatchup["kind"],
  theirs: ThreatMatchups[],
  teamSize: number,
): MetaTeamMatchup | null {
  if (theirs.length === 0) return null;

  // Their side: v1's danger, from rankThreats (normal Speed), in their order.
  const ranked = rankThreats(theirs, "normal");
  const their: TheirPokemon[] = theirs.map(({ set }) => {
    const result = ranked.find((r) => r.set.id === set.id)!;
    return {
      set,
      result,
      danger: result.danger,
      ohkos: result.duels.flatMap((duel, index) =>
        duel.ko === "ohko" || duel.ko === "rollOhko" ? [index] : [],
      ),
      answeredBy: result.duels.flatMap((duel, index) => (duel.answer ? [index] : [])),
    };
  });

  // Your side: the same formula with the roles swapped.
  const yours: YourPokemon[] = Array.from({ length: teamSize }, (_, index) => {
    let pressure = 0;
    let answer = 0;
    const ohkos: number[] = [];
    theirs.forEach((threat, theirIndex) => {
      const matchup: Matchup = threat.matchups[index];
      const theyMoveFirst = threatMovesFirst(matchup, "normal");
      const ko = koLevel(matchup.yours);
      if (ko && matchup.yours) {
        pressure += KO_WEIGHT[ko] * matchup.yours.accuracy * (theyMoveFirst ? 1 : 1.3);
        if (ko !== "twoHko") ohkos.push(theirIndex);
      }
      answer = Math.max(answer, answerWeight(matchup.yours, matchup.theirs, !theyMoveFirst));
    });
    return { index, danger: pressure * (1 - 0.7 * answer), ohkos, answered: answer > 0 };
  });

  const theirPressure = their.reduce((sum, mon) => sum + mon.danger, 0);
  const yourPressure = yours.reduce((sum, mon) => sum + mon.danger, 0);
  return {
    combo,
    kind,
    their,
    yours,
    theirPressure,
    yourPressure,
    score: (yourPressure - theirPressure) / their.length,
  };
}

/**
 * Your team against any team — an opponent from the Matchup Planner, with its
 * own sets (Stat Points estimated where it has none) — scored like a meta
 * team (scoreCombo), each Pokémon in its partners' weather and terrain.
 * Null when none of its Pokémon can be calced.
 */
export function teamMatchup(
  team: ParsedPokemon[],
  theirs: ParsedPokemon[],
): MetaTeamMatchup | null {
  const pokemon = theirs.map((mon) => withSpread(mon).pokemon);
  const sets: MetaThreatSet[] = pokemon.map((mon, index) => ({
    id: `${mon.species}|${mon.item ?? ""}|${index}`,
    species: mon.species,
    pokemon: mon,
    spreadFromAdmin: false,
    share: 1,
    usage: 1,
    winRate: null,
  }));
  const duels = sets.flatMap((set) =>
    threatMatchups(
      team,
      [set],
      pokemon.filter((mon) => mon !== set.pokemon),
    ),
  );
  const combo: MetaCombo = {
    species: pokemon.map((mon) => stripMegaSuffix(mon.species)).sort(),
    teams: 0,
    usage: 0,
    topUsage: 0,
    winRate: null,
    rounds: 0,
  };
  return scoreCombo(combo, "team", duels, team.length);
}

/** Shares this many Pokémon with a core already listed, and a core adds nothing new. */
const CORE_OVERLAP = 3;

export interface MetaMatchupsReport {
  /** Every team and core scored, best for you first. */
  teams: MetaTeamMatchup[];
  cores: MetaTeamMatchup[];
}

/**
 * Your team against the metagame's most common full teams and cores (quads,
 * then trios). Cores that share 3+ Pokémon with a more common listed core
 * are left out, so one team's subsets don't fill the list.
 */
export function metaTeamMatchups(
  team: ParsedPokemon[],
  combos: { teams: MetaCombo[]; quads: MetaCombo[]; trios: MetaCombo[] },
  metaPokemon: MetaPokemon[],
  spreads?: MetaSpreads,
): MetaMatchupsReport {
  const cores: MetaCombo[] = [];
  for (const core of [...combos.quads, ...combos.trios]) {
    const overlaps = cores.some(
      (listed) => core.species.filter((s) => listed.species.includes(s)).length >= CORE_OVERLAP,
    );
    if (!overlaps) cores.push(core);
  }

  // Each meta Pokémon calced once per field it fights in — its partners' weather
  // and terrain count (a Chlorophyll Venusaur beside Charizard Y is in sun) —
  // and reused by every team and core that puts it there.
  const duels = new Map<string, ThreatMatchups | null>();
  const fieldKey = (field: { weather?: string; terrain?: string }) =>
    `${field.weather ?? ""}|${field.terrain ?? ""}`;
  function duelsOf(combo: MetaCombo): ThreatMatchups[] {
    const sets = comboSets(combo.species, metaPokemon, spreads);
    const all = sets.map((set) => set.pokemon);
    return sets.flatMap((set) => {
      const partners = all.filter((mon) => mon !== set.pokemon);
      const key = `${set.id}#${fieldKey(fieldFor(set.pokemon, team, partners))}`;
      if (!duels.has(key)) duels.set(key, threatMatchups(team, [set], partners)[0] ?? null);
      return duels.get(key) ?? [];
    });
  }

  const score = (list: MetaCombo[], kind: MetaTeamMatchup["kind"]) =>
    list
      .flatMap((combo) => scoreCombo(combo, kind, duelsOf(combo), team.length) ?? [])
      .sort((a, b) => b.score - a.score);

  return { teams: score(combos.teams, "team"), cores: score(cores, "core") };
}
