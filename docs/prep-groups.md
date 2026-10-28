# Prep groups (collaborative Matchup Planner)

Status: **shipped** 2026-10-14. Needs the `firestore.rules` from that change deployed.

## What it is

A **prep group** (e.g. "Regionals – Team Anthos") is a shared list of opponent teams that several
players build together for an event. Everyone in the group adds, edits, tags, groups (variants)
and orders the opponents; each player's **lead/back picks, Mega choices and game-plan notes stay
private** to them.

The personal opponent list ("My opponents") is unchanged. The Matchup Planner gets a switcher:
*My opponents* / *each group*.

## Decisions (2026-10-13)

| Question | Decision |
|---|---|
| Who can remove an opponent from a group | The group's owner, or whoever added it |
| List order | Shared — one order for the whole group |
| How many groups | Several (one per event), each can be archived |
| Sharing picks/notes with the group | Not now — plans are private |
| Shared scouting notes | Not now |

## Data model (Firestore)

```
groups/{groupId}                       PrepGroup — name, regulationId, ownerUid,
                                       memberUids[], members{uid: {name, photoURL}},
                                       inviteCode, archivedAt?, createdAt, updatedAt
groups/{groupId}/opponents/{id}        the shared opponent (Opponent without the
                                       private plan fields) + addedBy, addedByName
groupInvites/{code}                    { groupId, groupName } — the invite link's token
users/{uid}/groupPlans/{groupId}_{id}  your plans for one group opponent:
                                       plansByTeamId, copiedPlanFrom
```

- The planner merges each shared opponent with your plan doc into the same `Opponent` shape the
  personal list uses, so the list, cards, pickers, variants and search work unchanged.
- Writing an opponent splits it again: shared fields to the group, plan fields to your account.
- A group is tied to one regulation (an event has one ruleset); the regulation dropdown is locked
  to it while viewing the group.
- Groups are online (Firestore, live updates through listeners); personal opponents stay
  local-first in IndexedDB as before. Groups need sign-in.

## Invites

- Creating a group creates an invite code: `groupInvites/{code}` points at the group. The link is
  `/groups/join/{code}`.
- Anyone signed in who opens the link sees the group's name and can join; joining adds them to
  `memberUids` and `members`. The rules only allow that update if the code they send matches an
  invite for this group.
- The owner can reset the link (a new code; the old one stops working) and remove members.
  A member can leave.

## Security rules (summary)

- A group doc is readable by its members; created by its owner (as its only member); updated by
  the owner, by a member removing only themselves (leave), or by a signed-in user adding only
  themselves with a valid invite code (join).
- Group opponents: members read, create (as `addedBy` themselves) and update (without changing
  `addedBy`); delete only by `addedBy` or the group owner.
- `groupInvites/{code}`: a signed-in user can `get` one (knowing the code is the access); nobody
  can list them; only the group owner creates/deletes them.
- `users/{uid}/…` (your plans) is already yours-only.

## UI

- **Matchup Planner header**: a source switcher next to the title — My opponents, your active
  groups, "New group…", and archived groups.
- **Group bar** (when a group is selected): its name, member avatars, "Invite" (copies the link),
  and a menu: rename, reset invite link, members (owner removes), archive/unarchive (owner), leave
  (member).
- **Opponent cards in a group**: Remove only shows for its adder and the owner (who added it is
  still saved, no longer shown). "Copy to my opponents" (with your plans). Personal opponents get
  "Copy to group…".
- **Add from another list…** (the list's ⋮ menu, and its empty state; signed in): copies several
  teams at once into the open list from your opponents or another group of the same regulation
  (`AddFromListDialog`, `copyOpponentsInto`), with your plans. Teams the open list already has —
  same Pokémon and items (`sameTeamKey`) — show as "Already here" and can't be picked. A variant
  copied with its main stays its variant.
- **Join page** `/groups/join/{code}`: the group's name and a Join button (sign in first).

## Future: personal invites (requested 2026-10-14)

Today anyone signed in who has the link can join, and any member can copy the link. Planned
instead: **the owner invites specific people, and each one accepts to join.**

- The owner creates an invite for a person (e.g. by email or a per-person link); it shows up as
  pending in the group's Members list until accepted, declined or withdrawn.
- The invited player sees it (on the invite page, and as a pending invite in the Matchup Planner's
  list switcher) and **accepts** to join — joining only happens through an accepted invite.
- Open questions: inviting by Google account email vs. a single-use link; whether the shared
  link stays as an option (e.g. owner can turn it off); expiring invites.
- Until then, the owner's controls are "Reset invite link" and removing members.

## Out of scope for now

Sharing picks/notes with the group, shared scouting notes, deleting a group (archive instead),
roles beyond owner/member, offline editing of group data.
