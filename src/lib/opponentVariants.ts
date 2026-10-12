import { MEGA_STONE_SUFFIX_BY_ITEM } from "@/constants";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { speciesNamesMegaForm } from "@/lib/species/megaForm";
import { speciesIdentity, teamFingerprint } from "@/lib/teamIdentity";
import { compareOpponentOrder } from "@/lib/opponent";
import type { MatchupPlan, Opponent, ParsedPokemon } from "@/types";

// Variant detection thresholds — see docs/opponent-organization.md's
// "Variant detection rules" for the reasoning behind each, and the M-C
// "best teams" folder they were tuned against.
/** Rule 1: this many shared Pokémon is a variant regardless of Megas. */
export const VARIANT_MIN_SHARED_ANY = 5;
/** Rule 2: this many shared Pokémon plus at least one shared Mega. */
export const VARIANT_MIN_SHARED_WITH_MEGA = 4;
/** Rule 3: double-Mega teams sharing both Megas need only this many shared Pokémon in total. */
export const VARIANT_MIN_SHARED_DOUBLE_MEGA = 3;

export interface TeamComparison {
  sharedPokemon: number;
  sharedMegas: number;
  /** Shared Pokémon whose item and moves are also identical — ranks otherwise-tied matches. */
  identicalSets: number;
}

/**
 * The Megas a team carries, each identified by species + stone — Charizard
 * @ Charizardite X and @ Charizardite Y are the same Pokémon but different
 * Megas. A species already named as its Mega form ("Golisopod-Mega") counts
 * too, keyed by that form's name when there's no recognizable stone.
 */
export function megaIdentities(pokemon: ParsedPokemon[]): Set<string> {
  const megas = new Set<string>();
  for (const mon of pokemon) {
    const itemKey = mon.item ? normalizeSpeciesKey(mon.item) : "";
    if (itemKey && MEGA_STONE_SUFFIX_BY_ITEM[itemKey]) {
      megas.add(`${speciesIdentity(mon.species)}|${itemKey}`);
    } else if (speciesNamesMegaForm(mon.species)) {
      megas.add(`${speciesIdentity(mon.species)}|${normalizeSpeciesKey(mon.species)}`);
    }
  }
  return megas;
}

export function compareTeams(a: ParsedPokemon[], b: ParsedPokemon[]): TeamComparison {
  const bBySpecies = new Map(b.map((mon) => [speciesIdentity(mon.species), mon]));
  let sharedPokemon = 0;
  let identicalSets = 0;
  for (const mon of a) {
    const match = bBySpecies.get(speciesIdentity(mon.species));
    if (!match) continue;
    sharedPokemon += 1;
    if (teamFingerprint([mon]) === teamFingerprint([match])) identicalSets += 1;
  }

  const aMegas = megaIdentities(a);
  const bMegas = megaIdentities(b);
  const sharedMegas = [...aMegas].filter((mega) => bMegas.has(mega)).length;

  return { sharedPokemon, sharedMegas, identicalSets };
}

/** Whether two teams are similar enough to be variants of each other — any one of the three rules. */
export function isVariantMatch(a: ParsedPokemon[], b: ParsedPokemon[]): boolean {
  const { sharedPokemon, sharedMegas } = compareTeams(a, b);
  if (sharedPokemon >= VARIANT_MIN_SHARED_ANY) return true;
  if (sharedPokemon >= VARIANT_MIN_SHARED_WITH_MEGA && sharedMegas >= 1) return true;
  const isDoubleMegaCore =
    megaIdentities(a).size === 2 && megaIdentities(b).size === 2 && sharedMegas === 2;
  return isDoubleMegaCore && sharedPokemon >= VARIANT_MIN_SHARED_DOUBLE_MEGA;
}

/** Best match first: more shared Megas, then more shared Pokémon, then more identical sets. */
function compareStrength(a: TeamComparison, b: TeamComparison): number {
  return (
    b.sharedMegas - a.sharedMegas ||
    b.sharedPokemon - a.sharedPokemon ||
    b.identicalSets - a.identicalSets
  );
}

export interface VariantCandidate<T> {
  /** The group's main (whatever identifies it to the caller — an Opponent, an import row, …). */
  main: T;
  comparison: TeamComparison;
}

/**
 * Groups `pokemon` could join as a variant, best first. Each group is
 * compared through every member (main and variants), keeping its single
 * strongest match — but a team is only ever offered *one* slot per group,
 * which is what stops chains (aerozard → sun zard → Zardpex) merging
 * separate groups into one blob.
 */
