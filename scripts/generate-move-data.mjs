// One-off generator for src/data/moves.json — not a runtime dependency of the
// app. Pulls move data from PokeAPI's bulk CSV export (same source/technique as
// generate-species-data.mjs) and writes a flat `normalizeSpeciesKey-slug -> {
// power, type, category, name, minHits?, maxHits? }` lookup table for the
// damage calculator. Move identifiers in this CSV are already Showdown-style
// kebab-case slugs (e.g. "will-o-wisp", "u-turn"), matching exactly what
// normalizeSpeciesKey produces from a pasted move name, so no separate
// move-key normalizer is needed. minHits/maxHits (from move_meta.csv) are
// only present for multi-hit moves (e.g. Dual Wingbeat: 2/2, Bullet Seed:
// 2/5) — absent entirely for ordinary single-hit moves. `name` is the real
// English display name (from move_names.csv) — used by the move-search
// combobox instead of algorithmically title-casing the slug, which mangles
// cases like "U-turn"/"Will-O-Wisp".
//
// Re-run with `npm run generate:moves` when new moves need to be added (e.g. a
// new game release). See PLANNING.md's damage calculator section for the plan
// this feeds into.
//
// `isSpread` (from moves.csv's own target_id column) is true for moves whose
// target is "all-other-pokemon" (id 9 — e.g. Earthquake, Discharge, hits
// allies too) or "all-opponents" (id 11 — e.g. Rock Slide, Heat Wave, Water
// Spout/Eruption) — confirmed against move_targets.csv's id->name mapping,
// which is stable/well-known enough not to need fetching at generation time.
// These are the two PokeAPI target types that get the doubles ×0.75
// spread-move damage reduction whenever actually used against 2+ targets.
// Absent entirely (not `false`) for every other move, same "only present
// when true" shape as minHits/maxHits.
//
// `recoilFraction` (from move_meta.csv's `drain` column, negative = recoil)
// is the fraction of damage DEALT the attacker takes back as recoil (Take
// Down, Double-Edge, Flare Blitz, ...) — absent for every other move,
// including drain moves (positive `drain`, e.g. Giga Drain heals the
// attacker instead — a different mechanic, not modeled here) and moves with
// a flat self-cost unrelated to damage dealt (Mind Blown/Steel Beam's fixed
// 50% max HP, Struggle, Jump Kick/High Jump Kick's miss-only "crash"
// damage — none of these show up as negative `drain`, so they're already
// naturally excluded). `move_meta.csv`'s -25/-33/-50 are rounded integer
// percents, not the true in-game fractions (1/4, 1/3, 1/2) — mapped via
// DRAIN_TO_RECOIL_FRACTION to avoid that rounding error compounding through
// the damage formula. `MANUAL_RECOIL_OVERRIDES` fills confirmed gaps where a
// move has real recoil but PokeAPI's move_meta.csv has no row for it at all
// (Wave Crash, a Gen 8 move, confirmed 1/4 recoil per Bulbapedia) — same
// "small starting subset, grows as gaps are found" spirit as this app's
// other hand-curated tables (see abilityDamageModifiers.ts).

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CSV_BASE =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../src/data/moves.json");

const CATEGORY_BY_DAMAGE_CLASS_ID = {
  1: "Status",
  2: "Physical",
  3: "Special",
};

/** PokeAPI's local_language_id for English, shared by every *_names.csv table. */
const ENGLISH_LANGUAGE_ID = "9";

/** move_targets.csv ids for "all-other-pokemon" and "all-opponents" — see the file header comment on `isSpread`. */
const SPREAD_TARGET_IDS = new Set(["9", "11"]);

/** move_meta.csv's rounded integer `drain` percents -> the true in-game fraction — see the file header comment on `recoilFraction`. */
const DRAIN_TO_RECOIL_FRACTION = {
  "-25": 0.25,
  "-33": 1 / 3,
  "-50": 0.5,
};

/** Confirmed recoil moves with no move_meta.csv row at all — see the file header comment on `recoilFraction`. */
const MANUAL_RECOIL_OVERRIDES = {
  "wave-crash": 0.25,
};

async function fetchCsv(filename) {
  const res = await fetch(`${CSV_BASE}/${filename}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${filename}: ${res.status}`);
  }
  return res.text();
}

/** Splits one CSV line on commas, respecting double-quoted fields (e.g. move_names.csv's `"10,000,000 Volt Thunderbolt"`) — a plain `line.split(",")` would break that field into three columns. */
function splitCsvLine(line) {
  const cols = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cols.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cols.push(current);
  return cols;
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
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
  const [typeRows, moveRows, moveMetaRows, moveNameRows] = await Promise.all([
    fetchCsv("types.csv").then(parseCsv),
    fetchCsv("moves.csv").then(parseCsv),
    fetchCsv("move_meta.csv").then(parseCsv),
    fetchCsv("move_names.csv").then(parseCsv),
  ]);

  const typeNameById = new Map(
    typeRows.map((row) => [row.id, capitalize(row.identifier)]),
  );
  const hitsById = new Map(
    moveMetaRows
      .filter((row) => row.min_hits && row.max_hits)
      .map((row) => [row.move_id, { minHits: Number(row.min_hits), maxHits: Number(row.max_hits) }]),
  );
  const nameById = new Map(
    moveNameRows
      .filter((row) => row.local_language_id === ENGLISH_LANGUAGE_ID)
      .map((row) => [row.move_id, row.name]),
  );
  const spreadById = new Map(
    moveRows
      .filter((row) => SPREAD_TARGET_IDS.has(row.target_id))
      .map((row) => [row.id, { isSpread: true }]),
  );
  const recoilById = new Map(
    moveMetaRows
      .filter((row) => row.drain in DRAIN_TO_RECOIL_FRACTION)
      .map((row) => [row.move_id, { recoilFraction: DRAIN_TO_RECOIL_FRACTION[row.drain] }]),
  );

  const output = {};
  let skipped = 0;

  for (const row of moveRows) {
    const category = CATEGORY_BY_DAMAGE_CLASS_ID[row.damage_class_id];
    const type = typeNameById.get(row.type_id);
    if (!category || !type || !row.identifier) {
      skipped++;
      continue;
    }

    // Later CSV rows win on a duplicate identifier — none currently exist
    // (verified against the live export), but this keeps regeneration safe
    // if PokeAPI ever adds a versioned duplicate.
    output[row.identifier] = {
      power: row.power ? Number(row.power) : null,
      type,
      category,
      name: nameById.get(row.id),
      ...hitsById.get(row.id),
      ...spreadById.get(row.id),
      ...recoilById.get(row.id),
      ...(row.identifier in MANUAL_RECOIL_OVERRIDES
        ? { recoilFraction: MANUAL_RECOIL_OVERRIDES[row.identifier] }
        : {}),
    };
  }

  const sorted = Object.fromEntries(
    Object.keys(output)
      .sort()
      .map((key) => [key, output[key]]),
  );

  await writeFile(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + "\n");

  console.log(
    `Wrote ${Object.keys(sorted).length} entries to ${path.relative(process.cwd(), OUTPUT_PATH)} (${skipped} rows skipped, unresolvable type/category)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
