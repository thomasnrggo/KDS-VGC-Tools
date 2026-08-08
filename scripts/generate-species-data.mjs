// One-off generator for src/data/species.json — not a runtime dependency of the app.
// Pulls species/variety/form data from PokeAPI's bulk CSV export (much cheaper than
// thousands of individual REST calls) and joins them into a flat
// `showdown-style-slug -> { dexId, formSuffix? }` lookup table.
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
const OUTPUT_PATH = path.join(__dirname, "../src/data/species.json");

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
  const [speciesRows, pokemonRows] = await Promise.all([
    fetchCsv("pokemon_species.csv").then(parseCsv),
    fetchCsv("pokemon.csv").then(parseCsv),
  ]);

  const speciesIdentifierById = new Map(
    speciesRows.map((row) => [row.id, row.identifier]),
  );

  const output = {};
  let skipped = 0;

  for (const row of pokemonRows) {
    const species = speciesIdentifierById.get(row.species_id);
    if (!species) {
      skipped++;
      continue;
    }

    const dexId = Number(row.species_id);

    if (row.is_default === "1") {
      // Default variety for the species — no suffix, even if its own identifier
      // carries a form-like tail (e.g. "deoxys-normal", "landorus-incarnate").
      if (!(species in output)) {
        output[species] = { dexId };
      }
      continue;
    }

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

    const key = `${species}-${formIdentifier}`;
    if (!(key in output)) {
      output[key] = { dexId, formSuffix: capitalizeSegments(formIdentifier) };
    }
  }

  const sortedOutput = Object.fromEntries(
    Object.keys(output)
      .sort()
      .map((key) => [key, output[key]]),
  );

  await writeFile(OUTPUT_PATH, JSON.stringify(sortedOutput, null, 2) + "\n");

  console.log(
    `Wrote ${Object.keys(sortedOutput).length} entries to ${path.relative(process.cwd(), OUTPUT_PATH)} (${skipped} rows skipped, no resolvable form)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
