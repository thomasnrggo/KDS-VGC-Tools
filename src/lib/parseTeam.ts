import type { ParsedPokemon } from "@/types";

const HEADER_LINE = /^===.*===$/;
const GENDER_SUFFIX = /\s*\((M|F)\)\s*$/;
const NICKNAME_WRAPPER = /^.*\(([^()]+)\)\s*$/;
const ABILITY_LINE = /^Ability:\s*(.+)$/;
const EVS_LINE = /^EVs:\s*(.+)$/;
const NATURE_LINE = /^(\w+)\s+Nature$/;
const MOVE_LINE = /^-\s*(.+)$/;

/**
 * Parses a Pokémon Showdown team export into one entry per Pokémon: species,
 * item, and (when present) ability/moves/nature/EVs for display in a hover
 * card (and, for EVs/nature, for computing final stats — see
 * src/lib/stats/calculateFinalStats.ts). IVs are intentionally not parsed —
 * Pokémon Champions removed IVs entirely, every Pokémon is always 31 in every
 * stat — nor is anything else (Shiny, Tera Type, ...); see PLANNING.md §4.
 */
export function parseTeam(raw: string): ParsedPokemon[] {
  return splitIntoBlocks(raw).map(parsePokemonBlock);
}

export function parsePokemonBlock(block: string): ParsedPokemon {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const firstLine = lines[0];
  if (!firstLine) {
    throw new Error("Cannot parse an empty Pokémon block");
  }

  const parsed = parseFirstLine(firstLine);

  const moves: string[] = [];
  for (const line of lines.slice(1)) {
    const abilityMatch = line.match(ABILITY_LINE);
    if (abilityMatch) {
      parsed.ability = abilityMatch[1].trim();
      continue;
    }
    const evsMatch = line.match(EVS_LINE);
    if (evsMatch) {
      parsed.evs = evsMatch[1].trim();
      continue;
    }
    const natureMatch = line.match(NATURE_LINE);
    if (natureMatch) {
      parsed.nature = natureMatch[1].trim();
      continue;
    }
    const moveMatch = line.match(MOVE_LINE);
    if (moveMatch) {
      moves.push(moveMatch[1].trim());
    }
  }
  if (moves.length > 0) {
    parsed.moves = moves;
  }

  return parsed;
}

function splitIntoBlocks(raw: string): string[] {
  return raw
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !HEADER_LINE.test(block.split("\n")[0].trim()));
}

function parseFirstLine(line: string): ParsedPokemon {
  const atIndex = line.indexOf(" @ ");
  const namePart = atIndex === -1 ? line : line.slice(0, atIndex);
  const item = atIndex === -1 ? undefined : line.slice(atIndex + 3).trim() || undefined;

  const withoutGender = namePart.trim().replace(GENDER_SUFFIX, "");
  const nicknameMatch = withoutGender.match(NICKNAME_WRAPPER);
  const species = (nicknameMatch ? nicknameMatch[1] : withoutGender).trim();

  return item ? { species, item } : { species };
}
