"use client";

import { useEffect, useRef, useState } from "react";
import { getTeamFolders, setTeamFolders, syncTeamFolders } from "@/lib/storage/db";
import {
  EMPTY_TEAM_FOLDERS,
  createFolder,
  deleteFolder,
  moveFolder,
  moveTeamToFolder,
  renameFolder,
} from "@/lib/myTeamFolders";
import { useAuth } from "./useAuth";
import type { MyTeamFolders } from "@/types";

/** The last loaded folders, kept across page navigations (see useMyTeams' cache). */
let cached: MyTeamFolders | null = null;

/**
 * Your My Teams folders (docs/team-folders.md): this device's, and, signed
 * in, the account's (see syncTeamFolders). Every change saves right away.
 */
export function useTeamFolders() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [state, setState] = useState<MyTeamFolders>(() => cached ?? EMPTY_TEAM_FOLDERS);
  // The latest folders, updated as soon as they change — so changes made back
  // to back (create a folder, then move a team into it) each see the last.
  const latest = useRef(state);

  useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;
    (user ? syncTeamFolders(user.uid) : getTeamFolders())
      .then((loaded) => {
        if (cancelled) return;
        cached = loaded;
        latest.current = loaded;
        setState(loaded);
      })
      .catch((error) => console.error("[team folders] failed to load:", error));
    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  function save(change: (current: MyTeamFolders) => MyTeamFolders) {
    const next = change(latest.current);
    latest.current = next;
    cached = next;
    setState(next);
    void setTeamFolders(next).catch((error) =>
      console.error("[team folders] failed to save:", error),
    );
  }

  return {
    folders: state,
    /** Creates a folder and returns its id. */
    createFolder: (name: string): string => {
      let id = "";
      save((current) => {
        const created = createFolder(current, name);
        id = created.id;
        return created.state;
      });
      return id;
    },
    renameFolder: (id: string, name: string) => save((s) => renameFolder(s, id, name)),
    deleteFolder: (id: string) => save((s) => deleteFolder(s, id)),
    moveFolder: (id: string, direction: -1 | 1) => save((s) => moveFolder(s, id, direction)),
    moveTeam: (teamId: string, folderId: string | null) =>
      save((s) => moveTeamToFolder(s, teamId, folderId)),
  };
}

/**
 * Files a just-created team in `folderId` — a team made from inside a folder
 * (the Team Builder's ?folder=). Works without the hook mounted: it builds on
 * this session's folders, or this device's saved ones.
 */
export async function fileNewTeam(teamId: string, folderId: string): Promise<void> {
  const current = cached ?? (await getTeamFolders());
  const next = moveTeamToFolder(current, teamId, folderId);
  if (next.placement[teamId] !== folderId) return; // the folder is gone
  cached = next;
  await setTeamFolders(next);
}
