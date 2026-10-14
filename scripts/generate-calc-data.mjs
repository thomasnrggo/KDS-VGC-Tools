// One-off generator for the damage calculator's extra data — not a runtime
// dependency of the app. Reads Showdown's own data layer (@pkmn/dex, same as
// generate-item-data.mjs) and writes, keyed like the app's existing data:
//
// - src/data/moveFlags.json — per move key (moves.json): the flags damage
//   depends on (contact, punch, bite, pulse, slicing, sound), whether it has
//   secondary effects (Sheer Force), recoil/crash damage (Reckless), and
//   Showdown's stat overrides (Body Press uses Defense, Psyshock targets
//   Defense, Foul Play uses the target's Attack). Moves with none are left out.
// - src/data/speciesWeights.json — per species key (species.json): weight in
//   kg, for Low Kick/Grass Knot/Heavy Slam/Heat Crash. A form @pkmn/dex
//   doesn't know falls back to its base species' weight.
//
// Kept separate from moves.json/species.json so regenerating this never
// touches the PokeAPI-derived files. Re-run with `npm run generate:calc-data`
// after adding moves or species.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Dex } from "@pkmn/dex";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../src/data");

const FLAG_NAMES = ["contact", "punch", "bite", "pulse", "slicing", "sound"];

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
};

async function readJson(file) {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"));
}

async function main() {
  const [moves, species] = await Promise.all([readJson("moves.json"), readJson("species.json")]);

  const moveFlags = {};
  let unknownMoves = 0;
  for (const [key, data] of Object.entries(moves)) {
    const move = Dex.moves.get(data.name ?? key);
    if (!move.exists) {
      unknownMoves++;
      continue;
    }
    const entry = {};
    for (const flag of FLAG_NAMES) if (move.flags[flag]) entry[flag] = true;
    if (move.secondaries?.length || move.hasSheerForce) entry.secondary = true;
    if (move.recoil || move.hasCrashDamage) entry.recoil = true;
    if (move.overrideDefensiveStat) entry.defensiveStat = move.overrideDefensiveStat;
    if (move.overrideOffensiveStat) entry.offensiveStat = move.overrideOffensiveStat;
    if (move.overrideOffensivePokemon) entry.offensivePokemon = move.overrideOffensivePokemon;
    if (Object.keys(entry).length) moveFlags[key] = entry;
  }

  const baseWeightByDex = new Map();
  for (const entry of Dex.species.all()) {
    if (entry.baseSpecies === entry.name) baseWeightByDex.set(entry.num, entry.weightkg);
  }
  const weights = {};
  let fallbacks = 0;
  for (const [key, entry] of Object.entries(species)) {
    const found = Dex.species.get(SHOWDOWN_NAME_OVERRIDES[key] ?? capitalizeSegments(key));
    if (found.exists && found.weightkg) {
      weights[key] = found.weightkg;
    } else if (baseWeightByDex.has(entry.dexId)) {
      weights[key] = baseWeightByDex.get(entry.dexId);
      fallbacks++;
    }
  }

  const sorted = (object) =>
    Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(path.join(DATA_DIR, "moveFlags.json"), `${JSON.stringify(sorted(moveFlags), null, 2)}\n`);
  await writeFile(path.join(DATA_DIR, "speciesWeights.json"), `${JSON.stringify(sorted(weights), null, 2)}\n`);
  console.log(
    `moveFlags: ${Object.keys(moveFlags).length} moves (${unknownMoves} unknown to @pkmn/dex)`,
  );
  console.log(
    `speciesWeights: ${Object.keys(weights).length}/${Object.keys(species).length} species (${fallbacks} from base species)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
