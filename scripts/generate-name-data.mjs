// One-off generator for src/data/names/<language>.json — not a runtime
// dependency of the app. Pulls the official localized names of Pokémon,
// moves, items, abilities, types and natures from PokeAPI's bulk CSV export
// (same source as generate-species-data.mjs) for the "Pokémon language"
// setting (see docs/localization.md).
//
// Every table is keyed exactly like the app's own English data, so a lookup
// is "normalize the English name the app already stores, read the
// translation": species by src/data/species.json key, moves by
// src/data/moves.json key, items by src/data/items.json key, abilities by
// their normalized English name, types/natures by lowercase identifier.
// Only names the app actually uses are written, to keep each file small.
//
// Abilities, moves and items are matched through PokeAPI's own English name
// rather than its identifier, since the two diverge for a handful of entries
// ("as-one-glastrier" is "As One", "minds-eye" is "Mind's Eye").
//
// Species forms: PokeAPI's Spanish form names are inconsistent — sometimes
// the full name ("Rotom Calor", "Mega-Charizard X"), sometimes only the form
// ("Forma de Alola", "Estilo Fluido"), and missing for newer forms (Mega
// Garchomp Z). A full name is kept as is; a form-only name becomes
// "Raichu (Forma de Alola)"; a missing one is composed from FORM_FALLBACKS
// (Megas follow the games' own "Mega-Charizard X" pattern). Anything the
// app doesn't find here is shown in English.
//
// Re-run with `npm run generate:names` after regenerating species/moves/items,
// or to add a language to LANGUAGES.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CSV_BASE =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../src/data");
const OUTPUT_DIR = path.join(DATA_DIR, "names");

/**
 * App language code -> PokeAPI languages.csv identifier, plus a language to
 * borrow missing names from — PokeAPI's Latin-American Spanish lacks many
 * Gen 9 items (Booster Energy, Covert Cloak, Loaded Dice), which the games
 * name the same as in Spain.
 */
const LANGUAGES = {
  es: { pokeapi: "es" },
  "es-419": { pokeapi: "es-419", fallback: "es" },
};

/** PokeAPI's identifier for English — every name is matched through it. */
const ENGLISH = "en";

/**
 * How to name a form PokeAPI has no translation for, per language — keyed
 * by the part of the species.json key after the species ("mega-z", "alola").
 * `{species}` is the translated species name. Any other Mega ("droopy-mega")
 * uses `mega`; any other form keeps its English name in parentheses
 * ("Tatsugiri (Droopy)") rather than guessing a translation.
 */
const FORM_FALLBACKS = {
  es: {
    mega: "Mega-{species}",
    "mega-x": "Mega-{species} X",
    "mega-y": "Mega-{species} Y",
    "mega-z": "Mega-{species} Z",
    origin: "{species} (Forma Origen)",
    therian: "{species} (Forma Tótem)",
    hero: "{species} (Forma Heroica)",
    "white-striped": "{species} (Forma Raya Blanca)",
    "paldea-combat-breed": "{species} (Raza Combatiente)",
    "paldea-blaze-breed": "{species} (Raza Ardiente)",
    "paldea-aqua-breed": "{species} (Raza Acuática)",
    alola: "{species} (Forma de Alola)",
    galar: "{species} (Forma de Galar)",
    hisui: "{species} (Forma de Hisui)",
    paldea: "{species} (Forma de Paldea)",
    female: "{species} (Hembra)",
  },
};
FORM_FALLBACKS["es-419"] = FORM_FALLBACKS.es;

/**
 * Mirrors src/lib/i18n/pokemonNames.ts's nameKey (normalizeSpeciesKey plus
 * curly apostrophes) — generator scripts can't import the app's TypeScript.
 */
