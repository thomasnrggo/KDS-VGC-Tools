# My Teams folders

Status: **released** in 0.3.14 (2026-11-11).

Folders organize the My Teams page: create, rename, reorder and delete them, and file each team in
one (or none — "Unfiled").

## Decisions (2026-11-11)

| Question          | Decision                                                     |
| ----------------- | ------------------------------------------------------------ |
| Look              | Folders first, then unfiled teams; click a folder to open it |
| Depth             | One level, like Showdown's teambuilder folders               |
| Whose             | Yours alone — even a collaborative team is filed per member  |
| Deleting a folder | Its teams become unfiled; nothing else is deleted            |

## Data

`MyTeamFolders` (src/types/teamFolder.ts): `folders` (`id`, `name`, `sortOrder`) and
`placement` (team id → folder id), with `updatedAt`. It lives outside the teams, so collaborative
teams work the same way: this device's copy in IndexedDB's meta store, the account's in
`users/{uid}/meta/teamFolders` (`getTeamFolders` / `setTeamFolders` / `syncTeamFolders` in
src/lib/storage/db.ts). On sign-in the copy changed last wins; with none on the account, this
device's is uploaded. Edits go out right away (no rules change needed: `users/{uid}/**`).

Pure edits and grouping: src/lib/myTeamFolders.ts (tested). `useTeamFolders` keeps the latest
state in a ref so back-to-back changes (create a folder, then move a team into it) each build on
the last.

## UI (MyTeamsSection)

Tried first as collapsible sections, then as folders you open like a file browser; the user settled
on a folder panel beside the list (2026-11-11).

- **Desktop**: the teams on the left, a **Folders** panel on the right — All teams, each folder,
  No folder (once there are folders), each with its count, then **New folder**. Picking one shows
  just those teams (`/teams?folder=<id>` or `?folder=none`, so Back and returning from a team keep
  it). A folder's ⋮: Rename, Move up / down, Delete (its teams stay, in no folder).
- **Phones**: the panel is a row of chips above the list, with the picked folder's ⋮ beside it.
- **Move to folder** on every team row: pick a folder, No folder, or type a name to create one and
  move the team there.
- **Drag** a team onto a folder (or No folder) in the panel to file it there; dragging within the
  list only reorders.
- **Create team** with a folder picked files the new team in it (the Team Builder's `?folder=`,
  `fileNewTeam` in useTeamFolders).
- **Search** looks within what's picked. Counts are for the tab (Active / Archived) and regulation
  shown; folders don't depend on either.
