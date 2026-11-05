import type { LibraryTeam } from "./parseTeamLibrary";

/** Teams with the same six Pokémon and items, the newest first. */
export interface LibraryTeamGroup {
  /** The roster's key — see rosterKey. */
  key: string;
  teams: LibraryTeam[];
}

/** The team's Pokémon with their items, in any order: "Garchomp@Choice Scarf,Incineroar@Sitrus Berry,…". */
export function rosterKey(team: LibraryTeam): string {
  return team.pokemon
    .map((species, index) => `${species}@${team.items[index] ?? ""}`)
    .sort()
    .join(",");
}

/**
 * The teams grouped by roster — the same Pokémon holding the same items, in
 * any slot order — in the list's order: each group sits where its first
 * (newest, as the sheet is newest first) team was, followed by the rest.
 * These are usually different players' takes on one team, each its own
 * paste and result, so none is dropped.
 */
export function groupTeams(teams: LibraryTeam[]): LibraryTeamGroup[] {
  const groups = new Map<string, LibraryTeamGroup>();
  for (const team of teams) {
    const key = rosterKey(team);
    const group = groups.get(key);
    if (group) group.teams.push(team);
    else groups.set(key, { key, teams: [team] });
  }
  return [...groups.values()];
}
