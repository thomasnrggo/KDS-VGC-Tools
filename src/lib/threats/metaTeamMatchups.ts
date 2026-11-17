import { stripMegaSuffix } from "@/lib/species/megaForm";
import { withMetaSpread, type MetaSpreads } from "@/lib/meta/metaSpreads";
import type { MetaCombo, MetaPokemon } from "@/lib/meta/aggregateMeta";
import type { ParsedPokemon } from "@/types";
import {
  rankThreats,
  threatMatchups,
  threatMovesFirst,
  type Hit,
  type Matchup,
  type ThreatMatchups,
} from "./analyzeThreats";
import { metaBaseSet, metaSetItems, type MetaThreatSet } from "./metaSets";

/**
 * Your team against the metagame's common teams and cores (docs/archetypes.md —
 * "Meta matchups"): which you're strong or weak against, from the calcs.
 *
 * Each meta Pokémon is built once — its most common set: item, moves,
 * ability, nature, and the admin's spread where there is one — and calced
 * against your team both ways (threatMatchups: who KOs whom, who moves
 * first). A team or core is then scored from those duels:
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

/** How well `defender` answers `attacker`: KOs it (moving first, or surviving its hit), or 2HKOs it barely scratched. */
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

/** One of their Pokémon in the matchup. */
export interface TheirPokemon {
  set: MetaThreatSet;
  /** How hard it pressures your team after your best answer (v1's danger). */
  danger: number;
  /** Indexes of yours it OHKOs (for sure or on a roll). */
  ohkos: number[];
  /** Indexes of yours that answer it. */
  answeredBy: number[];
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
 * Scores one meta team or core against your team from precomputed duels
 * (`duels`: each of their sets' threatMatchups against your team, by set id).
 */
export function scoreCombo(
  combo: MetaCombo,
  kind: MetaTeamMatchup["kind"],
  sets: MetaThreatSet[],
  duels: Map<string, ThreatMatchups>,
  teamSize: number,
): MetaTeamMatchup | null {
  const theirs = sets.flatMap((set) => duels.get(set.id) ?? []);
  if (theirs.length === 0) return null;

  // Their side: v1's danger, from rankThreats (normal Speed), in their order.
  const ranked = rankThreats(theirs, "normal");
  const their: TheirPokemon[] = theirs.map(({ set }) => {
    const result = ranked.find((r) => r.set.id === set.id)!;
    return {
      set,
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

  const setsOf = new Map<MetaCombo, MetaThreatSet[]>();
  const unique = new Map<string, MetaThreatSet>();
  for (const combo of [...combos.teams, ...cores]) {
    const sets = comboSets(combo.species, metaPokemon, spreads);
    setsOf.set(combo, sets);
    for (const set of sets) unique.set(set.id, set);
  }
  // Each meta Pokémon calced once against your team, reused by every team and core it's in.
  const duels = new Map(threatMatchups(team, [...unique.values()]).map((m) => [m.set.id, m]));

  const score = (list: MetaCombo[], kind: MetaTeamMatchup["kind"]) =>
    list
      .flatMap(
        (combo) => scoreCombo(combo, kind, setsOf.get(combo) ?? [], duels, team.length) ?? [],
      )
      .sort((a, b) => b.score - a.score);

  return { teams: score(combos.teams, "team"), cores: score(cores, "core") };
}
