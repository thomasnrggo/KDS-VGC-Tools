import { describe, expect, it } from "vitest";
import {
  EMPTY_TEAM_FOLDERS,
  createFolder,
  deleteFolder,
  folderOf,
  moveFolder,
  moveTeamToFolder,
  renameFolder,
  sortedFolders,
  teamsInFolder,
} from "./myTeamFolders";
const team = (id: string) => ({ id });

describe("team folders", () => {
  const { state: one, id: a } = createFolder(EMPTY_TEAM_FOLDERS, " Regionals ", "a");
  const { state: two, id: b } = createFolder(one, "Ladder", "b");

  it("creates folders in order, trimmed", () => {
    expect(sortedFolders(two).map((f) => [f.id, f.name, f.sortOrder])).toEqual([
      ["a", "Regionals", 0],
      ["b", "Ladder", 1],
    ]);
  });

  it("files, moves and unfiles teams", () => {
    let state = moveTeamToFolder(two, "t1", a);
    expect(folderOf(state, "t1")).toBe("a");
    state = moveTeamToFolder(state, "t1", b);
    expect(folderOf(state, "t1")).toBe("b");
    state = moveTeamToFolder(state, "t1", null);
    expect(folderOf(state, "t1")).toBeNull();
    expect(folderOf(moveTeamToFolder(two, "t1", "missing"), "t1")).toBeNull();
  });

  it("deleting a folder unfiles its teams", () => {
    const state = deleteFolder(moveTeamToFolder(two, "t1", a), a);
    expect(state.folders.map((f) => f.id)).toEqual(["b"]);
    expect(folderOf(state, "t1")).toBeNull();
  });

  it("renames and reorders", () => {
    expect(renameFolder(two, b, "Ladder ideas").folders[1].name).toBe("Ladder ideas");
    expect(sortedFolders(moveFolder(two, b, -1)).map((f) => f.id)).toEqual(["b", "a"]);
    expect(moveFolder(two, a, -1)).toBe(two);
  });

  it("lists a folder's teams in list order, and the unfiled ones", () => {
    const state = moveTeamToFolder(moveTeamToFolder(two, "t2", b), "t3", b);
    const teams = [team("t1"), team("t2"), team("t3"), team("t4")];
    const ids = (folderId: string | null) => teamsInFolder(teams, state, folderId).map((t) => t.id);
    expect(ids(b)).toEqual(["t2", "t3"]);
    expect(ids(a)).toEqual([]);
    expect(ids(null)).toEqual(["t1", "t4"]);
  });
});
