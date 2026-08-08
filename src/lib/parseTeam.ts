export interface ParsedPokemon {
  /** Canonical Showdown species name, e.g. "Landorus-Therian" — used to resolve the sprite. */
  species: string;
  item?: string;
}

const HEADER_LINE = /^===.*===$/;
const GENDER_SUFFIX = /\s*\((M|F)\)\s*$/;
const NICKNAME_WRAPPER = /^.*\(([^()]+)\)\s*$/;

/**
 * Parses a Pokémon Showdown team export into one entry per Pokémon.
 *
 * Only the first line of each Pokémon block is read (species/item/nickname/
 * gender) — everything else (Ability, EVs, Nature, moves, ...) isn't part of
 * this app's data model yet. See PLANNING.md section 4.
 */
export function parseTeam(raw: string): ParsedPokemon[] {
  return splitIntoBlocks(raw).map(parsePokemonBlock);
}

export function parsePokemonBlock(block: string): ParsedPokemon {
  const firstLine = block
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    throw new Error("Cannot parse an empty Pokémon block");
  }

  return parseFirstLine(firstLine);
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
