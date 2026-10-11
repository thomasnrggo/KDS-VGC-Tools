// One-off generator for src/data/species.json, src/data/baseStats.json,
// src/data/speciesTypes.json, src/data/abilities.json, and
// src/data/abilityDescriptions.json — not a runtime dependency of the app.
// Pulls species/variety/form/stat/type/ability data from PokeAPI's bulk CSV
// export (much cheaper than thousands of individual REST calls) and joins
// them into flat `showdown-style-slug -> { ... }` lookup tables, keyed
// identically across the first four (so a form like "charizard-mega-x"
// resolves consistently in each).
//
// Re-run with `npm run generate:species` when new Pokemon/forms need to be added
// (e.g. a new game release). See PLANNING.md section 5 for the resolution rules
// this feeds into, including the hand-maintained alias table for the cases where
// PokeAPI's naming and Showdown's naming genuinely diverge.
//
// Ability *description* text (abilityDescriptions.json) comes from a second
// source, @pkmn/dex (Smogon/Showdown's own data layer) rather than PokeAPI,
// since it's Showdown's exact shortDesc wording the team builder's ability
// picker is meant to display — see docs/team-builder.md §3a for the
// data-source decision and coverage check (311 abilities checked, only
// Calyrex's split "As One" doesn't resolve — a known Showdown naming
// divergence, left with an empty description).

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Dex } from "@pkmn/dex";

const CSV_BASE =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPECIES_OUTPUT_PATH = path.join(__dirname, "../src/data/species.json");
const BASE_STATS_OUTPUT_PATH = path.join(__dirname, "../src/data/baseStats.json");
const SPECIES_TYPES_OUTPUT_PATH = path.join(__dirname, "../src/data/speciesTypes.json");
const ABILITIES_OUTPUT_PATH = path.join(__dirname, "../src/data/abilities.json");
const ABILITY_DESCRIPTIONS_OUTPUT_PATH = path.join(
  __dirname,
  "../src/data/abilityDescriptions.json",
);

/**
 * Mirrors src/lib/species/normalize.ts's normalizeSpeciesKey — generator
 * scripts run as plain Node ESM and can't import the app's TypeScript source
 * directly, so this (short, stable) normalization logic is duplicated here.
 * Keep in sync if that function's rules change.
 */
