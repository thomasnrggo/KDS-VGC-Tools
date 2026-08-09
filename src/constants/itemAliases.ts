/**
 * Hand-maintained overrides for the (small number of) item names where PokeAPI's
 * sprite filename doesn't match the kebab-case slug normalizeSpeciesKey produces.
 * Add an entry here (verified against a real render) whenever resolveItemImage's
 * guess 404s for an item that should have resolved.
 */
export const ITEM_ALIASES: Record<string, string> = {};
