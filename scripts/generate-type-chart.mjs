// One-off generator for src/data/typeChart.json — not a runtime dependency of
// the app. Pulls the 18x18 type-effectiveness table from PokeAPI's bulk CSV
// export (same source/technique as generate-species-data.mjs). Static data —
// the type chart essentially never changes, so this only needs re-running if
// a future generation ever adds/changes a type matchup.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CSV_BASE =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../src/data/typeChart.json");

// The 18 standard types only — PokeAPI's types.csv also has non-attacking
// bookkeeping "types" (unknown/shadow/stellar) with no rows in
// type_efficacy.csv, so restricting to ids 1-18 (verified against the live
// export: exactly 18*18 = 324 efficacy rows, all among these ids) excludes
// them naturally without an explicit denylist.
const STANDARD_TYPE_IDS = new Set(Array.from({ length: 18 }, (_, i) => String(i + 1)));

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

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

async function main() {
  const [typeRows, efficacyRows] = await Promise.all([
    fetchCsv("types.csv").then(parseCsv),
    fetchCsv("type_efficacy.csv").then(parseCsv),
  ]);

  const typeNameById = new Map(
    typeRows
      .filter((row) => STANDARD_TYPE_IDS.has(row.id))
      .map((row) => [row.id, capitalize(row.identifier)]),
  );

  const output = {};
  for (const name of typeNameById.values()) {
    output[name] = {};
  }

  let skipped = 0;
  for (const row of efficacyRows) {
    const attackerName = typeNameById.get(row.damage_type_id);
    const defenderName = typeNameById.get(row.target_type_id);
    if (!attackerName || !defenderName) {
      skipped++;
      continue;
    }
    output[attackerName][defenderName] = Number(row.damage_factor) / 100;
  }

  const sortedOutput = Object.fromEntries(
    Object.keys(output)
      .sort()
      .map((attackerName) => [
        attackerName,
        Object.fromEntries(
          Object.keys(output[attackerName])
            .sort()
            .map((defenderName) => [defenderName, output[attackerName][defenderName]]),
        ),
      ]),
  );

  await writeFile(OUTPUT_PATH, JSON.stringify(sortedOutput, null, 2) + "\n");

  const typeCount = Object.keys(sortedOutput).length;
  const pairCount = Object.values(sortedOutput).reduce(
    (sum, row) => sum + Object.keys(row).length,
    0,
  );
  console.log(
    `Wrote ${typeCount} types (${pairCount} matchup pairs) to ${path.relative(process.cwd(), OUTPUT_PATH)} (${skipped} rows skipped, unresolvable type)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
