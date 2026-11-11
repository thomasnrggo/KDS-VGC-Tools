export interface TeamFolderEntry {
  label: string;
  rawPaste: string;
}

/** A folder on the My Teams page (docs/team-folders.md) — one level deep, like Showdown's. */
export interface MyTeamFolder {
  id: string;
  name: string;
  /** Position in the list, lowest first. */
  sortOrder: number;
}

/**
 * How you've organized your teams: your folders, and which one each team is
 * in (by team id — a team in none is "Unfiled"). Yours alone, even for a
 * collaborative team, so it lives outside the teams: this device's storage,
 * synced to `users/{uid}/meta/teamFolders`.
 */
export interface MyTeamFolders {
  folders: MyTeamFolder[];
  placement: Record<string, string>;
  updatedAt: string;
}
