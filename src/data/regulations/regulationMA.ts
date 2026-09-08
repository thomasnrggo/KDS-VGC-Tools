/**
 * Regulation M-A (Pokémon Champions, 2026-04-08 to 2026-06-17 UTC) legality
 * data — a now-historical regulation, kept for reference/theorycrafting
 * against past-season opponent data rather than as the app's active ruleset
 * (M-B, still `REGULATIONS[0]`, is current).
 *
 * CORRECTION (2026-08-22): the first version of this file shipped two real
 * errors, caught by a user who actually played M-A: it re-exported M-B's
 * item list unchanged (Life Orb was banned in M-A, only legalized in M-B —
 * confirmed via multiple independent sources), and it included Raichu in
 * the Mega Stone map (Mega Raichu was likewise a M-B addition — metavgc.com's
 * M-B changelog explicitly lists "Raichunite X/Y" among M-B's newly-added
 * stones, and Bulbapedia's own dedicated "Mega Evolutions" list for M-A
 * — distinct from its general "Eligible Pokémon" list — doesn't include
 * Raichu either). Both are fixed below. Both mistakes had the same root
 * cause: assuming "unchanged since I found no evidence otherwise" instead
 * of positively confirming — worth remembering next time a regulation's
 * item/mega list is assumed identical to a sibling regulation's.
 *
 * Species list: https://bulbapedia.bulbagarden.net/wiki/Regulation_Set_M-A
 * ("Eligible Pokémon" section, 213 entries — independently re-fetched and
 * cross-checked twice). Verified to be an EXACT subset of Regulation M-B's
 * 235-entry list (see regulationMB.ts) — every one of M-A's species already
 * appears there with an already-verified species.json key, and M-A adds
 * nothing M-B doesn't have. The 22 species M-B added that M-A didn't have:
 * Vileplume, Qwilfish, Sceptile, Blaziken, Swampert, Mawile, Metagross,
 * Staraptor, Musharna, Scolipede, Scrafty, Eelektross, Pyroar, Malamar,
 * Barbaracle, Dragalge, Grimmsnarl, Falinks, Overqwil, Houndstone,
 * Annihilape, Gholdengo. Given that clean subset relationship, this list is
 * REGULATION_M_B_SPECIES_KEYS with exactly those 22 filtered out, rather
 * than re-resolved from scratch — lower transcription risk than hand-typing
 * 213 keys independently, and regulationMA.test.ts still verifies every key
 * resolves/round-trips on its own. (Some third-party sources cite "186
 * Pokémon" for M-A — that's a unique-Pokédex-number count, a coarser
 * grouping than this list's 213 individually-selectable forms; e.g. Raichu
 * and Raichu-Alola share a dex number but are two separate entries here,
 * same convention M-B's own 235-entry list already uses.)
 *
 * Held items and Berries: Life Orb was banned in M-A and only legalized
 * starting M-B (confirmed via web search — multiple independent sources
 * agree; no single page enumerates a complete M-A banlist, so this is the
 * one confirmed difference, not a from-scratch M-A item list). Modeled as
 * M-B's held items with Life Orb filtered out, rather than duplicating the
 * other 44 items — if another genuine M-A/M-B item difference surfaces,
 * add it to the filter rather than re-deriving the whole list.
 *
 * Mega Stones: REGULATION_M_A_MEGA_STONE_SPECIES is
 * REGULATION_M_B_MEGA_STONE_SPECIES filtered to species still in M-A's
 * list, MINUS Raichu's two stones (Mega Raichu was a M-B addition — see the
 * CORRECTION note above), giving 59 stones covering 58 species. Sources
 * disagree on the exact total: Bulbapedia's own M-A page and a couple of
 * secondary sites cite "59 species capable of Mega Evolution," which is one
 * higher than this file's 58 — that other "59" figure isn't from an
 * enumerated list (only a bare count), so it can't be reconciled against
 * this file's species-by-species derivation, and no enumerated list this
 * file's derivation disagrees with was found. Treated as a likely rounding/
 * citation mismatch between secondary sources rather than acted on, but
 * flagged here rather than silently assumed resolved — correct this map if
 * a real per-mega M-A source ever turns up and disagrees with it.
 */
import { REGULATION_M_B_HELD_ITEMS, REGULATION_M_B_BERRIES } from "./regulationMB";