function normalizeKey(name) {
  return name
    .replace(/’/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'%]/g, "")
    .replace(/[\s:]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchCsv(filename) {
  const res = await fetch(`${CSV_BASE}/${filename}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${filename}: ${res.status}`);
  }
  return parseCsv(await res.text());
}

/** RFC 4180 parsing — unlike the other generators' split(","), name tables quote names with commas ("10,000,000 Volt Thunderbolt"). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0]);
  return body.map((cols) =>
    Object.fromEntries(header.map((key, i) => [key, (cols[i] ?? "").trim()])),
  );
}

async function readJson(file) {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"));
}

/** `id -> { languageIdentifier: name }` from one *_names.csv table. */
function namesById(rows, idColumn, languageById, nameColumn = "name") {
  const byId = new Map();
  for (const row of rows) {
    const name = row[nameColumn];
    if (!name) continue;
    if (!byId.has(row[idColumn])) byId.set(row[idColumn], {});
    byId.get(row[idColumn])[languageById.get(row.local_language_id)] = name;
  }
  return byId;
}

/** `normalized English name -> translated name`, for the keys the app uses. */
function translateByEnglishName(byId, language, appKeys) {
  const output = {};
  for (const names of byId.values()) {
    const english = names[ENGLISH];
    const translated = names[language];
    if (!english || !translated) continue;
    const key = normalizeKey(english);
    if (appKeys.has(key) && !(key in output)) output[key] = translated;
  }
  return output;
}

function sortKeys(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const [
    languages,
    speciesNames,
    pokemon,
    pokemonForms,
    formNames,
    moveNames,
    itemNames,
    abilityNames,
    types,
    typeNames,
    natures,
    natureNames,
    speciesJson,
    movesJson,
    itemsJson,
    abilitiesJson,
  ] = await Promise.all([
    fetchCsv("languages.csv"),
    fetchCsv("pokemon_species_names.csv"),
    fetchCsv("pokemon.csv"),
    fetchCsv("pokemon_forms.csv"),
    fetchCsv("pokemon_form_names.csv"),
    fetchCsv("move_names.csv"),
    fetchCsv("item_names.csv"),
    fetchCsv("ability_names.csv"),
    fetchCsv("types.csv"),
    fetchCsv("type_names.csv"),
    fetchCsv("natures.csv"),
    fetchCsv("nature_names.csv"),
    readJson("species.json"),
    readJson("moves.json"),
    readJson("items.json"),
    readJson("abilities.json"),
  ]);

  const languageById = new Map(languages.map((row) => [row.id, row.identifier]));
  const speciesNamesById = namesById(speciesNames, "pokemon_species_id", languageById);
  const formNamesById = namesById(formNames, "pokemon_form_id", languageById, "form_name");
  const moveNamesById = namesById(moveNames, "move_id", languageById);
  const itemNamesById = namesById(itemNames, "item_id", languageById);
  const abilityNamesById = namesById(abilityNames, "ability_id", languageById);
  const typeNamesById = namesById(typeNames, "type_id", languageById);
  const natureNamesById = namesById(natureNames, "nature_id", languageById);

  const pokemonByIdentifier = new Map(pokemon.map((row) => [row.identifier, row]));
  // The form a Pokémon row is shown as (its default form).
  const defaultFormByPokemonId = new Map(
    pokemonForms.filter((row) => row.is_default === "1").map((row) => [row.pokemon_id, row]),
  );

  const abilityKeys = new Set(
    Object.values(abilitiesJson).flatMap((list) => list.map((a) => normalizeKey(a.name))),
  );

  const outputs = {};
  for (const [appLanguage, { pokeapi: language, fallback }] of Object.entries(LANGUAGES)) {
    const fallbacks = FORM_FALLBACKS[appLanguage] ?? {};
    const species = {};
    const missingForms = [];

    for (const [key, entry] of Object.entries(speciesJson)) {
      const baseName = speciesNamesById.get(String(entry.dexId))?.[language];
      if (!baseName) continue;
      const row = pokemonByIdentifier.get(key);
      if (!entry.formSuffix || row?.is_default === "1") {
        species[key] = baseName;
        continue;
      }
      const form = row && defaultFormByPokemonId.get(row.id);
      const formName = form && formNamesById.get(form.id)?.[language];
      if (formName) {
        species[key] = formName.includes(baseName) ? formName : `${baseName} (${formName})`;
        continue;
      }
      const speciesSlug = key.slice(0, key.length - entry.formSuffix.length - 1);
      const formSlug = key.slice(speciesSlug.length + 1);
      const pattern =
        fallbacks[formSlug] ?? (formSlug.endsWith("-mega") ? fallbacks.mega : undefined);
      if (pattern) {
        species[key] = pattern.replace("{species}", baseName);
      } else {
        missingForms.push(key);
        species[key] = `${baseName} (${entry.formSuffix.replace(/-/g, " ")})`;
      }
    }

    const typeIdentifierById = new Map(types.map((row) => [row.id, row.identifier]));
    const typeOutput = {};
    for (const [id, names] of typeNamesById) {
      if (names[language]) typeOutput[typeIdentifierById.get(id)] = names[language];
    }
    const natureIdentifierById = new Map(natures.map((row) => [row.id, row.identifier]));
    const natureOutput = {};
    for (const [id, names] of natureNamesById) {
      if (names[language]) natureOutput[natureIdentifierById.get(id)] = names[language];
    }

    const borrowed = fallback ? outputs[fallback] : undefined;
    const withFallback = (table, names) => sortKeys({ ...borrowed?.[table], ...names });
    const output = {
      species: withFallback("species", species),
      moves: withFallback(
        "moves",
        translateByEnglishName(moveNamesById, language, new Set(Object.keys(movesJson))),
      ),
      items: withFallback(
        "items",
        translateByEnglishName(itemNamesById, language, new Set(Object.keys(itemsJson))),
      ),
      abilities: withFallback(
        "abilities",
        translateByEnglishName(abilityNamesById, language, abilityKeys),
      ),
      types: withFallback("types", typeOutput),
      natures: withFallback("natures", natureOutput),
    };
    outputs[appLanguage] = output;

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(
      path.join(OUTPUT_DIR, `${appLanguage}.json`),
      `${JSON.stringify(output, null, 2)}\n`,
    );
    const counts = Object.entries(output)
      .map(([table, names]) => `${table} ${Object.keys(names).length}`)
      .join(", ");
    console.log(`${appLanguage}: ${counts}`);
    console.log(
      `  forms with an English form name: ${missingForms.length}${
        missingForms.length ? ` — ${missingForms.slice(0, 15).join(", ")}…` : ""
      }`,
    );
    console.log(
      `  moves ${Object.keys(movesJson).length - Object.keys(output.moves).length}, items ${
        Object.keys(itemsJson).length - Object.keys(output.items).length
      }, abilities ${abilityKeys.size - Object.keys(output.abilities).length} left in English`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