export function findVariantCandidates<T>(
  pokemon: ParsedPokemon[],
  groups: { main: T; members: ParsedPokemon[][] }[],
): VariantCandidate<T>[] {
  const candidates: VariantCandidate<T>[] = [];
  for (const group of groups) {
    let best: TeamComparison | null = null;
    for (const member of group.members) {
      if (!isVariantMatch(pokemon, member)) continue;
      const comparison = compareTeams(pokemon, member);
      if (!best || compareStrength(comparison, best) < 0) best = comparison;
    }
    if (best) candidates.push({ main: group.main, comparison: best });
  }
  return candidates.sort((a, b) => compareStrength(a.comparison, b.comparison));
}

export interface OpponentGroup {
  main: Opponent;
  /**
   * In their own manual order — the same sortOrder/compareOpponentOrder as
   * the mains, but only compared within the group, so moving a variant never
   * touches the main list.
   */
  variants: Opponent[];
}

/**
 * Splits one regulation's opponents (already in list order) into groups,
 * preserving the mains' order. A variant whose main isn't in `opponents`
 * (deleted on another device, say) is shown as a main of its own rather than
 * disappearing.
 */
export function groupOpponents(opponents: Opponent[]): OpponentGroup[] {
  const ids = new Set(opponents.map((opponent) => opponent.id));
  const isVariant = (opponent: Opponent) =>
    !!opponent.variantOf && opponent.variantOf !== opponent.id && ids.has(opponent.variantOf);

  const variantsByMain = new Map<string, Opponent[]>();
  for (const opponent of opponents) {
    if (!isVariant(opponent)) continue;
    const list = variantsByMain.get(opponent.variantOf!) ?? [];
    list.push(opponent);
    variantsByMain.set(opponent.variantOf!, list);
  }

  return opponents
    .filter((opponent) => !isVariant(opponent))
    .map((main) => ({
      main,
      variants: (variantsByMain.get(main.id) ?? []).sort(compareOpponentOrder),
    }));
}

/** Groups in the shape findVariantCandidates wants, with the main Opponent as the identifier. */
export function candidateGroupsFrom(groups: OpponentGroup[]) {
  return groups.map((group) => ({
    main: group.main,
    members: [group.main, ...group.variants].map((opponent) => opponent.team.pokemon),
  }));
}

function withoutVariantOf(opponent: Opponent): Opponent {
  const next = { ...opponent };
  delete next.variantOf;
  return next;
}

/**
 * Turns `opponent` into a variant of `main`. Plans: for each of your teams
 * that has a plan against `main` but none against `opponent` yet, the plan is
 * copied over and flagged in copiedPlanFrom (the "Copied from …" badge) until
 * it's edited — an existing plan is never overwritten.
 */
export function asVariantOf(opponent: Opponent, main: Opponent, now: string): Opponent {
  const plansByTeamId: Record<string, MatchupPlan> = { ...opponent.plansByTeamId };
  const copiedPlanFrom: Record<string, string> = { ...opponent.copiedPlanFrom };
  for (const [teamId, plan] of Object.entries(main.plansByTeamId)) {
    if (plansByTeamId[teamId]) continue;
    plansByTeamId[teamId] = structuredClone(plan);
    copiedPlanFrom[teamId] = main.id;
  }
  const next: Opponent = { ...opponent, variantOf: main.id, plansByTeamId, updatedAt: now };
  if (Object.keys(copiedPlanFrom).length > 0) next.copiedPlanFrom = copiedPlanFrom;
  return next;
}

/** Drops the "Copied from …" flag for `teamId` — called when that plan is edited. */
export function clearCopiedPlanFlag(opponent: Opponent, teamId: string): Opponent {
  if (!opponent.copiedPlanFrom?.[teamId]) return opponent;
  const copiedPlanFrom = { ...opponent.copiedPlanFrom };
  delete copiedPlanFrom[teamId];
  const next: Opponent = { ...opponent, copiedPlanFrom };
  if (Object.keys(copiedPlanFrom).length === 0) delete next.copiedPlanFrom;
  return next;
}

/**
 * Makes `newMainId` the main of `group`: it takes over the group's list
 * position (the old main's sortOrder), the old main takes the promoted
 * variant's slot among the variants (its sortOrder), and the old main plus
 * every other variant now point at it. Returns the changed opponents.
 */
export function promoteVariant(group: OpponentGroup, newMainId: string, now: string): Opponent[] {
  const newMain = group.variants.find((variant) => variant.id === newMainId);
  if (!newMain) return [];
  return [
    { ...withoutVariantOf(newMain), sortOrder: group.main.sortOrder, updatedAt: now },
    { ...group.main, variantOf: newMainId, sortOrder: newMain.sortOrder, updatedAt: now },
    ...group.variants
      .filter((variant) => variant.id !== newMainId)
      .map((variant) => ({ ...variant, variantOf: newMainId, updatedAt: now })),
  ];
}

/** Clears `variantOf`, leaving the team as a main of its own. Positioning it in the list is the caller's job. */
export function detachVariant(variant: Opponent, now: string): Opponent {
  return { ...withoutVariantOf(variant), updatedAt: now };
}
