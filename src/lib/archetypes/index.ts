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