function normalizeKey(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'%]/g, "")
    .replace(/[\s:]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** PokeAPI's local_language_id for English, shared by every *_names.csv table. */
const ENGLISH_LANGUAGE_ID = "9";

// stats.csv identifier -> our short stat key
const STAT_KEY_BY_IDENTIFIER = {
  hp: "hp",
  attack: "atk",
  defense: "def",
  "special-attack": "spa",
  "special-defense": "spd",
  speed: "spe",
};

async function fetchCsv(filename) {
  const res = await fetch(`${CSV_BASE}/${filename}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${filename}: ${res.status}`);
  }
  return res.text();
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    header.forEach((key, i) => {
      row[key] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

function capitalizeSegments(slug) {
  return slug
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("-");
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Manual post-generation overrides for species.json's `formSuffix` — cases
 * where the naive `capitalizeSegments(formIdentifier)` value doesn't match
 * the actual sprite filename in public/pokemon-sprites/thumbnails-compressed/.
 * Meowstic's Mega Evolution has one shared, gender-neutral sprite
 * (0678-Mega.png) despite PokeAPI splitting male/female varieties into
 * separate rows (identifiers "male-mega"/"female-mega", which would
 * otherwise capitalize to "Male-Mega"/"Female-Mega") — see PLANNING.md's
 * Mega Stone section and src/constants/speciesAliases.ts's
 * meowstic-mega/meowstic-f-mega aliases, which route both genders'
 * candidate keys to these two species.json keys. Same
 * "small starting subset, grows as gaps are found" spirit as this app's
 * other hand-curated tables (see generate-move-data.mjs's
 * MANUAL_RECOIL_OVERRIDES).
 */
const FORM_SUFFIX_OVERRIDES = {
  "meowstic-male-mega": "Mega",
  "meowstic-female-mega": "Mega",
};

async function main() {
  const [
    speciesRows,
    pokemonRows,
    statsRows,
    pokemonStatsRows,
    typeRows,
    pokemonTypesRows,
    pokemonAbilitiesRows,
    abilityNameRows,
  ] = await Promise.all([
    fetchCsv("pokemon_species.csv").then(parseCsv),
    fetchCsv("pokemon.csv").then(parseCsv),
    fetchCsv("stats.csv").then(parseCsv),
    fetchCsv("pokemon_stats.csv").then(parseCsv),
    fetchCsv("types.csv").then(parseCsv),
    fetchCsv("pokemon_types.csv").then(parseCsv),
    fetchCsv("pokemon_abilities.csv").then(parseCsv),
    fetchCsv("ability_names.csv").then(parseCsv),
  ]);

  const speciesIdentifierById = new Map(
    speciesRows.map((row) => [row.id, row.identifier]),
  );

  const statKeyByStatId = new Map(
    statsRows
      .filter((row) => row.identifier in STAT_KEY_BY_IDENTIFIER)
      .map((row) => [row.id, STAT_KEY_BY_IDENTIFIER[row.identifier]]),
  );

  const baseStatsByPokemonId = new Map();
  for (const row of pokemonStatsRows) {
    const statKey = statKeyByStatId.get(row.stat_id);
    if (!statKey) continue;
    if (!baseStatsByPokemonId.has(row.pokemon_id)) {
      baseStatsByPokemonId.set(row.pokemon_id, {});
    }
    baseStatsByPokemonId.get(row.pokemon_id)[statKey] = Number(row.base_stat);
  }

  // Only the 18 standard types have rows here (ids 1-18) — non-attacking
  // bookkeeping "types" like unknown/shadow/stellar never appear in
  // pokemon_types.csv, so no explicit filtering is needed.
  const typeNameById = new Map(
    typeRows.map((row) => [row.id, capitalize(row.identifier)]),
  );
  const typesByPokemonId = new Map();
  for (const row of pokemonTypesRows) {
    const typeName = typeNameById.get(row.type_id);
    if (!typeName) continue;
    if (!typesByPokemonId.has(row.pokemon_id)) {
      typesByPokemonId.set(row.pokemon_id, []);
    }
    typesByPokemonId.get(row.pokemon_id)[Number(row.slot) - 1] = typeName;
  }

  const abilityNameById = new Map(
    abilityNameRows
      .filter((row) => row.local_language_id === ENGLISH_LANGUAGE_ID)
      .map((row) => [row.ability_id, row.name]),
  );
  // Regular abilities (slot 1/2) ordered before the Hidden Ability (is_hidden
  // = "1") regardless of slot number, since PokeAPI's slot numbering isn't
  // guaranteed to put the hidden ability last for every species.
  const abilitiesByPokemonId = new Map();
  for (const row of pokemonAbilitiesRows) {
    const name = abilityNameById.get(row.ability_id);
    if (!name) continue;
    if (!abilitiesByPokemonId.has(row.pokemon_id)) {
      abilitiesByPokemonId.set(row.pokemon_id, []);
    }
    abilitiesByPokemonId.get(row.pokemon_id).push({ name, isHidden: row.is_hidden === "1" });
  }

  const speciesOutput = {};
  const baseStatsOutput = {};
  const speciesTypesOutput = {};
  const abilitiesOutput = {};
  let skipped = 0;

  for (const row of pokemonRows) {
    const species = speciesIdentifierById.get(row.species_id);
    if (!species) {
      skipped++;
      continue;
    }

    const dexId = Number(row.species_id);

    let key;
    if (row.is_default === "1") {
      // Default variety for the species — no suffix, even if its own identifier
      // carries a form-like tail (e.g. "deoxys-normal", "landorus-incarnate").
      key = species;
      if (!(key in speciesOutput)) {
        speciesOutput[key] = { dexId };
      }
    } else {
      // Non-default varieties carry the full form chain in their own identifier
      // (e.g. "urshifu-rapid-strike-gmax"), which is more reliable than trying to
      // reconstruct it from pokemon_forms.csv's single-level form_identifier.
      const prefix = `${species}-`;
      const formIdentifier = row.identifier.startsWith(prefix)
        ? row.identifier.slice(prefix.length)
        : row.identifier;

      if (!formIdentifier) {
        skipped++;
        continue;
      }

      key = `${species}-${formIdentifier}`;
      if (!(key in speciesOutput)) {
        const formSuffix = FORM_SUFFIX_OVERRIDES[key] ?? capitalizeSegments(formIdentifier);
        speciesOutput[key] = { dexId, formSuffix };
      }
    }

    if (!(key in baseStatsOutput)) {
      const stats = baseStatsByPokemonId.get(row.id);
      if (stats && Object.keys(stats).length === 6) {
        baseStatsOutput[key] = stats;
      }
    }

    if (!(key in speciesTypesOutput)) {
      const types = typesByPokemonId.get(row.id);
      if (types && types.length > 0 && types.every(Boolean)) {
        speciesTypesOutput[key] = types;
      }
    }

    if (!(key in abilitiesOutput)) {
      const abilities = abilitiesByPokemonId.get(row.id);
      if (abilities && abilities.length > 0) {
        abilitiesOutput[key] = [
          ...abilities.filter((a) => !a.isHidden).map((a) => ({ name: a.name, isHidden: false })),
          ...abilities.filter((a) => a.isHidden).map((a) => ({ name: a.name, isHidden: true })),
        ];
      }
    }
  }

  const abilityDescriptionsOutput = {};
  for (const abilities of Object.values(abilitiesOutput)) {
    for (const { name } of abilities) {
      const key = normalizeKey(name);
      if (key in abilityDescriptionsOutput) continue;
      const dexAbility = Dex.abilities.get(name);
      abilityDescriptionsOutput[key] = {
        name,
        shortDesc: dexAbility.exists ? (dexAbility.shortDesc || dexAbility.desc || "") : "",
      };
    }
  }

  function sorted(obj) {
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((key) => [key, obj[key]]),
    );
  }

  const sortedSpecies = sorted(speciesOutput);
  const sortedBaseStats = sorted(baseStatsOutput);
  const sortedSpeciesTypes = sorted(speciesTypesOutput);
  const sortedAbilities = sorted(abilitiesOutput);
  const sortedAbilityDescriptions = sorted(abilityDescriptionsOutput);

  await writeFile(SPECIES_OUTPUT_PATH, JSON.stringify(sortedSpecies, null, 2) + "\n");
  await writeFile(BASE_STATS_OUTPUT_PATH, JSON.stringify(sortedBaseStats, null, 2) + "\n");
  await writeFile(
    SPECIES_TYPES_OUTPUT_PATH,
    JSON.stringify(sortedSpeciesTypes, null, 2) + "\n",
  );
  await writeFile(ABILITIES_OUTPUT_PATH, JSON.stringify(sortedAbilities, null, 2) + "\n");
  await writeFile(
    ABILITY_DESCRIPTIONS_OUTPUT_PATH,
    JSON.stringify(sortedAbilityDescriptions, null, 2) + "\n",
  );

  console.log(
    `Wrote ${Object.keys(sortedSpecies).length} entries to ${path.relative(process.cwd(), SPECIES_OUTPUT_PATH)} (${skipped} rows skipped, no resolvable form)`,
  );
  console.log(
    `Wrote ${Object.keys(sortedSpeciesTypes).length} entries to ${path.relative(process.cwd(), SPECIES_TYPES_OUTPUT_PATH)}`,
  );
  console.log(
    `Wrote ${Object.keys(sortedBaseStats).length} entries to ${path.relative(process.cwd(), BASE_STATS_OUTPUT_PATH)}`,
  );
  console.log(
    `Wrote ${Object.keys(sortedAbilities).length} entries to ${path.relative(process.cwd(), ABILITIES_OUTPUT_PATH)}`,
  );
  console.log(
    `Wrote ${Object.keys(sortedAbilityDescriptions).length} entries to ${path.relative(process.cwd(), ABILITY_DESCRIPTIONS_OUTPUT_PATH)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
