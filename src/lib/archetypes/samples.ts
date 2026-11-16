import type { ParsedPokemon } from "@/types";
import {
  ancestorsOf,
  classificationKey,
  classifyTeam,
  conditionPasses,
  teamContext,
} from "./classify";
import type { ArchetypeSet, TeamClassification, TeamCondition } from "./types";

/**
 * Sample teams (docs/archetypes.md — "Sample teams"): teams the admin adds to
 * an archetype at /admin/archetypes, stored in Firestore's
 * `archetypeSamples` (staff only). Optional — classification never uses them;
 * they check the rules: each is classified live with the current
 * definitions, and a miss says which of the archetype's conditions failed.
 */
export interface ArchetypeSample {
  id: string;
  /** The archetype it's an example of. */
  archetypeId: string;
  name: string;
  /** Showdown export text. */
  paste: string;
  note?: string;
  /** Who added it (display name) and when (ISO). */
  addedBy?: string;
  addedAt: string;
}

/**
 * - primary: the team's main archetype is this one.
 * - variant: its main archetype refines this one (a Sun sample that's Sun · Fire spam).
 * - tag: it matched, but another archetype leads (a Tailwind sample that's "Balance setup + Tailwind").
 * - miss: it didn't match.
 */
export type SampleStatus = "primary" | "variant" | "tag" | "miss";

export interface ConditionCheck {
  condition: TeamCondition;
  passed: boolean;
  /** The ancestor it's inherited from, if it isn't the archetype's own. */
  from?: string;
}

export interface SampleCheck {
  status: SampleStatus;
  classification: TeamClassification;
  /** classificationKey of what the team was classified as. */
  key: string;
  /** Each required condition (inherited ones included), passed or not. */
  requires: ConditionCheck[];
  /** Excludes that the team hit — any one of them rules the archetype out. */
  excludedBy: TeamCondition[];
}

export function checkSample(
  team: ParsedPokemon[],
  archetypeId: string,
  set: ArchetypeSet,
  regulation?: string,
): SampleCheck {
  const classification = classifyTeam(team, set, regulation);
  const byId = new Map(set.archetypes.map((a) => [a.id, a]));
  const context = teamContext(team, set);
  const definition = byId.get(archetypeId);

  const requires: ConditionCheck[] = definition
    ? [
        ...ancestorsOf(archetypeId, byId).flatMap((from) =>
          (byId.get(from)?.requires ?? []).map((condition) => ({ condition, from })),
        ),
        ...definition.requires.map((condition) => ({ condition })),
      ].map((entry) => ({ ...entry, passed: conditionPasses(entry.condition, context) }))
    : [];
  const excludedBy = (definition?.excludes ?? []).filter((condition) =>
    conditionPasses(condition, context),
  );

  const { primary } = classification;
  const status: SampleStatus =
    primary === archetypeId
      ? "primary"
      : primary && ancestorsOf(primary, byId).includes(archetypeId)
        ? "variant"
        : [...classification.tags, ...classification.folded].includes(archetypeId) ||
            classification.matches.some((m) => m.id === archetypeId)
          ? "tag"
          : "miss";

  return {
    status,
    classification,
    key: classificationKey(classification),
    requires,
    excludedBy,
  };
}
