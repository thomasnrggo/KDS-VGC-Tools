import speciesData from "@/data/species.json";
import { SPECIES_ALIASES } from "@/constants";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { generateId } from "@/lib/id";
import { speciesIdentity } from "@/lib/teamIdentity";
import type { ParsedPokemon, TeamCalc, TeamCalcSide } from "@/types";

const SPECIES_KEYS = new Set(Object.keys(speciesData));
// Longest species names span three words ("Tapu Koko" is two, "Mr. Mime
// Galar" style names three).
const MAX_SPECIES_WORDS = 3;

/** A Pokémon named in a calc line. */
export interface CalcSpecies {
  /** A species.json key for its sprite — the Mega form when the line says "Mega …". */
  spriteKey: string;
  /** speciesIdentity — what it's matched against rosters by. */
  identity: string;
}

export interface ParsedCalcLine {
  attacker?: CalcSpecies;
  defender?: CalcSpecies;
  /** e.g. "113.6 - 134.9%". */
  percent?: string;
  /** e.g. "guaranteed OHKO", "93.75% chance to OHKO". */
  verdict?: string;
}

function lookupKey(words: string[]): string | null {
  const key = normalizeSpeciesKey(words.join(" "));
  const resolved = SPECIES_ALIASES[key] ?? key;
  return SPECIES_KEYS.has(resolved) ? resolved : null;
}

/**
 * The first Pokémon named in `text`, matching whole words against the
 * species data — longest match first, so "Lycanroc-Dusk" isn't read as
 * plain Lycanroc. A preceding "Mega" (and a following X/Y/Z) picks the Mega
 * form's sprite: "Mega Charizard Y" → charizard-mega-y.
 */
export function findCalcSpecies(text: string): CalcSpecies | null {
  const words = text.split(/\s+/).filter(Boolean);
  for (let start = 0; start < words.length; start++) {
    for (let length = Math.min(MAX_SPECIES_WORDS, words.length - start); length >= 1; length--) {
      const key = lookupKey(words.slice(start, start + length));
      if (!key) continue;
      let spriteKey = key;
      if (words[start - 1]?.toLowerCase() === "mega") {
        const letter = words[start + length]?.toLowerCase();
        const lettered = /^[xyz]$/.test(letter ?? "") ? `${key}-mega-${letter}` : null;
        if (lettered && SPECIES_KEYS.has(lettered)) spriteKey = lettered;
        else if (SPECIES_KEYS.has(`${key}-mega`)) spriteKey = `${key}-mega`;
      }
      return { spriteKey, identity: speciesIdentity(key) };
    }
  }
  return null;
}

/**
 * The speciesIdentity a section-header line names, or null when the line is
 * anything more than a species name — "Charizard", "Mega Charizard Y" — so a
 * comment that mentions a Pokémon ("watch Kingambit") stays a comment.
 */
function sectionHeaderSpecies(line: string): string | null {
  const words = line.split(/\s+/);
  if (words[0]?.toLowerCase() === "mega") words.shift();
  if (words.length > 1 && /^[xyz]$/i.test(words[words.length - 1])) words.pop();
  if (words.length === 0 || words.length > MAX_SPECIES_WORDS) return null;
  const key = lookupKey(words);
  return key ? speciesIdentity(key) : null;
}

/** True for a Showdown-calc line ("… vs. …: …"). */
export function isCalcLine(text: string): boolean {
  return text.includes(" vs. ");
}

/** Reads the attacker, defender, % range and KO verdict out of a Showdown-calc line; any part it can't find is left undefined. */
export function parseCalcLine(text: string): ParsedCalcLine {
  const vsIndex = text.indexOf(" vs. ");
  if (vsIndex === -1) return {};
  const afterVs = text.slice(vsIndex + " vs. ".length);
  const colonIndex = afterVs.indexOf(":");
  const defenderText = colonIndex === -1 ? afterVs : afterVs.slice(0, colonIndex);
  const result = colonIndex === -1 ? "" : afterVs.slice(colonIndex + 1);

  // Showdown writes "(113.6 - 134.9%)"; a "%" after the first number too is accepted (and dropped).
  const range = result.match(/\(([\d.]+)%?\s*-\s*([\d.]+)%\)/);
  const percent = range ? `${range[1]} - ${range[2]}%` : undefined;
  const verdictIndex = result.indexOf(" -- ");
  const verdict =
    verdictIndex === -1 ? undefined : result.slice(verdictIndex + " -- ".length).trim() || undefined;

  return {
    attacker: findCalcSpecies(text.slice(0, vsIndex)) ?? undefined,
    defender: findCalcSpecies(defenderText) ?? undefined,
    percent,
    verdict,
  };
}

/** The other Pokémon in a calc — the one that isn't yours. */
export function calcThreat(calc: TeamCalc): CalcSpecies | undefined {
  const { attacker, defender } = parseCalcLine(calc.text);
  if (calc.side === "offensive") return defender;
  if (calc.side === "defensive") return attacker;
  if (attacker && attacker.identity !== calc.species) return attacker;
  return defender;
}

/** Calcs whose threat is on `roster` — the ones relevant to facing that team. */
export function calcsAgainst(calcs: TeamCalc[], roster: ParsedPokemon[]): TeamCalc[] {
  const identities = new Set(roster.map((mon) => speciesIdentity(mon.species)));
  return calcs.filter((calc) => {
    if (!isCalcLine(calc.text)) return false;
    const threat = calcThreat(calc);
    return !!threat && identities.has(threat.identity);
  });
}

export interface CalcPasteResult {
  calcs: TeamCalc[];
  /** Lines that are calcs (as opposed to free-text entries). */
  calcCount: number;
}

/**
 * Turns a pasted calc document into entries, filed per Pokémon of yours —
 * see docs/team-report.md for the format. A species name alone on a line
 * starts a section, "Offensive"/"Defensive" sets the side, URLs are
 * ignored, and any other line is kept as a free-text entry. Calc lines
 * outside any section are filed by whichever side of the calc is on
 * `roster`.
 */
export function parseCalcPaste(raw: string, roster: ParsedPokemon[]): CalcPasteResult {
  const rosterIdentities = new Set(roster.map((mon) => speciesIdentity(mon.species)));
  let section: string | null = null;
  let side: TeamCalcSide | null = null;
  const calcs: TeamCalc[] = [];
  let calcCount = 0;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^https?:\/\//i.test(line)) continue;

    const sideHeader = line.toLowerCase();
    if (sideHeader === "offensive" || sideHeader === "defensive") {
      side = sideHeader;
      continue;
    }

    if (isCalcLine(line)) {
      calcCount += 1;
      const { attacker, defender } = parseCalcLine(line);
      let species = section;
      let lineSide = side;
      if (!species) {
        if (attacker && rosterIdentities.has(attacker.identity)) species = attacker.identity;
        else if (defender && rosterIdentities.has(defender.identity)) species = defender.identity;
      }
      if (!lineSide && species) {
        if (attacker?.identity === species) lineSide = "offensive";
        else if (defender?.identity === species) lineSide = "defensive";
      }
      calcs.push({ id: generateId(), text: line, species, side: lineSide });
      continue;
    }

    const header = sectionHeaderSpecies(line);
    if (header) {
      section = header;
      side = null;
      continue;
    }

    calcs.push({ id: generateId(), text: line, species: section, side });
  }

  return { calcs, calcCount };
}
