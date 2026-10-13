import { normalizeSpeciesKey } from "./species/normalize";
import { SPECIES_ALIASES, MEGA_STONE_SUFFIX_BY_ITEM } from "@/constants";
import type { Regulation } from "@/data/regulations";
import type { ParsedPokemon } from "@/types";

export interface RegulationLegalityIssue {
  /** Index into the checked `pokemon` array. */
  index: number;
  species: string;
  /** What's illegal — lets the UI word the message in the app's language. */
  kind: "species" | "megaStone" | "item";
  /** The held item, for the "megaStone"/"item" kinds. */
  item?: string;
  reason: string;
}

/**
 * species.json keys that exist only to give a purely cosmetic form (color/
 * pattern) an accurate sprite — regulation files intentionally register only
 * the base key for these, since every cosmetic variant is equally legal
 * wherever the base is (e.g. every Squawkabilly plumage color is legal
 * wherever "squawkabilly" is; Eternal Flower Floette — its own key only
 * because it's the one that can Mega Evolve — is legal wherever "floette"
 * is, same as any other Floette color). Not merged into SPECIES_ALIASES:
 * that table feeds sprite resolution, where these forms' distinct art is
 * exactly the point, so aliasing them there would break their sprites.
 */
const COSMETIC_FORM_LEGALITY_KEY: Record<string, string> = {
  "floette-eternal": "floette",
  "squawkabilly-blue-plumage": "squawkabilly",
  "squawkabilly-white-plumage": "squawkabilly",
  "squawkabilly-yellow-plumage": "squawkabilly",
};

/** Same species-key resolution resolveSpeciesImage/candidateFormKeys use (normalize, then fall back through SPECIES_ALIASES), further folded through COSMETIC_FORM_LEGALITY_KEY so a cosmetic-only form is checked under its base species' legality. */
function resolveSpeciesKey(species: string): string {
  const key = normalizeSpeciesKey(species);
  const canonical = SPECIES_ALIASES[key] ?? key;
  return COSMETIC_FORM_LEGALITY_KEY[canonical] ?? canonical;
}

/**
 * Checks a roster against a Regulation's legal species/items — used to
 * decide whether a team can be tagged with a regulation it wasn't built
 * under (see addRegulationTag in ./team.ts). Deliberately re-validates
 * rather than assuming a later regulation is a superset of an earlier one:
 * regulations can ban things, not just add them, so "M-C came after M-B"
 * alone never implies legality.
 *
 * A held Mega Stone is checked against `regulation.megaStoneItemsForSpecies`
 * (species-specific) rather than the flat `regulation.items` list, mirroring
 * how the rest of the app treats Mega Stones as a separate legality axis
 * from ordinary held items (see regulationMB.ts).
 */
export function getRegulationLegalityIssues(
  pokemon: ParsedPokemon[],
  regulation: Regulation,
): RegulationLegalityIssue[] {
  const legalSpecies = new Set(regulation.speciesKeys);
  const issues: RegulationLegalityIssue[] = [];

  pokemon.forEach((mon, index) => {
    const speciesKey = resolveSpeciesKey(mon.species);
    if (!legalSpecies.has(speciesKey)) {
      issues.push({
        index,
        species: mon.species,
        kind: "species",
        reason: `${mon.species} isn't legal under ${regulation.label}.`,
      });
      return;
    }

    if (!mon.item) return;

    const megaSuffix = MEGA_STONE_SUFFIX_BY_ITEM[normalizeSpeciesKey(mon.item)];
    if (megaSuffix) {
      const legalStones = regulation.megaStoneItemsForSpecies(speciesKey);
      if (!legalStones.includes(mon.item)) {
        issues.push({
          index,
          species: mon.species,
          kind: "megaStone",
          item: mon.item,
          reason: `${mon.item} isn't a legal Mega Stone for ${mon.species} under ${regulation.label}.`,
        });
      }
    } else if (!regulation.items.includes(mon.item)) {
      issues.push({
        index,
        species: mon.species,
        kind: "item",
        item: mon.item,
        reason: `${mon.item} isn't a legal held item under ${regulation.label}.`,
      });
    }
  });

  return issues;
}

/** True if every Pokémon in `pokemon` (species + held item) is legal under `regulation`. */
export function isTeamLegalUnderRegulation(
  pokemon: ParsedPokemon[],
  regulation: Regulation,
): boolean {
  return getRegulationLegalityIssues(pokemon, regulation).length === 0;
}
