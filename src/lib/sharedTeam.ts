import { hasRichText } from "./richText";
import type { ParsedPokemon, SharedTeam, Team, TeamShare } from "@/types";

/** Drops what an open team sheet doesn't reveal: Stat Points and nature. */
function toOpenSheetPokemon(pokemon: ParsedPokemon): ParsedPokemon {
  const rest = { ...pokemon };
  delete rest.evs;
  delete rest.nature;
  return rest;
}

/**
 * The public copy of a shared team's report (see SharedTeam). Only the
 * roster, the team's own details and its overview go out — never notes,
 * combinations, plans or calcs. An open sheet also drops each Pokémon's Stat Points and
 * nature, and the Poképaste link, since the paste would show them anyway.
 */
export function toSharedTeam(
  team: Team,
  share: TeamShare,
  ownerUid: string,
  now: string = new Date().toISOString(),
): SharedTeam {
  const isOpen = share.sheet === "open";
  return {
    id: team.id,
    ownerUid,
    name: team.name,
    creator: team.creator?.trim() || undefined,
    pokepasteUrl: isOpen ? undefined : team.pokepasteUrl?.trim() || undefined,
    replicaCode: team.replicaCode?.trim() || undefined,
    overview: hasRichText(team.overview) ? team.overview : undefined,
    sheet: share.sheet,
    pokemon: isOpen ? team.pokemon.map(toOpenSheetPokemon) : team.pokemon,
    updatedAt: now,
  };
}

/** The link anyone can open to see a shared team's report. */
export function sharedTeamPath(teamId: string): string {
  return `/shared/${teamId}`;
}
