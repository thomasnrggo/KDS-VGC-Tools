export interface ResolvedItemImage {
  imageUrl: string;
  /** Local static image to try if `imageUrl` 404s — see localItemFallbackImages.ts. */
  fallbackImageUrl?: string;
}
