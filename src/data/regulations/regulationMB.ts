/**
 * Regulation M-B (Pokémon Champions, 2026) legality data — hand-authored
 * from two sources the user pointed at directly:
 *
 * - Species list: https://bulbapedia.bulbagarden.net/wiki/Regulation_Set_M-B
 *   ("Eligible Pokémon" section, 235 entries). Each Bulbapedia display name
 *   was resolved to its exact src/data/species.json key (regional/gender/
 *   size forms all confirmed present, e.g. "Raichu (Alolan Form)" ->
 *   "raichu-alola", "Tauros (Paldean Form (Combat Breed))" ->
 *   "tauros-paldea-combat-breed", "Gourgeist (Jumbo Variety)" ->
 *   "gourgeist-super" — Bulbapedia's "Jumbo" is PokeAPI/Showdown's "Super").
 *   Mega Evolution access isn't a separate list here — it's derived the same
 *   way it already is everywhere else in this app (holding the species' own
 *   Mega Stone, see src/constants/megaStones.ts), which already covers every
 *   one of the ~73 Mega species this regulation allows.
 * - Item list: https://rotompicks.com/en/items/ (148 entries: 45 held items,
 *   75 Mega Stones, 28 Berries). Mega Stones get their own small map below
 *   (REGULATION_M_B_MEGA_STONE_SPECIES) rather than a flat list, since the
 *   item picker needs to know *which* species each stone applies to.
 *
 * regulationMB.test.ts verifies every key below actually resolves in
 * species.json/baseStats.json/speciesTypes.json and round-trips correctly
 * through normalizeSpeciesKey(formatSpeciesDisplayName(key)) — the
 * correctness net for this hand-typed list, since there's no alias-table
 * fallback in this path.
 */
export const REGULATION_M_B_SPECIES_KEYS: string[] = [
  "venusaur", "charizard", "blastoise", "beedrill", "pidgeot", "arbok",
  "pikachu", "raichu", "raichu-alola", "clefable", "ninetales", "ninetales-alola",
  "vileplume", "arcanine", "arcanine-hisui", "alakazam", "machamp", "victreebel",
  "slowbro", "slowbro-galar", "gengar", "kangaskhan", "starmie", "pinsir",
  "tauros", "tauros-paldea-combat-breed", "tauros-paldea-blaze-breed", "tauros-paldea-aqua-breed", "gyarados", "ditto",
  "vaporeon", "jolteon", "flareon", "aerodactyl", "snorlax", "dragonite",
  "meganium", "typhlosion", "typhlosion-hisui", "feraligatr", "ariados", "ampharos",
  "azumarill", "politoed", "espeon", "umbreon", "slowking", "slowking-galar",
  "forretress", "steelix", "qwilfish", "scizor", "heracross", "skarmory",
  "houndoom", "tyranitar", "sceptile", "blaziken", "swampert", "pelipper",
  "gardevoir", "sableye", "mawile", "aggron", "medicham", "manectric",
  "sharpedo", "camerupt", "torkoal", "altaria", "milotic", "castform",
  "banette", "chimecho", "absol", "glalie", "metagross", "torterra",
  "infernape", "empoleon", "staraptor", "luxray", "roserade", "rampardos",
  "bastiodon", "lopunny", "spiritomb", "garchomp", "lucario", "hippowdon",
  "toxicroak", "abomasnow", "weavile", "rhyperior", "leafeon", "glaceon",
  "gliscor", "mamoswine", "gallade", "froslass", "rotom", "rotom-heat",
  "rotom-wash", "rotom-frost", "rotom-fan", "rotom-mow", "serperior", "emboar",
  "samurott", "samurott-hisui", "watchog", "liepard", "simisage", "simisear",
  "simipour", "musharna", "excadrill", "audino", "conkeldurr", "scolipede",
  "whimsicott", "krookodile", "scrafty", "cofagrigus", "garbodor", "zoroark",
  "zoroark-hisui", "reuniclus", "vanilluxe", "emolga", "eelektross", "chandelure",
  "beartic", "stunfisk", "stunfisk-galar", "golurk", "hydreigon", "volcarona",
  "chesnaught", "delphox", "greninja", "diggersby", "talonflame", "vivillon",
  "pyroar", "floette", "florges", "pangoro", "furfrou", "meowstic",
  "meowstic-female", "aegislash", "aromatisse", "slurpuff", "malamar", "barbaracle",
  "dragalge", "clawitzer", "heliolisk", "tyrantrum", "aurorus", "sylveon",
  "hawlucha", "dedenne", "goodra", "goodra-hisui", "klefki", "trevenant",
  "gourgeist", "gourgeist-small", "gourgeist-large", "gourgeist-super", "avalugg", "avalugg-hisui",
  "noivern", "decidueye", "decidueye-hisui", "incineroar", "primarina", "toucannon",
  "crabominable", "lycanroc", "lycanroc-midnight", "lycanroc-dusk", "toxapex", "mudsdale",
  "araquanid", "salazzle", "tsareena", "oranguru", "passimian", "mimikyu",
  "drampa", "kommo-o", "corviknight", "flapple", "appletun", "sandaconda",
  "polteageist", "hatterene", "grimmsnarl", "mr-rime", "runerigus", "alcremie",
  "falinks", "morpeko", "dragapult", "wyrdeer", "kleavor", "basculegion",
  "basculegion-female", "sneasler", "overqwil", "meowscarada", "skeledirge", "quaquaval",
  "maushold", "garganacl", "armarouge", "ceruledge", "bellibolt", "scovillain",
  "espathra", "tinkaton", "palafin", "orthworm", "glimmora", "houndstone",
  "annihilape", "farigiraf", "kingambit", "gholdengo", "sinistcha", "archaludon",
  "hydrapple",
];

