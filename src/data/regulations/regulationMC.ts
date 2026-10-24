/**
 * Regulation M-C (Pokémon Champions, 2026-09-09 to 2026-12-02) legality
 * data — hand-authored from the user's own source:
 * https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-c.shtml
 * (fetched 2026-09-09; raw HTML parsed directly rather than trusted
 * secondhand — an initial AI-summarized pass of that page invented plausible
 * but wrong details, e.g. an "M-C adds ~33 species" count and "Farfetch'd/
 * Mr. Mime as regional forms," caught and discarded by reading the page's
 * own "Newly Useable Pokémon"/"Newly Added Items" tables byte-for-byte).
 *
 * Per the user: M-C is additive on top of M-B, not a from-scratch list — so
 * every export here is M-B's own export (see regulationMB.ts) plus this
 * regulation's delta, rather than a re-typed full list (same relationship
 * regulationMA.ts has to M-B, just additive instead of subtractive).
 *
 * Species: the page's "Newly Useable Pokémon" table lists 29 rows covering
 * 24 new base species.json keys (below, plus "indeedee-female") and 5 rows that are just a new
 * Mega form of a species already legal in M-B (Absol, Garchomp, Lucario —
 * see Mega Stones note) — those 5 don't add a new speciesKeys entry, since
 * this app (like M-B) grants Mega access purely through holding the right
 * Mega Stone, not a separate roster key. Two ambiguous cases resolved by
 * reading the table literally rather than guessing: Farfetch'd (icon 083,
 * Normal/Flying types) and Mr. Mime (icon 122, Psychic/Fairy types) are each
 * a single row matching their original (non-Galar) typing, so they resolve
 * to "farfetchd"/"mr-mime", not the Galar forms; Toxtricity and
 * Squawkabilly each get exactly one row with no form-specific icon suffix,
 * so only their base species.json key is added (not "toxtricity-low-key" or
 * the plumage-color variants). Indeedee's row covers both genders, which
 * differ in stats and ability, so "indeedee-female" is added alongside
 * "indeedee" (like M-A/M-B's "basculegion-female") — Persian is the one
 * species with two distinct rows (icon 053 and 053-a), so both "persian"
 * and "persian-alola" are added. regulationMC.test.ts verifies every key
 * below resolves in species.json/baseStats.json/speciesTypes.json and
 * round-trips through normalizeSpeciesKey(formatSpeciesDisplayName(key)).
 *
 * Held items: the page's "Newly Added Items" table lists exactly 12, none
 * overlapping M-B's 45 or its 28 Berries (which M-C doesn't touch). Leek
 * needed a new src/constants/itemAliases.ts entry ("leek" -> "stick") since
 * PokeAPI's sprite for this item is still filed under its old English name —
 * confirmed by curling both URLs (leek.png 404s, stick.png 200s).
 *
 * Mega Stones: REGULATION_M_C_MEGA_STONE_SPECIES is M-B's 75-item map plus 6
 * new items — 3 for the 3 wholly-new-to-M-C Mega species (Salamence,
 * Golisopod, Baxcalibur; "salamencite"/"golisopite"/"baxcalibrite", already
 * present in src/constants/megaStones.ts's MEGA_STONE_SUFFIX_BY_ITEM), and 3
 * for the "Z Mega Evolution" forms the page's own prose explicitly names
 * ("...Mega Evolutions including the Z Mega Evolutions") for 3 species
 * already legal in M-B: Absol, Garchomp, Lucario. Those 3 stones
 * ("absolite-z"/"garchompite-z"/"lucarionite-z") were likewise already in
 * megaStones.ts (added ahead of any regulation needing them, per that
 * file's own header comment), so no new stone data needed adding — only
 * this regulation's legality mapping for them. Their display names need the
 * "-z" suffix megaStoneDisplayName below doesn't share with M-B's version
 * (that one only handles "-x"/"-y"), so this file's copy extends the
 * pattern rather than reusing M-B's.
 */
