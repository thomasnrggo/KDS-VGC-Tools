const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * Normalizes a species or item name into the lowercase, hyphen-delimited slug
 * used as keys throughout src/data/species.json and the alias/mega-stone tables.
 *
 * Handles the punctuation Pokémon names actually use: "Mr. Mime" -> "mr-mime",
 * "Tapu Koko" -> "tapu-koko", "Farfetch'd" -> "farfetchd",
 * "Zygarde-10%" -> "zygarde-10", "Flabébé" -> "flabebe".
 */
export function normalizeSpeciesKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[.'%]/g, "")
    .replace(/[\s:]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
