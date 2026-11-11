# Collaborative teams

Status: **phases 1 and 2 built** (2026-11-11), not yet released. Needs the latest
`firestore.rules` deployed. Follows the full share (docs/full-share.md, 0.3.11).

Several players build and prep one team together: the roster, overview, notes, combinations, calcs
and every matchup's plans are the same for all of them, and each edit shows up for the others live.

## Decisions (2026-11-11)

| Question                                | Decision                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Plans                                   | **Shared**: one plan per matchup for everyone. Someone who wants their own forks the team                                 |
| Membership                              | **Reuse prep groups**: a collaborative team is a team plus its own prep group                                             |
| Roles                                   | **Owner + editors** only. Read-only viewers use the full-share link                                                       |
| Rich text edited by two people          | Last write wins, with an "X is editing…" marker. CRDTs (Yjs) only if that's not enough                                    |
| Plans pointing at roster slots by index | Kept. A roster change shifts the shared plans in one batched write, as removing a Pokémon already does for personal plans |
| Offline                                 | Online-only, like prep groups (Firestore's local cache still answers reads instantly)                                     |

## Model

```
groups/{groupId}                  PrepGroup + teamId          membership, invites (unchanged)
groups/{groupId}/opponents/{id}   SharedOpponent              the team's matchup list (unchanged)
groups/{groupId}/plans/{id}       SharedPlan                  NEW — the one shared plan per opponent
teams/{teamId}                    CollabTeam                  NEW — the team's own fields
teams/{teamId}/combinations/{id}  TeamCombination             NEW — one doc each
teams/{teamId}/calcs/{id}         TeamCalc                    NEW — one doc each
```

- `CollabTeam`: `Team` minus `combinations`/`calcs`/`share`/`sortOrder`/`archivedAt`, plus `groupId`,
  `ownerUid`, `updatedBy` (uid + name) and `updatedAt`. It's written per field (`updateDoc`), so
  editing the notes never overwrites a roster change made meanwhile.
- `SharedPlan`: `MatchupPlan` plus `opponentId`, `updatedBy`, `updatedAt`. Written per field too
  (picks vs notes vs scouting notes).
- Combinations and calcs are one doc each, so two people adding them never collide. Their order:
  a `sortOrder` field, like opponents.
- The group's `regulationId` is the team's first regulation. A collaborative team has one
  regulation, like any prep group.
- Plans of ordinary (non-team) prep groups stay private (`users/{uid}/groupPlans`). Only a team's
  group uses `groups/{groupId}/plans`.

### Rules (summary)

- `teams/{teamId}` and its subcollections: read and write by members of `groupData(teamId's
groupId)`. Create only by the group's owner; `groupId` and `ownerUid` can't change.
- `groups/{groupId}/plans/{id}`: members read and write. A member's own private `groupPlans`
  rules are unchanged.

## How the app reads them

- **`useMyTeams` gets two stores**, the way the opponent hooks do (`OpponentStore`):
  - personal teams stay local-first (IndexedDB + sync);
  - collaborative teams come from live listeners on the teams of every group you're in that has a
    `teamId`.

  Both are merged into one list, and each write goes to the right store. The calculator, Speed Tiers,
  Team Builder, Tournaments and the header keep reading `useMyTeams` and don't change.

- `Team.collab?: { groupId; ownerUid }` marks a collaborative team in that list (badges, member
  avatars, what the menus offer).
- **Matchups**: the Team Report's Matchups tab and the Matchup Planner (the team's group in the
  list switcher) show the group's opponents with the shared plan. Its picks point into the team's
  roster as usual.
- **Roster changes** (removing or reordering a Pokémon) shift every shared plan and the team's
  combinations in one batch (`rosterSlots.ts`), done by whoever made the change.

## Flows

- **Make collaborative** (team menu, signed in): creates the group (named after the team) and
  `teams/{teamId}` with its combinations and calcs, then removes the personal copy. Optionally it
  brings your prepped opponents for this team into the group with their plans (`copyOpponentsInto`).
  The invite link is the group's.
