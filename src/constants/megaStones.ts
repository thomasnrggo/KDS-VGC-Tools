import { normalizeSpeciesKey } from "@/lib/species/normalize";

/**
 * Showdown paste species names don't change when holding a Mega Stone — e.g.
 * "Metagross @ Metagrossite" stays "Metagross", with the mega form only implied
 * by the item. Maps a normalized (see normalizeSpeciesKey) item name to the
 * form suffix it implies, so resolveSpeciesImage/calculateFinalStats can prefer
 * the Mega form's sprite/stats over the base one.
 *
 * Two sections: the original ~46 Mega Stones (Gen 6/7 — X/Y and ORAS), then the
 * ones Pokémon Champions (2026) added — mostly introduced via Pokémon Legends:
 * Z-A, taking the roster to 55 Mega Evolutions. Turns out our self-hosted
 * sprite set and generated species/baseStats data (see PLANNING.md) already
 * include art and stats for every one of those 55 — this table was the only
 * missing piece, since without the right item name here, candidateFormKeys
 * never builds the "<species>-mega" candidate key to look up in the first
 * place. Verified 2026-08-10 against Bulbapedia (each has its own dedicated
 * page) and cross-checked against real pasted items from this app's own data
 * (Froslassite, Dragoninite, Staraptite, Delphoxite, Floettite, Blastoisinite
 * all matched exactly).
 *
 * One known gap: Mega Rayquaza has no held-item requirement at all in the
 * actual games (it Mega Evolves by knowing the move Dragon Ascent) — item-based
 * detection can never catch that case, and isn't attempted here.
 */
export const MEGA_STONE_SUFFIX_BY_ITEM: Record<string, string> = {
  // Generation VI/VII (X/Y, ORAS)
  venusaurite: "Mega",
  "charizardite-x": "Mega-X",
  "charizardite-y": "Mega-Y",
  blastoisinite: "Mega",
  beedrillite: "Mega",
  pidgeotite: "Mega",
  alakazite: "Mega",
  slowbronite: "Mega",
  gengarite: "Mega",
  kangaskhanite: "Mega",
  pinsirite: "Mega",
  gyaradosite: "Mega",
  aerodactylite: "Mega",
  "mewtwonite-x": "Mega-X",
  "mewtwonite-y": "Mega-Y",
  ampharosite: "Mega",
  steelixite: "Mega",
  scizorite: "Mega",
  heracronite: "Mega",
  houndoominite: "Mega",
  tyranitarite: "Mega",
  sceptilite: "Mega",
  blazikenite: "Mega",
  swampertite: "Mega",
  gardevoirite: "Mega",
  sablenite: "Mega",
  mawilite: "Mega",
  aggronite: "Mega",
  medichamite: "Mega",
  manectite: "Mega",
  sharpedonite: "Mega",
  cameruptite: "Mega",
  altarianite: "Mega",
  banettite: "Mega",
  absolite: "Mega",
  glalitite: "Mega",
  salamencite: "Mega",
  metagrossite: "Mega",
  latiasite: "Mega",
  latiosite: "Mega",
  lopunnite: "Mega",
  garchompite: "Mega",
  lucarionite: "Mega",
  abomasite: "Mega",
  galladite: "Mega",
  audinite: "Mega",
  diancite: "Mega",

  // Pokémon Champions / Pokémon Legends: Z-A additions
  "raichunite-x": "Mega-X",
  "raichunite-y": "Mega-Y",
  clefablite: "Mega",
  victreebelite: "Mega",
  starminite: "Mega",
  dragoninite: "Mega", // Dragonite
  meganiumite: "Mega",
  feraligite: "Mega", // Feraligatr
  skarmorite: "Mega", // Skarmory
  chimechite: "Mega", // Chimecho
  "absolite-z": "Mega-Z",
  staraptite: "Mega", // Staraptor
  "garchompite-z": "Mega-Z",
  "lucarionite-z": "Mega-Z",
  froslassite: "Mega",
  heatranite: "Mega",
  darkranite: "Mega",
  emboarite: "Mega",
  excadrite: "Mega", // Excadrill
  scolipite: "Mega", // Scolipede
  scraftinite: "Mega", // Scrafty
  eelektrossite: "Mega",
  chandelurite: "Mega",
  golurkite: "Mega",
  chesnaughtite: "Mega",
  delphoxite: "Mega",
  greninjite: "Mega",
  pyroarite: "Mega",
  floettite: "Mega", // Floette
  meowsticite: "Mega", // see SPECIES_ALIASES for the gendered-mega key mismatch
  malamarite: "Mega",
  barbaracite: "Mega", // Barbaracle
  dragalgite: "Mega", // Dragalge
  hawluchanite: "Mega",
  zygardite: "Mega",
  crabominite: "Mega", // Crabominable
  golisopite: "Mega", // Golisopod
  drampanite: "Mega",
  magearnite: "Mega",
  zeraorite: "Mega",
  falinksite: "Mega",
  scovillainite: "Mega",
  glimmoranite: "Mega",
  tatsugirinite: "Mega",
  baxcalibrite: "Mega",
};

/**
 * Every real Mega Stone (old and new) follows the same "<species>ite" naming
 * convention with no exceptions found so far — no ordinary held item is named
 * that way. Used to recognize a held item as *some* Mega Stone even when it's
 * not a key in MEGA_STONE_SUFFIX_BY_ITEM above — at this point that should
 * only mean a Mega Stone newer than this table's last update, not a data gap.
 */
export function isLikelyMegaStoneItem(item: string): boolean {
  return /ite$/.test(normalizeSpeciesKey(item));
}
