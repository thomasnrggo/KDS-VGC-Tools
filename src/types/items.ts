export interface ResolvedItemImage {
  imageUrl: string;
  /** Local static image to try if `imageUrl` 404s — see localItemFallbackImages.ts. */
  fallbackImageUrl?: string;
}

/** One entry in src/data/items.json, keyed by normalizeSpeciesKey(name). */
export interface ItemData {
  name: string;
  /** Showdown's exact item description text (from @pkmn/dex), e.g. "Holder's Attack is 1.5x, but it can only select the first move it executes." for Choice Band. */
  shortDesc: string;
}
