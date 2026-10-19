import speciesData from "@/data/species.json";
import { MEGA_STONE_SUFFIX_BY_ITEM } from "@/constants/megaStones";
import { normalizeSpeciesKey } from "./normalize";

/**
 * A Mega form can show up in a paste two different ways: the far more common
 * "base species + Mega Stone item" (species.json's key gets the "-mega"
 * suffix implied by the item — see candidateFormKeys/megaStones.ts), or the
 * species name *itself* already naming the Mega form directly — e.g.
 * "Golisopod-Mega" or "Charizard-Mega-X" — which is what Showdown exports
 * when a team was built with the Mega pre-evolved in the teambuilder, and
 * shows up often enough in real pasted opponent sheets to matter. Matches
 * the exact suffixes megaStones.ts's MEGA_STONE_SUFFIX_BY_ITEM values
 * produce once normalized: "-mega", "-mega-x", "-mega-y", and — for the
 * Champions-only trio Absol/Garchomp/Lucario — "-mega-z".
 */
const MEGA_SUFFIX_PATTERN = /-mega(-[xyz])?$/;

/** True when `species` itself already names a Mega form, as opposed to a base species that merely holds a Mega Stone item (see candidateFormKeys for that case). */
export function speciesNamesMegaForm(species: string): boolean {
  return MEGA_SUFFIX_PATTERN.test(normalizeSpeciesKey(species));
}

/**
 * Strips a "-Mega"/"-Mega-X"/"-Mega-Y"/"-Mega-Z" suffix the species name
 * itself carries, returning the base form's name — a no-op if the species
 * doesn't name a Mega form. Operates on the original string (not the
 * normalized key) so the result stays a sensible display name; callers that
 * need the data-lookup key normalize it themselves regardless
 * (resolveSpeciesImage, calculateFinalStats).
 */
export function stripMegaSuffix(species: string): string {
  return species.replace(/-mega(-[xyz])?$/i, "");
}

/**
 * The Mega form's name the way Showdown's calc writes it — "Mega Staraptor",
 * "Mega Charizard Y" — when `item` is this species' own Mega Stone (or the
 * species already names its Mega form, "Charizard-Mega-X"); null otherwise.
 */
export function megaDisplayName(species: string, item?: string): string | null {
  const named = species.match(/^(.*)-mega(?:-([xyz]))?$/i);
  if (named) return `Mega ${named[1]}${named[2] ? ` ${named[2].toUpperCase()}` : ""}`;
  const suffix = item ? MEGA_STONE_SUFFIX_BY_ITEM[normalizeSpeciesKey(item)] : undefined;
  if (!suffix) return null;
  const formKey = `${normalizeSpeciesKey(species)}-${normalizeSpeciesKey(suffix)}`;
  if (!(formKey in speciesData)) return null;
  const letter = suffix.match(/-([XYZ])$/i)?.[1];
  return `Mega ${species}${letter ? ` ${letter.toUpperCase()}` : ""}`;
}
