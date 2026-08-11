// One-off generator for src/data/species.json and src/data/baseStats.json — not a
// runtime dependency of the app. Pulls species/variety/form/stat data from PokeAPI's
// bulk CSV export (much cheaper than thousands of individual REST calls) and joins
// them into flat `showdown-style-slug -> { ... }` lookup tables, keyed identically
// (so a form like "charizard-mega-x" resolves consistently in both).
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

async function main() {
  const [speciesRows, pokemonRows, statsRows, pokemonStatsRows] = await Promise.all([
    fetchCsv("pokemon_species.csv").then(parseCsv),
    fetchCsv("pokemon.csv").then(parseCsv),
    fetchCsv("stats.csv").then(parseCsv),
    fetchCsv("pokemon_stats.csv").then(parseCsv),
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

  const speciesOutput = {};
  const baseStatsOutput = {};
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

  await writeFile(SPECIES_OUTPUT_PATH, JSON.stringify(sortedSpecies, null, 2) + "\n");
  await writeFile(BASE_STATS_OUTPUT_PATH, JSON.stringify(sortedBaseStats, null, 2) + "\n");

  console.log(
    `Wrote ${Object.keys(sortedSpecies).length} entries to ${path.relative(process.cwd(), SPECIES_OUTPUT_PATH)} (${skipped} rows skipped, no resolvable form)`,
  );
  console.log(
    `Wrote ${Object.keys(sortedBaseStats).length} entries to ${path.relative(process.cwd(), BASE_STATS_OUTPUT_PATH)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