/** The 45 legal held items (excludes Mega Stones and Berries, listed separately). */
export const REGULATION_M_B_HELD_ITEMS: string[] = [
  "Big Root", "Black Belt", "Black Glasses", "Bright Powder", "Charcoal",
  "Choice Scarf", "Damp Rock", "Dragon Fang", "Expert Belt", "Fairy Feather",
  "Focus Band", "Focus Sash", "Hard Stone", "Heat Rock", "Icy Rock",
  "Iron Ball", "King's Rock", "Leftovers", "Life Orb", "Light Ball",
  "Light Clay", "Magnet", "Mental Herb", "Metal Coat", "Metronome",
  "Miracle Seed", "Muscle Band", "Mystic Water", "Never-Melt Ice", "Poison Barb",
  "Quick Claw", "Scope Lens", "Sharp Beak", "Shed Shell", "Shell Bell",
  "Silk Scarf", "Silver Powder", "Smooth Rock", "Soft Sand", "Spell Tag",
  "Twisted Spoon", "White Herb", "Wide Lens", "Wise Glasses", "Zoom Lens",
];

/** The 28 legal Berries. */
export const REGULATION_M_B_BERRIES: string[] = [
  "Aspear Berry", "Babiri Berry", "Charti Berry", "Cheri Berry", "Chesto Berry",
  "Chilan Berry", "Chople Berry", "Coba Berry", "Colbur Berry", "Haban Berry",
  "Kasib Berry", "Kebia Berry", "Leppa Berry", "Lum Berry", "Occa Berry",
  "Oran Berry", "Passho Berry", "Payapa Berry", "Pecha Berry", "Persim Berry",
  "Rawst Berry", "Rindo Berry", "Roseli Berry", "Shuca Berry", "Sitrus Berry",
  "Tanga Berry", "Wacan Berry", "Yache Berry",
];

/**
 * The 75 legal Mega Stones' `MEGA_STONE_SUFFIX_BY_ITEM` keys (see
 * src/constants/megaStones.ts), mapped to the base species.json key they
 * apply to — a subset of that file's ~90 entries, since megaStones.ts
 * intentionally covers more Megas than any single regulation allows (the
 * Z-variants, Mewtwo/Latias/Latios/Salamence/Diancie/Zygarde/Golisopod/
 * Heatran/Darkrai/Magearna/Zeraora/Tatsugiri/Baxcalibur aren't in Regulation
 * M-B's 75-entry Mega Evolutions list). Hand-built from RotomPicks' item
 * descriptions (each names its species explicitly) and cross-checked
 * against megaStones.ts's own key spelling and this file's species list —
 * both checks pass with zero mismatches (regulationMB.test.ts keeps this
 * true going forward).
 */
