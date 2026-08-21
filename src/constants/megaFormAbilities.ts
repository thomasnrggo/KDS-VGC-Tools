/**
 * Mega Evolution replaces a Pokémon's ability with a fixed one of its own —
 * e.g. base Raichu's Lightning Rod (Electric immunity) has nothing to do
 * with either of its Mega forms, which get Electric Surge (X) or No Guard
 * (Y) instead. A pasted Showdown export's `Ability:` line reflects the
 * *base* form's ability (Showdown's teambuilder doesn't let you pick a
 * separate one for the Mega form, since which one applies is fixed by the
 * game itself once it Mega Evolves) — so without this table, toggling Mega
 * on in the damage calculator would silently keep using the base ability,
 * which is wrong whenever the two differ (most of the time).
 *
 * Keyed the same way as MEGA_STONE_SUFFIX_BY_ITEM feeds candidateFormKeys —
 * `<normalized species>-<normalized form suffix>` (e.g. "raichu-mega-x") —
 * so resolveEffectiveAbility can look it up with the exact same candidate
 * keys already used for stats/typing. Only the ~55 Champions Mega roster is
 * covered (matches megaStones.ts's scope); a species/form missing here
 * either keeps its base ability by design (a handful of the newest Champions
 * Megas — Magearna, Zeraora, Tatsugiri, Baxcalibur, and the "Z" variants of
 * Absol/Garchomp/Lucario — don't override it) or just hasn't been curated
 * yet, in which case the base ability is used as a reasonable fallback.
 *
 * Sourced from NCP-VGC-Damage-Calculator's pokedex.js (MIT licensed) — see
 * PLANNING.md's Damage Calculator entry for why that project is a trusted
 * reference for this exact ruleset. Verified 2026-08-13 against a real
 * report (Mega Raichu Y incorrectly showing Lightning Rod's Electric
 * immunity).
 */
export const MEGA_FORM_ABILITY_BY_FORM_KEY: Record<string, string> = {
  "abomasnow-mega": "Snow Warning",
  "absol-mega": "Magic Bounce",
  "aerodactyl-mega": "Tough Claws",
  "aggron-mega": "Filter",
  "alakazam-mega": "Battle Bond",
  "altaria-mega": "Pixilate",
  "ampharos-mega": "Mold Breaker",
  "audino-mega": "Healer",
  "banette-mega": "Prankster",
  "barbaracle-mega": "Tough Claws",
  "beedrill-mega": "Adaptability",
  "blastoise-mega": "Mega Launcher",
  "blaziken-mega": "Speed Boost",
  "camerupt-mega": "Sheer Force",
  "chandelure-mega": "Infiltrator",
  "charizard-mega-x": "Tough Claws",
  "charizard-mega-y": "Drought",
  "chesnaught-mega": "Bulletproof",
  "chimecho-mega": "Levitate",
  "clefable-mega": "Magic Bounce",
  "crabominable-mega": "Iron Fist",
  "delphox-mega": "Levitate",
  "diancie-mega": "Magic Bounce",
  "dragalge-mega": "Regenerator",
  "dragonite-mega": "Multiscale",
  "drampa-mega": "Berserk",
  "eelektross-mega": "Eelevate",
  "emboar-mega": "Mold Breaker",
  "excadrill-mega": "Piercing Drill",
  "falinks-mega": "Defiant",
  "feraligatr-mega": "Dragonize",
  "floette-mega": "Fairy Aura",
  "froslass-mega": "Snow Warning",
  "gallade-mega": "Inner Focus",
  "garchomp-mega": "Sand Force",
  "gardevoir-mega": "Pixilate",
  "gengar-mega": "Shadow Tag",
  "glalie-mega": "Refrigerate",
  "glimmora-mega": "Adaptability",
  "golurk-mega": "Unseen Fist",
  "greninja-mega": "Protean",
  "gyarados-mega": "Mold Breaker",
  "hawlucha-mega": "No Guard",
  "heracross-mega": "Skill Link",
  "houndoom-mega": "Solar Power",
  "kangaskhan-mega": "Parental Bond",
  "latias-mega": "Levitate",
  "latios-mega": "Levitate",
  "lopunny-mega": "Scrappy",
  "lucario-mega": "Adaptability",
  "malamar-mega": "Contrary",
  "manectric-mega": "Intimidate",
  "mawile-mega": "Huge Power",
  "medicham-mega": "Pure Power",
  "meganium-mega": "Mega Sol",
  "meowstic-mega": "Trace",
  "metagross-mega": "Tough Claws",
  "mewtwo-mega-x": "Steadfast",
  "mewtwo-mega-y": "Insomnia",
  "pidgeot-mega": "No Guard",
  "pinsir-mega": "Aerilate",
  "pyroar-mega": "Fire Mane",
  "raichu-mega-x": "Electric Surge",
  "raichu-mega-y": "No Guard",
  "rayquaza-mega": "Delta Stream",
  "sableye-mega": "Magic Bounce",
  "salamence-mega": "Aerilate",
  "sceptile-mega": "Lightning Rod",
  "scizor-mega": "Technician",
  "scolipede-mega": "Shell Armor",
  "scovillain-mega": "Spicy Spray",
  "scrafty-mega": "Intimidate",
  "sharpedo-mega": "Strong Jaw",
  "skarmory-mega": "Stalwart",
  "slowbro-mega": "Shell Armor",
  "staraptor-mega": "Contrary",
  "starmie-mega": "Huge Power",
  "steelix-mega": "Sand Force",
  "swampert-mega": "Swift Swim",
  "tyranitar-mega": "Sand Stream",
  "venusaur-mega": "Thick Fat",
  "victreebel-mega": "Innards Out",
};
