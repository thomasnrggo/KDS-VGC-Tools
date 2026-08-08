import speciesData from "@/data/species.json";
import { normalizeSpeciesKey } from "./normalize";
import { SPECIES_ALIASES } from "./aliases";
import { MEGA_STONE_SUFFIX_BY_ITEM } from "./megaStones";

interface SpeciesEntry {
  dexId: number;
  formSuffix?: string;
}

const SPECIES_DATA = speciesData as unknown as Record<string, SpeciesEntry>;

const IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/HybridShivam/Pokemon/master/assets/images";

export interface ResolvedSpeciesImage {
  dexId: number;
  formSuffix?: string;
  imageUrl: string;
}

function padDexId(dexId: number): string {
  return String(dexId).padStart(4, "0");
}

function buildImageUrl(dexId: number, formSuffix?: string): string {
  const suffix = formSuffix ? `-${formSuffix}` : "";
  return `${IMAGE_BASE_URL}/${padDexId(dexId)}${suffix}.png`;
}

function lookup(key: string): SpeciesEntry | undefined {
  return SPECIES_DATA[key] ?? SPECIES_DATA[SPECIES_ALIASES[key]];
}

function toResolvedImage(entry: SpeciesEntry): ResolvedSpeciesImage {
  return {
    dexId: entry.dexId,
    formSuffix: entry.formSuffix,
    imageUrl: buildImageUrl(entry.dexId, entry.formSuffix),
  };
}

/**
 * Resolves a Showdown species name (+ optional held item, for Mega Stones) to
 * the HybridShivam/Pokemon sprite that represents it. Returns null when the
 * species/form isn't in the static lookup table — callers should render a
 * placeholder rather than a broken image, and treat it as a signal that
 * src/data/species.json or the alias table needs an entry added.
 */
export function resolveSpeciesImage(
  species: string,
  item?: string,
): ResolvedSpeciesImage | null {
  const key = normalizeSpeciesKey(species);

  if (item) {
    const megaSuffix = MEGA_STONE_SUFFIX_BY_ITEM[normalizeSpeciesKey(item)];
    if (megaSuffix) {
      const megaEntry = lookup(`${key}-${normalizeSpeciesKey(megaSuffix)}`);
      if (megaEntry) {
        return toResolvedImage(megaEntry);
      }
    }
  }

  const entry = lookup(key);
  return entry ? toResolvedImage(entry) : null;
}
