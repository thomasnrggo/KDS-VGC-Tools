import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import type { ParsedPokemon } from "@/types";

/** Lower-cased, trimmed, inner whitespace collapsed — so "Trick  Room " and "trick room" are one tag. Returns "" for a blank input. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** `tags` plus `raw` (normalized), unless it's blank or already there. */
export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag || tags.includes(tag)) return tags;
  return [...tags, tag];
}

export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((existing) => existing !== tag);
}

/** Case-insensitive substring match of one search term against a tag list — same semantics as pokemonMatchesQuery. */
export function tagsMatchQuery(tags: string[], normalizedQuery: string): boolean {
  return tags.some((tag) => tag.includes(normalizedQuery));
}

// Effective ability (Mega-aware) → tag. Checked through
// resolveEffectiveAbility so e.g. Charizard @ Charizardite Y suggests "sun"
// even though its paste says Blaze.
const ABILITY_TAGS: Record<string, string> = {
  drizzle: "rain",
  drought: "sun",
  "sand stream": "sand",
  "snow warning": "snow",
};

// Only moves a team is *built around* — Tailwind is deliberately absent:
// it's on too many teams as a utility move to say anything about strategy.
const MOVE_TAGS: Record<string, string> = {
  "trick room": "trick room",
  "perish song": "perish",
};

const DOUBLE_WEATHER_TAG = "double weather";
const PSYSPAM_TAG = "psyspam";

const TAG_ORDER = [
  ...Object.values(ABILITY_TAGS),
  DOUBLE_WEATHER_TAG,
  PSYSPAM_TAG,
  ...Object.values(MOVE_TAGS),
];

/**
 * Strategy tags a team looks like it plays, in a fixed order (weather first,
 * then combos, then move-based) — offered to the user as suggestions, never
 * applied automatically. Excludes nothing; callers filter out tags already
 * applied.
 *
 * Combos:
 * - "double weather": setters for two or more different weathers.
 * - "psyspam": a Psychic Surge setter plus an Expanding Force user — any
 *   Pokémon on the team for each, including the same one (Indeedee with
 *   both counts).
 */
export function suggestTags(pokemon: ParsedPokemon[]): string[] {
  const found = new Set<string>();
  let hasPsychicSurge = false;
  let hasExpandingForce = false;

  for (const mon of pokemon) {
    const ability = resolveEffectiveAbility(mon.species, mon.item, mon.ability)?.toLowerCase();
    const abilityTag = ability && ABILITY_TAGS[ability];
    if (abilityTag) found.add(abilityTag);
    if (ability === "psychic surge") hasPsychicSurge = true;

    for (const move of mon.moves ?? []) {
      const normalizedMove = move.toLowerCase();
      const moveTag = MOVE_TAGS[normalizedMove];
      if (moveTag) found.add(moveTag);
      if (normalizedMove === "expanding force") hasExpandingForce = true;
    }
  }

  const weatherCount = Object.values(ABILITY_TAGS).filter((tag) => found.has(tag)).length;
  if (weatherCount >= 2) found.add(DOUBLE_WEATHER_TAG);
  if (hasPsychicSurge && hasExpandingForce) found.add(PSYSPAM_TAG);

  return TAG_ORDER.filter((tag) => found.has(tag));
}
