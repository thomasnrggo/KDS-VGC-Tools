import movesData from "@/data/moves.json";
import { NATURE_MODIFIERS } from "@/constants";
import { megaFormSpecies } from "@/lib/species/megaForm";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { resolveBaseStats } from "@/lib/stats/calculateFinalStats";
import { speciesIdentity } from "@/lib/teamIdentity";
import type { ParsedPokemon } from "@/types";
import type { MoveData } from "@/types/damage";
import type { BaseStatKey, Check, ComputedCheckId } from "./types";

/**
 * Layer 1 of archetypes (docs/archetypes.md): what can be asked about one
 * Pokémon on a team sheet. A new kind of question is the one change to
 * archetypes that needs code — add it to `Check` (types.ts) and here.
 */

const MOVES = movesData as unknown as Record<string, MoveData>;

/** One Pokémon, reduced to slugs and numbers the checks compare against. */
export interface PokemonFacts {
  /** Its battle form: "pyroar-mega" for Pyroar holding Pyroarite. */
  form: string;
  /** Base identity, Mega dropped: "pyroar". */
  identity: string;
  ability: string | null;
  item: string | null;
  moves: Set<string>;
  stats: Record<BaseStatKey, number> | null;
  nature: string | null;
  damagingMoves: number;
  hasSpreadAttack: boolean;
}

const slug = normalizeSpeciesKey;

export function pokemonFacts(mon: ParsedPokemon): PokemonFacts {
  const battleSpecies = megaFormSpecies(mon.species, mon.item) ?? mon.species;
  const ability = resolveEffectiveAbility(mon.species, mon.item, mon.ability);
  const moves = new Set((mon.moves ?? []).filter(Boolean).map(slug));
  const damaging = [...moves].map((move) => MOVES[move]).filter((move) => move?.power);
  const base = resolveBaseStats(mon.species, mon.item);
  return {
    form: slug(battleSpecies),
    identity: speciesIdentity(mon.species),
    ability: ability ? slug(ability) : null,
    item: mon.item ? slug(mon.item) : null,
    moves,
    stats: base
      ? {
          ...base,
          offense: Math.max(base.atk, base.spa),
          bulk: (base.hp + base.def + base.spd) / 3,
        }
      : null,
    nature: mon.nature ? slug(mon.nature) : null,
    damagingMoves: damaging.length,
    hasSpreadAttack: damaging.some((move) => move.isSpread),
  };
}

const COMPUTED: Record<ComputedCheckId, (facts: PokemonFacts) => boolean> = {
  attacker: (f) => f.damagingMoves >= 2 && (f.stats?.offense ?? 0) >= 90,
  fragileAttacker: (f) => !!f.stats && f.stats.offense >= 110 && f.stats.bulk <= 85,
  spreadAttacker: (f) => f.hasSpreadAttack,
  fewAttacks: (f) => f.damagingMoves <= 1,
};

/** Checks compare slugs; definitions may be written either way ("Heat Wave" or "heat-wave"). */
function anyIn(values: string[], has: (value: string) => boolean): boolean {
  return values.some((value) => has(slug(value)));
}

export function matchesCheck(facts: PokemonFacts, check: Check): boolean {
  if ("species" in check) {
    return anyIn(check.species, (s) => s === facts.form || s === facts.identity);
  }
  if ("ability" in check) return anyIn(check.ability, (a) => a === facts.ability);
  if ("move" in check) return anyIn(check.move, (m) => facts.moves.has(m));
  if ("item" in check) return anyIn(check.item, (i) => i === facts.item);
  if ("baseStat" in check) {
    const stats = facts.stats;
    if (!stats) return false;
    return Object.entries(check.baseStat).every(([key, range]) => {
      const value = stats[key as BaseStatKey];
      return (range?.min ?? -Infinity) <= value && value <= (range?.max ?? Infinity);
    });
  }
  if ("natureLowers" in check) {
    return !!facts.nature && NATURE_MODIFIERS[facts.nature]?.decreased === check.natureLowers;
  }
  if ("natureRaises" in check) {
    return !!facts.nature && NATURE_MODIFIERS[facts.nature]?.increased === check.natureRaises;
  }
  if ("computed" in check) return COMPUTED[check.computed](facts);
  if ("allOf" in check) return check.allOf.every((inner) => matchesCheck(facts, inner));
  if ("anyOf" in check) return check.anyOf.some((inner) => matchesCheck(facts, inner));
  return !matchesCheck(facts, check.not);
}
