/**
 * Turns a src/data/species.json key (e.g. "raichu-alola", "charizard-mega-x")
 * into a Showdown-style display species name ("Raichu-Alola",
 * "Charizard-Mega-X") — the runtime counterpart of
 * scripts/generate-species-data.mjs's private capitalizeSegments, needed
 * here because the generation script itself isn't importable at runtime.
 *
 * Every species.json key was itself derived from PokeAPI's per-variety
 * identifier, which already agrees with Showdown's own regional/gender/
 * size/Mega naming — so capitalizing each hyphen segment is a lossless
 * round-trip: normalizeSpeciesKey(formatSpeciesDisplayName(key)) === key
 * always holds (verified for the Regulation M-B species list in
 * regulationMB.test.ts).
 */
export function formatSpeciesDisplayName(key: string): string {
  return key
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("-");
}