import {
  REGULATION_M_B_SPECIES_KEYS,
  REGULATION_M_B_HELD_ITEMS,
  REGULATION_M_B_BERRIES,
  REGULATION_M_B_MEGA_STONE_SPECIES,
} from "./regulationMB";

/** The 24 species.json keys newly legal in M-C that weren't already in M-B — see this file's header comment for how each ambiguous case (Farfetch'd, Mr. Mime, Toxtricity, Indeedee, Squawkabilly, Persian) was resolved. */
const REGULATION_M_C_NEW_SPECIES_KEYS: string[] = [
  "wigglytuff",
  "persian",
  "persian-alola",
  "farfetchd",
  "mr-mime",
  "swalot",
  "salamence",
  "gogoat",
  "golisopod",
  "rillaboom",
  "cinderace",
  "inteleon",
  "thievul",
  "toxtricity",
  "grapploct",
  "perrserker",
  "sirfetchd",
  "pincurchin",
  "indeedee",
  "indeedee-female",
  "pawmot",
  "arboliva",
  "squawkabilly",
  "mabosstiff",
  "baxcalibur",
];

export const REGULATION_M_C_SPECIES_KEYS: string[] = [
  ...REGULATION_M_B_SPECIES_KEYS,
  ...REGULATION_M_C_NEW_SPECIES_KEYS,
];

/** The 12 held items M-C's "Newly Added Items" table lists, none overlapping M-B's 45. */
const REGULATION_M_C_NEW_HELD_ITEMS: string[] = [
  "Leek",
  "Rocky Helmet",
  "Air Balloon",
  "Red Card",
  "Binding Band",
  "Eject Button",
  "Normal Gem",
  "Terrain Extender",
  "Electric Seed",
  "Psychic Seed",
  "Misty Seed",
  "Grassy Seed",
];

export const REGULATION_M_C_HELD_ITEMS: string[] = [
  ...REGULATION_M_B_HELD_ITEMS,
  ...REGULATION_M_C_NEW_HELD_ITEMS,
];

/** M-C's own page doesn't mention any Berry changes — same 28 as M-B. */
export const REGULATION_M_C_BERRIES: string[] = REGULATION_M_B_BERRIES;

/** The 6 Mega Stone items M-C adds on top of M-B's 75 — see this file's header comment for why each is legal here (3 wholly-new Mega species, 3 "Z Mega Evolution" forms of already-legal species). */
const REGULATION_M_C_NEW_MEGA_STONE_SPECIES: Record<string, string> = {
  salamencite: "salamence",
  golisopite: "golisopod",
  baxcalibrite: "baxcalibur",
  "absolite-z": "absol",
  "garchompite-z": "garchomp",
  "lucarionite-z": "lucario",
};

export const REGULATION_M_C_MEGA_STONE_SPECIES: Record<string, string> = {
  ...REGULATION_M_B_MEGA_STONE_SPECIES,
  ...REGULATION_M_C_NEW_MEGA_STONE_SPECIES,
};

/** Same shape as regulationMB.ts's megaStoneDisplayName, extended to the "-z" suffix M-C's new "Z Mega Evolution" stones use (e.g. "absolite-z" -> "Absolite Z") — duplicated per-file rather than shared, same as regulationMA.ts's copy. */
function megaStoneDisplayName(itemKey: string): string {
  const suffixMatch = itemKey.match(/^(.+)-(x|y|z)$/);
  if (suffixMatch) {
    const [, base, letter] = suffixMatch;
    return `${base.charAt(0).toUpperCase()}${base.slice(1)} ${letter.toUpperCase()}`;
  }
  return itemKey.charAt(0).toUpperCase() + itemKey.slice(1);
}

/** The legal Mega Stone display name(s) for a given species.json key under Regulation M-C — empty if that species has no legal Mega form here. */
export function megaStoneItemsForSpeciesMC(speciesKey: string): string[] {
  return Object.entries(REGULATION_M_C_MEGA_STONE_SPECIES)
    .filter(([, species]) => species === speciesKey)
    .map(([itemKey]) => megaStoneDisplayName(itemKey));
}
