import type {
  ArchetypeSet,
  BaseStatKey,
  Check,
  ComputedCheckId,
  NatureStatKey,
  TeamCondition,
} from "./types";

/**
 * Archetype rules in plain English, for /admin/archetypes (docs/archetypes.md):
 * "2+ Trick Room attacker", "knows one of: Follow Me, Rage Powder". Admin
 * pages are English-only.
 */

const STAT_NAMES: Record<BaseStatKey, string> = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
  offense: "offense (higher attack)",
  bulk: "bulk (mean HP/Def/SpD)",
};

const NATURE_STATS: Record<NatureStatKey, string> = {
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
};

export const COMPUTED_DESCRIPTIONS: Record<ComputedCheckId, string> = {
  attacker: "an attacker (2+ damaging moves, base offense 90+)",
  fragileAttacker: "a fragile attacker (base offense 110+, bulk 85 or less)",
  spreadAttacker: "has a damaging spread move",
  fewAttacks: "one damaging move at most",
};

const list = (values: string[]) =>
  values.length === 1 ? values[0] : `one of: ${values.join(", ")}`;

export function describeCheck(check: Check): string {
  if ("species" in check) return `is ${list(check.species)}`;
  if ("ability" in check)
    return `has ${check.ability.length === 1 ? "" : "an ability "}${list(check.ability)}`;
  if ("move" in check) return `knows ${list(check.move)}`;
  if ("item" in check) return `holds ${list(check.item)}`;
  if ("baseStat" in check) {
    return Object.entries(check.baseStat)
      .map(([key, range]) => {
        const name = `base ${STAT_NAMES[key as BaseStatKey]}`;
        if (range?.min !== undefined && range?.max !== undefined) {
          return `${name} ${range.min}–${range.max}`;
        }
        return range?.min !== undefined ? `${name} ≥ ${range.min}` : `${name} ≤ ${range?.max}`;
      })
      .join(" and ");
  }
  if ("natureLowers" in check) return `nature lowers ${NATURE_STATS[check.natureLowers]}`;
  if ("natureRaises" in check) return `nature raises ${NATURE_STATS[check.natureRaises]}`;
  if ("computed" in check) return COMPUTED_DESCRIPTIONS[check.computed];
  if ("allOf" in check) return check.allOf.map(wrap).join(" and ");
  if ("anyOf" in check) return check.anyOf.map(wrap).join(" or ");
  return `not ${wrap(check.not)}`;
}

function wrap(check: Check): string {
  const text = describeCheck(check);
  return "allOf" in check || "anyOf" in check ? `(${text})` : text;
}

function count(min: number | undefined, max: number | undefined): string {
  const low = min ?? 1;
  if (max === undefined) return `${low}+`;
  if (low === 0) return `at most ${max}`;
  return low === max ? `exactly ${low}` : `${low}–${max}`;
}

export function describeCondition(condition: TeamCondition, set: ArchetypeSet): string {
  if ("allOf" in condition) {
    return condition.allOf.map((c) => wrapCondition(c, set)).join(" and ");
  }
  if ("anyOf" in condition) {
    return condition.anyOf.map((c) => wrapCondition(c, set)).join(" or ");
  }
  if ("role" in condition) {
    const role = set.roles.find((r) => r.id === condition.role);
    return `${count(condition.min, condition.max)} ${role?.name ?? `unknown role "${condition.role}"`}`;
  }
  return `${count(condition.min, condition.max)} Pokémon that ${describeCheck(condition.pokemon)}`;
}

function wrapCondition(condition: TeamCondition, set: ArchetypeSet): string {
  const text = describeCondition(condition, set);
  return "allOf" in condition || "anyOf" in condition ? `(${text})` : text;
}

/** The role ids a condition mentions, for "used by". */
export function conditionRoleIds(condition: TeamCondition): string[] {
  if ("allOf" in condition) return condition.allOf.flatMap(conditionRoleIds);
  if ("anyOf" in condition) return condition.anyOf.flatMap(conditionRoleIds);
  return "role" in condition ? [condition.role] : [];
}
