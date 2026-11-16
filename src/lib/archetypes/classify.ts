import type { ParsedPokemon } from "@/types";
import { matchesCheck, pokemonFacts, type PokemonFacts } from "./checks";
import type {
  ArchetypeDefinition,
  ArchetypeMatch,
  ArchetypeSet,
  RoleDefinition,
  TeamClassification,
  TeamCondition,
  Tempo,
} from "./types";

/**
 * Classifies a team against an archetype set (docs/archetypes.md):
 *
 * 1. Tag each Pokémon with the roles it holds.
 * 2. Test every active archetype for the regulation: all `requires` (its
 *    own and its ancestors') pass, no `excludes` does.
 * 3. Rank the matches — priority, then specificity (how many conditions it
 *    needed), then boosts. The best is the primary; other matches that
 *    aren't an ancestor of another match become tags. No match → primary
 *    null, which the app shows as Balance.
 */

/** The ids of the roles one Pokémon holds. */
export function rolesOf(facts: PokemonFacts, roles: RoleDefinition[]): string[] {
  return roles.filter((role) => matchesCheck(facts, role.match)).map((role) => role.id);
}

interface TeamContext {
  facts: PokemonFacts[];
  roles: string[][];
}

export function conditionPasses(condition: TeamCondition, team: TeamContext): boolean {
  if ("allOf" in condition) return condition.allOf.every((inner) => conditionPasses(inner, team));
  if ("anyOf" in condition) return condition.anyOf.some((inner) => conditionPasses(inner, team));
  const count =
    "role" in condition
      ? team.roles.filter((roles) => roles.includes(condition.role)).length
      : team.facts.filter((facts) => matchesCheck(facts, condition.pokemon)).length;
  return count >= (condition.min ?? 1) && count <= (condition.max ?? Infinity);
}

/** An archetype's ancestors' ids (not its own), nearest first; cycles are cut. */
export function ancestorsOf(id: string, byId: Map<string, ArchetypeDefinition>): string[] {
  const seen = new Set<string>([id]);
  const order: string[] = [];
  const queue = [...(byId.get(id)?.parents ?? [])];
  while (queue.length) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    order.push(next);
    queue.push(...(byId.get(next)?.parents ?? []));
  }
  return order;
}

/** Its own `requires` plus every ancestor's, each condition once. */
export function effectiveRequires(
  definition: ArchetypeDefinition,
  byId: Map<string, ArchetypeDefinition>,
): TeamCondition[] {
  const all = [
    definition,
    ...ancestorsOf(definition.id, byId).flatMap((id) => byId.get(id) ?? []),
  ].flatMap((d) => d.requires);
  const unique = new Map(all.map((condition) => [JSON.stringify(condition), condition]));
  return [...unique.values()];
}

/**
 * The team's archetype as people say it: the primary plus one more engine —
 * its speed mode ("Sun + Tail/room"), or, when the primary is the speed
 * mode, its next tag ("Tailwind + Hard setup"). No match is "Balance".
 */
export function classificationLabel(
  result: TeamClassification,
  set: ArchetypeSet,
  balanceName = "Balance",
): string {
  const name = (id: string) => set.archetypes.find((a) => a.id === id)?.name ?? id;
  if (!result.primary) return balanceName;
  const second =
    result.speedMode && result.speedMode !== result.primary ? result.speedMode : result.tags[0];
  return second ? `${name(result.primary)} + ${name(second)}` : name(result.primary);
}

/** An archetype's tempo, or its nearest ancestor's; undefined = no fixed tempo. */
export function archetypeTempo(id: string, set: ArchetypeSet): Tempo | undefined {
  const byId = new Map(set.archetypes.map((a) => [a.id, a]));
  for (const candidate of [id, ...ancestorsOf(id, byId)]) {
    const tempo = byId.get(candidate)?.tempo;
    if (tempo) return tempo;
  }
  return undefined;
}

export function activeArchetypes(set: ArchetypeSet, regulation?: string): ArchetypeDefinition[] {
  return set.archetypes.filter(
    (a) =>
      a.status === "active" &&
      (!a.regulations || !regulation || a.regulations.includes(regulation)),
  );
}

export function classifyTeam(
  team: ParsedPokemon[],
  set: ArchetypeSet,
  regulation?: string,
): TeamClassification {
  const facts = team.map(pokemonFacts);
  const roles = facts.map((f) => rolesOf(f, set.roles));
  const context: TeamContext = { facts, roles };
  const archetypes = activeArchetypes(set, regulation);
  const byId = new Map(set.archetypes.map((a) => [a.id, a]));

  const matches: (ArchetypeMatch & { order: number })[] = [];
  archetypes.forEach((definition, order) => {
    const requires = effectiveRequires(definition, byId);
    if (!requires.every((condition) => conditionPasses(condition, context))) return;
    if ((definition.excludes ?? []).some((condition) => conditionPasses(condition, context))) {
      return;
    }
    const boost = (definition.boosts ?? [])
      .filter((b) => conditionPasses(b.condition, context))
      .reduce((sum, b) => sum + b.weight, 0);
    matches.push({
      id: definition.id,
      specificity: requires.length,
      boost,
      priority: definition.priority,
      order,
    });
  });

  matches.sort(
    (a, b) =>
      b.priority - a.priority ||
      b.specificity - a.specificity ||
      b.boost - a.boost ||
      a.order - b.order,
  );

  // A match that another match refines (Sun, when Sun · Fire spam matched) adds nothing.
  const refined = new Set(matches.flatMap((m) => ancestorsOf(m.id, byId)));
  const leaves = matches.filter((m) => !refined.has(m.id));

  // One archetype per family: a Double weather team that also matches Sun · Chlorophyll
  // and Rain · Screens is Double weather, with those as pieces of it.
  const families = new Set<string>();
  const kept: string[] = [];
  const folded: string[] = [];
  for (const { id } of leaves) {
    const family = byId.get(id)!.family;
    if (families.has(family)) folded.push(id);
    else {
      families.add(family);
      kept.push(id);
    }
  }

  return {
    primary: kept[0] ?? null,
    tags: kept.slice(1),
    folded,
    speedMode: kept.find((id) => byId.get(id)!.family === "speedControl") ?? null,
    matches: matches.map(({ id, specificity, boost, priority }) => ({
      id,
      specificity,
      boost,
      priority,
    })),
    roles,
  };
}
