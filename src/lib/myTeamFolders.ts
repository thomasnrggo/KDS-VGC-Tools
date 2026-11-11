import { generateId } from "./id";
import type { MyTeamFolder, MyTeamFolders } from "@/types";

/**
 * Folders on the My Teams page (docs/team-folders.md): pure edits of
 * MyTeamFolders, and grouping a list of teams by them.
 */

export const EMPTY_TEAM_FOLDERS: MyTeamFolders = { folders: [], placement: {}, updatedAt: "" };

function touched(next: Omit<MyTeamFolders, "updatedAt">): MyTeamFolders {
  return { ...next, updatedAt: new Date().toISOString() };
}

export function sortedFolders(state: MyTeamFolders): MyTeamFolder[] {
  return [...state.folders].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** A new folder, last in the list. Returns the state and its id. */
export function createFolder(
  state: MyTeamFolders,
  name: string,
  id: string = generateId(),
): { state: MyTeamFolders; id: string } {
  const sortOrder = Math.max(-1, ...state.folders.map((folder) => folder.sortOrder)) + 1;
  return {
    id,
    state: touched({ ...state, folders: [...state.folders, { id, name: name.trim(), sortOrder }] }),
  };
}

export function renameFolder(state: MyTeamFolders, id: string, name: string): MyTeamFolders {
  return touched({
    ...state,
    folders: state.folders.map((folder) =>
      folder.id === id ? { ...folder, name: name.trim() } : folder,
    ),
  });
}

/** Deletes a folder; its teams become unfiled (never deleted). */
export function deleteFolder(state: MyTeamFolders, id: string): MyTeamFolders {
  return touched({
    folders: state.folders.filter((folder) => folder.id !== id),
    placement: Object.fromEntries(
      Object.entries(state.placement).filter(([, folderId]) => folderId !== id),
    ),
  });
}

/** Files a team in a folder, or (null) takes it out of any. */
export function moveTeamToFolder(
  state: MyTeamFolders,
  teamId: string,
  folderId: string | null,
): MyTeamFolders {
  const placement = { ...state.placement };
  if (folderId && state.folders.some((folder) => folder.id === folderId)) {
    placement[teamId] = folderId;
  } else {
    delete placement[teamId];
  }
  return touched({ ...state, placement });
}

/** Moves a folder one place up (-1) or down (1). */
export function moveFolder(state: MyTeamFolders, id: string, direction: -1 | 1): MyTeamFolders {
  const folders = sortedFolders(state);
  const from = folders.findIndex((folder) => folder.id === id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= folders.length) return state;
  [folders[from], folders[to]] = [folders[to], folders[from]];
  return touched({
    ...state,
    folders: folders.map((folder, sortOrder) => ({ ...folder, sortOrder })),
  });
}

/** The folder a team is in, or null (unfiled — or its folder is gone). */
export function folderOf(state: MyTeamFolders, teamId: string): string | null {
  const id = state.placement[teamId];
  return id && state.folders.some((folder) => folder.id === id) ? id : null;
}

/** `teams` (in list order) filed in `folderId` — or, null, in no folder. */
export function teamsInFolder<T extends { id: string }>(
  teams: T[],
  state: MyTeamFolders,
  folderId: string | null,
): T[] {
  return teams.filter((team) => folderOf(state, team.id) === folderId);
}
