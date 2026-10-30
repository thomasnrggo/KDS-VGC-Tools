// One-off generator for the Team Builder's move lists — not a runtime
// dependency of the app. Reads Showdown's own data layer (@pkmn/dex, same as
// generate-calc-data.mjs) and writes src/data/learnsets.json: which of the
// app's moves (moves.json keys) each species (species.json key) can learn.
//
// A species' moves are what it learns in any generation, plus its
// pre-evolutions' (Raichu also gets Pikachu's and Pichu's, as in Showdown),
// minus moves no longer in the games (Showdown's "Past" and other
// nonstandard moves). @pkmn/dex has no Pokémon Champions movepools, so this
// is the closest stand-in; the builder can still list every move.
//
// A form without a learnset of its own (most Megas and cosmetic forms) uses
// its base species'. Megas are left out: the builder looks moves up by the
// base species, which is what a set stores.
//
// Compact on purpose (each species lists indexes into one move list) — it's
// loaded only by the builder. Re-run with `npm run generate:learnsets` after
// adding species or moves.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Dex } from "@pkmn/dex";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../src/data");

function capitalizeSegments(slug) {
  return slug
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("-");
}

/** The app's species keys spell some forms out ("basculegion-female"); Showdown abbreviates. */
const SHOWDOWN_NAME_OVERRIDES = {
  "basculegion-female": "Basculegion-F",
  "basculegion-male": "Basculegion",
  "indeedee-female": "Indeedee-F",
  "indeedee-male": "Indeedee",
  "meowstic-female": "Meowstic-F",
  "meowstic-male": "Meowstic",
  "oinkologne-female": "Oinkologne-F",
  "oinkologne-male": "Oinkologne",
  "tauros-paldea-combat-breed": "Tauros-Paldea-Combat",
  "tauros-paldea-blaze-breed": "Tauros-Paldea-Blaze",
  "tauros-paldea-aqua-breed": "Tauros-Paldea-Aqua",
};

async function readJson(file) {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"));
}

/** A species' own learnset, or its base species' when it has none (a cosmetic form). */
async function ownLearnset(species) {
  const own = await Dex.learnsets.get(species.id);
  if (own?.learnset) return own.learnset;
  const base = Dex.species.get(species.changesFrom ?? species.baseSpecies);
  if (base.exists && base.id !== species.id) {
    return (await Dex.learnsets.get(base.id))?.learnset;
  }
  return undefined;
}

/** Every move id the species and its pre-evolutions learn. */
async function learnableMoveIds(species) {
  const ids = new Set();
  for (let current = species; current?.exists;) {
    const learnset = await ownLearnset(current);
    for (const id of Object.keys(learnset ?? {})) ids.add(id);
    current = current.prevo ? Dex.species.get(current.prevo) : undefined;
  }
  return ids;
}

async function main() {
  const [moves, species] = await Promise.all([readJson("moves.json"), readJson("species.json")]);

  // Showdown's move ids are the app's keys without separators ("acid-spray" → "acidspray").
  const moveKeys = Object.keys(moves).sort();
  const indexByDexId = new Map();
  moveKeys.forEach((key, index) => {
    const id = key.replace(/[^a-z0-9]/g, "");
    if (!indexByDexId.has(id)) indexByDexId.set(id, index);
  });

  const learnsets = {};
  const missing = [];
  for (const key of Object.keys(species).sort()) {
    if (/-mega(-|$)/.test(key)) continue;
    const found = Dex.species.get(SHOWDOWN_NAME_OVERRIDES[key] ?? capitalizeSegments(key));
    if (!found.exists) {
      missing.push(key);
      continue;
    }
    const indexes = [];
    for (const id of await learnableMoveIds(found)) {
      const move = Dex.moves.get(id);
      if (!move.exists || move.isNonstandard) continue;
      const index = indexByDexId.get(id);
      if (index !== undefined) indexes.push(index);
    }
    if (indexes.length > 0) learnsets[key] = indexes.sort((a, b) => a - b);
    else missing.push(key);
  }

  await writeFile(
    path.join(DATA_DIR, "learnsets.json"),
    `${JSON.stringify({ moves: moveKeys, learnsets })}\n`,
  );
  console.log(
    `learnsets: ${Object.keys(learnsets).length} species, ${moveKeys.length} moves (${missing.length} species without one: ${missing.slice(0, 15).join(", ")}${missing.length > 15 ? "…" : ""})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
