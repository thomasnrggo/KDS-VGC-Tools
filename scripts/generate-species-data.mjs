// One-off generator for src/data/species.json, src/data/baseStats.json,
// src/data/speciesTypes.json, and src/data/abilities.json — not a runtime
// dependency of the app. Pulls species/variety/form/stat/type/ability data
// from PokeAPI's bulk CSV export (much cheaper than thousands of individual
// REST calls) and joins them into flat `showdown-style-slug -> { ... }`
// lookup tables, keyed identically across all four (so a form like
// "charizard-mega-x" resolves consistently in each).
//
// Re-run with `npm run generate:species` when new Pokemon/forms need to be added
// (e.g. a new game release). See PLANNING.md section 5 for the resolution rules
// this feeds into, including the hand-maintained alias table for the cases where
// PokeAPI's naming and Showdown's naming genuinely diverge.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CSV_BASE =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPECIES_OUTPUT_PATH = path.join(__dirname, "../src/data/species.json");
const BASE_STATS_OUTPUT_PATH = path.join(__dirname, "../src/data/baseStats.json");
const SPECIES_TYPES_OUTPUT_PATH = path.join(__dirname, "../src/data/speciesTypes.json");
const ABILITIES_OUTPUT_PATH = path.join(__dirname, "../src/data/abilities.json");

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
        speciesOutput[key] = { dexId, formSuffix: capitalizeSegments(formIdentifier) };
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
          ...abilities.filter((a) => !a.isHidden).map((a) => a.name),
          ...abilities.filter((a) => a.isHidden).map((a) => a.name),
        ];
      }
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

  await writeFile(SPECIES_OUTPUT_PATH, JSON.stringify(sortedSpecies, null, 2) + "\n");
  await writeFile(BASE_STATS_OUTPUT_PATH, JSON.stringify(sortedBaseStats, null, 2) + "\n");
  await writeFile(
    SPECIES_TYPES_OUTPUT_PATH,
    JSON.stringify(sortedSpeciesTypes, null, 2) + "\n",
  );
  await writeFile(ABILITIES_OUTPUT_PATH, JSON.stringify(sortedAbilities, null, 2) + "\n");

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
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