- **Join**: the group's invite link (`/groups/join/{code}`). The team then shows up in My Teams.
- **Stop collaborating** (owner): turns it back into a personal team of the owner's (the group is
  archived). Before that, each member can **Keep a copy**.
- **Leave** (editor): the team leaves your list. Keep a copy first if you want one.
- **Fork** ("Duplicate" on a collaborative team): a personal copy with its combinations, calcs and
  the shared plans, filed under the copy.
- **Full share**: owner only, as today.
- **Tournaments and game logs** stay personal. A log of a team you left keeps its picks, but no
  longer has the team to show them against.

## UI

- My Teams and the Team Report: a "Shared with N" badge and member avatars; the owner's menu has
  Invite, Members, Stop collaborating, the editors' has Leave.
- "Last edited by Rey · 2 min ago" on the team post, each plan and the notes.
- Phase 3: an "X is editing…" marker on a rich-text field someone else has focused (a presence doc
  with a short expiry), which makes your editor read-only until they stop.

## Phase 1: what's built

- **Types**: `Team.collab` (never stored, added when read), `PrepGroup.teamId`, `CollabTeamDoc`,
  `CollabCombinationDoc` / `CollabCalcDoc`, `SharedPlanDoc`, `EditedBy`.
- **`src/lib/collabTeam.ts`** (tested): the docs ↔ `Team` conversions, and `diffCollabTeam`, which
  turns an edit into changed fields plus per-doc puts/removes for combinations and calcs.
  Per-member fields (order, archived, sharing) are never written. Also `sharedPlansWithoutSlot`.
- **`src/lib/firebase/collabTeams.ts`**: `subscribeCollabTeam` (doc + both subcollections, reported
  once all three answer) and `writeCollabTeamChanges` (one batch: changed fields, cleared ones
  deleted, `updatedBy`/`updatedAt`); `getSharedPlans` / `saveSharedPlans`.
- **`useCollabTeams`**: listens to the team of each of your active groups that has a `teamId`.
- **`useMyTeams`**: your teams plus the collaborative ones, as one list. Edits to a collaborative
  team show right away and are written after 800 ms. Each write is the difference between the edit
  and the snapshot it started from, so a teammate's change to another part made meanwhile is never
  overwritten. Pending edits are shared by every instance of the hook on the page. The active team
  is resolved on each render, so a collaborative active team is found once it arrives. `saveMyTeam`
  refuses a collaborative team, and duplicating one makes a personal copy (`collab` dropped).
- **Removing a Pokémon** from a collaborative team also shifts its group's shared plans
  (`removePokemonEverywhere`'s `collab` argument).
- **Rules**: `teams/{teamId}` (+ `combinations`, `calcs`) for the group's members (create/delete by
  its owner; `groupId`/`ownerUid` fixed), and `groups/{groupId}/plans` on a team's group.
- **Not yet** (phase 2): list order and archiving are per-member preferences that collaborative
  teams don't have yet, so reordering and archiving skip them. Removing a collaborative team does
  nothing; leaving and stopping are phase 2 flows.

## Phase 2: what's built

