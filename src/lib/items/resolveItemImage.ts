import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { ITEM_ALIASES, LOCAL_ITEM_FALLBACK_IMAGES } from "@/constants";
import type { ResolvedItemImage } from "@/types";

const IMAGE_BASE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items";

/**
 * Resolves a Showdown item name (e.g. "Choice Scarf") to its PokeAPI sprite icon.
 * Unlike species, there's no static table of known items with dex ids to validate
 * against — PokeAPI's item sprite filenames are just the item's kebab-case slug, so
 * this always returns a best-guess URL (aliased where needed via ITEM_ALIASES).
 * Callers should treat a failed image load (404) as the "unresolved" case and fall
 * back to `fallbackImageUrl` (a locally-hosted image, only set for items PokeAPI
 * doesn't have art for — see localItemFallbackImages.ts) or, absent that, a
 * placeholder, the same way resolveSpeciesImage's null return is handled.
 */
export function resolveItemImage(item: string): ResolvedItemImage | null {
  const trimmed = item.trim();
  if (!trimmed) return null;

  const key = normalizeSpeciesKey(trimmed);
  const resolvedKey = ITEM_ALIASES[key] ?? key;
  const localKey = resolvedKey.replace(/-/g, "");
  const fallbackImageUrl = LOCAL_ITEM_FALLBACK_IMAGES[localKey];

  return { imageUrl: `${IMAGE_BASE_URL}/${resolvedKey}.png`, fallbackImageUrl };
}
