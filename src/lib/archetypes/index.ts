export * from "./types";
export { pokemonFacts, matchesCheck, type PokemonFacts } from "./checks";
export {
  ancestorsOf,
  archetypeTempo,
  BALANCE_KEY,
  classificationKey,
  classificationLabel,
  classificationParts,
  labelForKey,
  classifyTeam,
  conditionPasses,
  effectiveRequires,
} from "./classify";
export { validateArchetypeSet } from "./validate";
export { DEFAULT_ARCHETYPE_SET, DEFAULT_ARCHETYPES, DEFAULT_ROLES } from "./defaultArchetypes";
export {
  aggregateArchetypes,
  type ArchetypeLabelStat,
  type ArchetypeMatchup,
  type MetaArchetypes,
} from "./aggregateArchetypes";
export {
  MIN_LABEL_TEAMS,
  MIN_MATCHUP_GAMES,
  archetypeMatchups,
  archetypeTotals,
  type ArchetypeTotals,
  primaryOfKey,
  type ArchetypeMatchupReport,
  type VersusArchetype,
} from "./archetypeMatchups";
export {
  COMPUTED_DESCRIPTIONS,
  conditionRoleIds,
  describeCheck,
  describeCondition,
} from "./describe";
export {
  checkSample,
  type ArchetypeSample,
  type ConditionCheck,
  type SampleCheck,
  type SampleStatus,
} from "./samples";