export const REGULATION_M_A_SPECIES_KEYS: string[] = [
  "venusaur", "charizard", "blastoise", "beedrill", "pidgeot", "arbok",
  "pikachu", "raichu", "raichu-alola", "clefable", "ninetales", "ninetales-alola",
  "arcanine", "arcanine-hisui", "alakazam", "machamp", "victreebel", "slowbro",
  "slowbro-galar", "gengar", "kangaskhan", "starmie", "pinsir", "tauros",
  "tauros-paldea-combat-breed", "tauros-paldea-blaze-breed", "tauros-paldea-aqua-breed", "gyarados", "ditto", "vaporeon",
  "jolteon", "flareon", "aerodactyl", "snorlax", "dragonite", "meganium",
  "typhlosion", "typhlosion-hisui", "feraligatr", "ariados", "ampharos", "azumarill",
  "politoed", "espeon", "umbreon", "slowking", "slowking-galar", "forretress",
  "steelix", "scizor", "heracross", "skarmory", "houndoom", "tyranitar",
  "pelipper", "gardevoir", "sableye", "aggron", "medicham", "manectric",
  "sharpedo", "camerupt", "torkoal", "altaria", "milotic", "castform",
  "banette", "chimecho", "absol", "glalie", "torterra", "infernape",
  "empoleon", "luxray", "roserade", "rampardos", "bastiodon", "lopunny",
  "spiritomb", "garchomp", "lucario", "hippowdon", "toxicroak", "abomasnow",
  "weavile", "rhyperior", "leafeon", "glaceon", "gliscor", "mamoswine",
  "gallade", "froslass", "rotom", "rotom-heat", "rotom-wash", "rotom-frost",
  "rotom-fan", "rotom-mow", "serperior", "emboar", "samurott", "samurott-hisui",
  "watchog", "liepard", "simisage", "simisear", "simipour", "excadrill",
  "audino", "conkeldurr", "whimsicott", "krookodile", "cofagrigus", "garbodor",
  "zoroark", "zoroark-hisui", "reuniclus", "vanilluxe", "emolga", "chandelure",
  "beartic", "stunfisk", "stunfisk-galar", "golurk", "hydreigon", "volcarona",
  "chesnaught", "delphox", "greninja", "diggersby", "talonflame", "vivillon",
  "floette", "florges", "pangoro", "furfrou", "meowstic", "meowstic-female",
  "aegislash", "aromatisse", "slurpuff", "clawitzer", "heliolisk", "tyrantrum",
  "aurorus", "sylveon", "hawlucha", "dedenne", "goodra", "goodra-hisui",
  "klefki", "trevenant", "gourgeist", "gourgeist-small", "gourgeist-large", "gourgeist-super",
  "avalugg", "avalugg-hisui", "noivern", "decidueye", "decidueye-hisui", "incineroar",
  "primarina", "toucannon", "crabominable", "lycanroc", "lycanroc-midnight", "lycanroc-dusk",
  "toxapex", "mudsdale", "araquanid", "salazzle", "tsareena", "oranguru",
  "passimian", "mimikyu", "drampa", "kommo-o", "corviknight", "flapple",
  "appletun", "sandaconda", "polteageist", "hatterene", "mr-rime", "runerigus",
  "alcremie", "morpeko", "dragapult", "wyrdeer", "kleavor", "basculegion",
  "basculegion-female", "sneasler", "meowscarada", "skeledirge", "quaquaval", "maushold",
  "garganacl", "armarouge", "ceruledge", "bellibolt", "scovillain", "espathra",
  "tinkaton", "palafin", "orthworm", "glimmora", "farigiraf", "kingambit",
  "sinistcha", "archaludon", "hydrapple",
];

/** M-B's held items minus Life Orb — see this file's header comment. */
export const REGULATION_M_A_HELD_ITEMS: string[] = REGULATION_M_B_HELD_ITEMS.filter(
  (item) => item !== "Life Orb",
);
export const REGULATION_M_A_BERRIES: string[] = REGULATION_M_B_BERRIES;

/** See this file's header comment — Raichu removed (its Mega was a M-B addition), otherwise M-B's map filtered to M-A-legal species. */
export const REGULATION_M_A_MEGA_STONE_SPECIES: Record<string, string> = {
  "abomasite": "abomasnow", "absolite": "absol", "aerodactylite": "aerodactyl",
  "aggronite": "aggron", "alakazite": "alakazam", "altarianite": "altaria",
  "ampharosite": "ampharos", "audinite": "audino", "banettite": "banette",
  "beedrillite": "beedrill", "blastoisinite": "blastoise", "cameruptite": "camerupt",
  "chandelurite": "chandelure", "charizardite-x": "charizard", "charizardite-y": "charizard",
  "chesnaughtite": "chesnaught", "chimechite": "chimecho", "clefablite": "clefable",
  "crabominite": "crabominable", "delphoxite": "delphox", "dragoninite": "dragonite",
  "drampanite": "drampa", "emboarite": "emboar", "excadrite": "excadrill",
  "feraligite": "feraligatr", "floettite": "floette", "froslassite": "froslass",
  "galladite": "gallade", "garchompite": "garchomp", "gardevoirite": "gardevoir",
  "gengarite": "gengar", "glalitite": "glalie", "glimmoranite": "glimmora",
  "golurkite": "golurk", "greninjite": "greninja", "gyaradosite": "gyarados",
  "hawluchanite": "hawlucha", "heracronite": "heracross", "houndoominite": "houndoom",
  "kangaskhanite": "kangaskhan", "lopunnite": "lopunny", "lucarionite": "lucario",
  "manectite": "manectric", "medichamite": "medicham", "meganiumite": "meganium",
  "meowsticite": "meowstic", "pidgeotite": "pidgeot", "pinsirite": "pinsir",
  "sablenite": "sableye",
  "scizorite": "scizor", "scovillainite": "scovillain", "sharpedonite": "sharpedo",
  "skarmorite": "skarmory", "slowbronite": "slowbro", "starminite": "starmie",
  "steelixite": "steelix", "tyranitarite": "tyranitar", "venusaurite": "venusaur",
  "victreebelite": "victreebel",
};

/** Same shape as regulationMB.ts's megaStoneDisplayName — duplicated rather than shared since both files are meant to be independently readable/regenerable. */
function megaStoneDisplayName(itemKey: string): string {
  const xyMatch = itemKey.match(/^(.+)-(x|y)$/);
  if (xyMatch) {
    const [, base, letter] = xyMatch;
    return `${base.charAt(0).toUpperCase()}${base.slice(1)} ${letter.toUpperCase()}`;
  }
  return itemKey.charAt(0).toUpperCase() + itemKey.slice(1);
}

/** The legal Mega Stone display name(s) for a given species.json key under Regulation M-A — empty if that species has no (verified) legal Mega form. */
export function megaStoneItemsForSpeciesMA(speciesKey: string): string[] {
  return Object.entries(REGULATION_M_A_MEGA_STONE_SPECIES)
    .filter(([, species]) => species === speciesKey)
    .map(([itemKey]) => megaStoneDisplayName(itemKey));
}