export const REGULATION_M_B_MEGA_STONE_SPECIES: Record<string, string> = {
  "abomasite": "abomasnow", "absolite": "absol", "aerodactylite": "aerodactyl",
  "aggronite": "aggron", "alakazite": "alakazam", "altarianite": "altaria",
  "ampharosite": "ampharos", "audinite": "audino", "banettite": "banette",
  "barbaracite": "barbaracle", "beedrillite": "beedrill", "blastoisinite": "blastoise",
  "blazikenite": "blaziken", "cameruptite": "camerupt", "chandelurite": "chandelure",
  "charizardite-x": "charizard", "charizardite-y": "charizard", "chesnaughtite": "chesnaught",
  "chimechite": "chimecho", "clefablite": "clefable", "crabominite": "crabominable",
  "delphoxite": "delphox", "dragalgite": "dragalge", "dragoninite": "dragonite",
  "drampanite": "drampa", "eelektrossite": "eelektross", "emboarite": "emboar",
  "excadrite": "excadrill", "falinksite": "falinks", "feraligite": "feraligatr",
  "floettite": "floette", "froslassite": "froslass", "galladite": "gallade",
  "garchompite": "garchomp", "gardevoirite": "gardevoir", "gengarite": "gengar",
  "glalitite": "glalie", "glimmoranite": "glimmora", "golurkite": "golurk",
  "greninjite": "greninja", "gyaradosite": "gyarados", "hawluchanite": "hawlucha",
  "heracronite": "heracross", "houndoominite": "houndoom", "kangaskhanite": "kangaskhan",
  "lopunnite": "lopunny", "lucarionite": "lucario", "malamarite": "malamar",
  "manectite": "manectric", "mawilite": "mawile", "medichamite": "medicham",
  "meganiumite": "meganium", "meowsticite": "meowstic", "metagrossite": "metagross",
  "pidgeotite": "pidgeot", "pinsirite": "pinsir", "pyroarite": "pyroar",
  "raichunite-x": "raichu", "raichunite-y": "raichu", "sablenite": "sableye",
  "sceptilite": "sceptile", "scizorite": "scizor", "scolipite": "scolipede",
  "scovillainite": "scovillain", "scraftinite": "scrafty", "sharpedonite": "sharpedo",
  "skarmorite": "skarmory", "slowbronite": "slowbro", "staraptite": "staraptor",
  "starminite": "starmie", "steelixite": "steelix", "swampertite": "swampert",
  "tyranitarite": "tyranitar", "venusaurite": "venusaur", "victreebelite": "victreebel",
};

/** Every real Mega Stone name is its normalized key capitalized as one word (e.g. "sablenite" -> "Sablenite"), except the four X/Y variants which need a space + uppercase letter instead of the internal "-x"/"-y" suffix (e.g. "charizardite-x" -> "Charizardite X"). */
function megaStoneDisplayName(itemKey: string): string {
  const xyMatch = itemKey.match(/^(.+)-(x|y)$/);
  if (xyMatch) {
    const [, base, letter] = xyMatch;
    return `${base.charAt(0).toUpperCase()}${base.slice(1)} ${letter.toUpperCase()}`;
  }
  return itemKey.charAt(0).toUpperCase() + itemKey.slice(1);
}

/** The legal Mega Stone display name(s) for a given species.json key (e.g. "charizard" -> ["Charizardite X", "Charizardite Y"]) — empty if this species has no legal Mega form in Regulation M-B. */
export function megaStoneItemsForSpecies(speciesKey: string): string[] {
  return Object.entries(REGULATION_M_B_MEGA_STONE_SPECIES)
    .filter(([, species]) => species === speciesKey)
    .map(([itemKey]) => megaStoneDisplayName(itemKey));
}
