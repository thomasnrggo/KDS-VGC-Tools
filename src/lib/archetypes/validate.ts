import { ancestorsOf } from "./classify";
import type { ArchetypeSet, TeamCondition } from "./types";

function roleIds(condition: TeamCondition): string[] {
  if ("allOf" in condition) return condition.allOf.flatMap(roleIds);
  if ("anyOf" in condition) return condition.anyOf.flatMap(roleIds);
  return "role" in condition ? [condition.role] : [];
}

/**
 * Problems that would make a set misbehave — run before saving one (the
 * admin page) and in tests over the defaults. Empty means valid.
 */
export function validateArchetypeSet(set: ArchetypeSet): string[] {
  const problems: string[] = [];
  const roles = new Set<string>();
  for (const role of set.roles) {
    if (roles.has(role.id)) problems.push(`Duplicate role "${role.id}"`);
    roles.add(role.id);
  }
  const byId = new Map(set.archetypes.map((a) => [a.id, a]));
  if (byId.size !== set.archetypes.length) problems.push("Duplicate archetype ids");

  for (const archetype of set.archetypes) {
    const conditions = [
      ...archetype.requires,
      ...(archetype.excludes ?? []),
      ...(archetype.boosts ?? []).map((b) => b.condition),
    ];
    for (const id of conditions.flatMap(roleIds)) {
      if (!roles.has(id)) problems.push(`"${archetype.id}" uses unknown role "${id}"`);
    }
    for (const parent of archetype.parents ?? []) {
      if (!byId.has(parent)) problems.push(`"${archetype.id}" has unknown parent "${parent}"`);
    }
    // A cycle shows as the archetype reaching itself through its parents.
    const reaches = (archetype.parents ?? []).some(
      (parent) => parent === archetype.id || ancestorsOf(parent, byId).includes(archetype.id),
    );
    if (reaches) problems.push(`"${archetype.id}" is its own ancestor`);
    if (!archetype.requires.length && !archetype.parents?.length) {
      problems.push(`"${archetype.id}" requires nothing, so every team would match it`);
    }
  }
  return problems;
}