- **Collaborate** button on the Team Report (`CollabDialog`, src/components/CollabTeam):
  - your own team: **Make collaborative** (`makeTeamCollaborative` in src/lib/collabTeamFlows.ts):
    the group (named after the team, `teamId` set, you as owner), then `teams/{id}` with its
    combinations and calcs, then — if ticked — your prepped matchups for it copied into the group
    with their plans as the shared ones. The personal copy is then dropped (`dropPersonalCopy`),
    and with it any public share. Only the first regulation is kept.
  - a collaborative team: the invite link (the group's), members (the owner removes others),
    **Keep a copy** (a personal copy, with the matchups and shared plans in your opponents),
    **Leave** (editors) and **Stop collaborating** (owner: the team becomes the owner's again — same
    id, matchups and shared plans brought home, replacing older personal plans — then `teams/{id}`
    is deleted and the group archived).
- **Shared plans**: on a team's group, `useGroupOpponents` and `useAllGroupOpponents` show the
  team's plan from `groups/{id}/plans` (`withSharedPlan`) and save edits to it, with `updatedBy`.
  Plans for your other teams stay private. A private plan for the team (e.g. copied in) shows until
  there's a shared one and becomes it on its first edit.
- **Invites** carry `teamId`, so the join page explains it's a collaborative team and opens the team.
- **UI**: member avatars in place of the Collaborate icon, "Collaborative · Edited by Rey · 5
  minutes ago" under the header (`timeAgo`), a Collaborative badge in My Teams. A collaborative
  team has no Share, Archive or Remove, and its regulation can't be re-tagged. The planner's
  group bar doesn't offer archiving a team's group.
- **Rules**: a team doc (or its subcollections) that doesn't exist reads as missing rather than
  denied, so members' listeners survive the moment between the group and the team being created.

**Not yet:** "last edited by" on each plan (the Activity panel shows plan edits), sharing a collaborative
team's report, per-member list order and archiving, renaming the group with the team, and
presence ("X is editing…", phase 3).

## Activity log (2026-11-11)

A collaborative team's **Activity** drawer (the history icon in the Team Report header) lists who
did what, newest first, live. It slides in from the right over the report on every screen size
(the app's `Drawer`, `swipeDirection="right"`), rather than pushing the report aside like the
Team Builder's panel (`SidePanel`).

- **Storage**: `teams/{teamId}/activity/{id}` (`TeamActivity`). Entries are structured
  (`TeamActivityChange`: created, joined, left, removedMember, fields, combinations, calcs, plan)
  so each language words them; the panel shows the newest 100.
- **Written with the edit**: a team edit's entries go in the same batch as the edit
  (`writeCollabTeamChanges` → `activityFromTeamChanges`); a shared plan's when it's saved; joining,
  leaving, removing a member and making the team collaborative log their own.
- **Detailed**: each entry has a headline and detail lines.
  - **Roster** (`rosterActivity`): Pokémon added and removed, and per Pokémon its moves added and
    removed, item, ability and nature (from → to) and each stat's Stat Points (Speed 20 → 25). Pokémon are matched by
    species, so removing one doesn't read as the rest changing.
  - **Combinations**: what each added, changed or removed one leads and brings back.
  - **Calcs**: the Pokémon, its target and side, grouped with a count.
  - **Plans**: which parts changed (`planParts`: your picks, their expected picks, the game plan,
    what they do, notes on their Pokémon, the number of plans).

  Merged entries recompute their details against what the first edit replaced, so ten minutes of
  edits read as their net change. Edits that cancel out (a calc added then removed) hide the entry.

- **Comparisons ignore key order** (`sameValue`): Firestore hands objects back with its own key
  order, which made unchanged combinations count as "changed" and an untouched roster as "edited".
- **Merged**: your edits of the same thing within 10 minutes extend your latest entry (counts add
  up, fields are unioned, `lastAt` moves) instead of adding one per pause in your typing
  (`continuesActivity` / `mergeActivity`, remembered per session).
- **Undo data** (for a later Restore): each entry keeps what the edits replaced, as it was before
  the first of them: field values, removed or changed combinations and calcs, the previous plan.
- **Rules**: members add entries as themselves and can only extend their own; only the owner
  deletes them (when the team ends, `deleteCollabTeam` clears the log first).
- **Kept 30 days**: each entry has `expireAt`; a Firestore TTL policy on the `activity` collection
  group's `expireAt` field deletes old ones (set up once in the Firebase console).

## Phases

1. **Groundwork** (nothing visible): `useMyTeams` behind two stores; the roster-change shift for
   plans in a group; `Team.collab`.
2. **Collaborative team v1**: the model and rules above, Make collaborative / join / leave / stop /
   fork, shared plans, avatars and "last edited by".
3. **Presence**: "X is editing…" on rich text.
4. **Later, if needed**: CRDT rich text, edit history, a viewer role.
