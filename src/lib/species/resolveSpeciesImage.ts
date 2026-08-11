import speciesData from "@/data/species.json";
import { candidateFormKeys } from "./candidateFormKeys";
import { SPECIES_ALIASES } from "@/constants";
import type { ResolvedSpeciesImage } from "@/types";

interface SpeciesEntry {
  dexId: number;
  formSuffix?: string;
}

const SPECIES_DATA = speciesData as unknown as Record<string, SpeciesEntry>;

const IMAGE_BASE_URL = "/pokemon-sprites/thumbnails-compressed";

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
 * its sprite, self-hosted under public/pokemon-sprites/thumbnails-compressed
 * (originally sourced from HybridShivam/Pokemon, pre-compressed). Returns null
 * when the species/form isn't in the static lookup table — callers should
 * render a placeholder rather than a broken image, and treat it as a signal
 * that src/data/species.json or the alias table needs an entry added.
 */
export function resolveSpeciesImage(
  species: string,
  item?: string,
): ResolvedSpeciesImage | null {
  for (const key of candidateFormKeys(species, item)) {
    const entry = lookup(key);
    if (entry) return toResolvedImage(entry);
  }
  return null;
}
