// One-off generator for src/data/items.json — not a runtime dependency of
// the app. Sources name + shortDesc for every held/battle item (Berries,
// Mega Stones, standard held items) from @pkmn/dex (Smogon/Showdown's own
// data layer), chosen over PokeAPI because it's Showdown's exact shortDesc
// wording the team builder's item picker is meant to display — see
// docs/team-builder.md §3a.
//
// Poké Balls and Z-Crystals are excluded (never held items in this app).
// Mega Stones are kept even though @pkmn/dex flags them `isNonstandard:
// "Past"` (its default generation predates the reintroduction of Mega
// Evolution) — Pokémon Champions brings Mega Evolution back and this app
// already models all 55 of its Mega Stones (see src/constants/megaStones.ts).
// PokeAPI's own item data was deliberately not used here — its items.csv
// covers every item in the games (Poké Balls, TMs, key items, mail, ...)
// with no held-item flag to filter by, and its description text
// (item_prose.csv) is generic PokeAPI wording rather than Showdown's.
//
// This is a superset of any single regulation's legal item list on purpose —
// it's a name+description lookup for whatever item is already being shown
// (via REGULATIONS[n].items or a pasted-in older/off-meta item), not the
// source of item *legality*, which stays REGULATIONS[n].items/
// megaStoneItemsForSpecies as before.
//
// Keyed by a normalizeSpeciesKey-style slug (lowercase, hyphen-delimited) to
// match how the rest of the app keys item lookups (see
// src/lib/items/resolveItemImage.ts).
//
// Re-run with `npm run generate:items` when @pkmn/dex updates with new items.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Dex } from "@pkmn/dex";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../src/data/items.json");

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

async function main() {
  const items = Dex.items
    .all()
    .filter((item) => item.exists && !item.isPokeball && !item.zMove);

  const output = {};
  for (const item of items) {
    output[normalizeKey(item.name)] = {
      name: item.name,
      shortDesc: item.shortDesc || item.desc || "",
    };
  }

  const sorted = Object.fromEntries(
    Object.keys(output)
      .sort()
      .map((key) => [key, output[key]]),
  );

  await writeFile(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + "\n");

  console.log(
    `Wrote ${Object.keys(sorted).length} entries to ${path.relative(process.cwd(), OUTPUT_PATH)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
