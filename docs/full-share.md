# Full share (shared Team Report with strategy, calcs and matchups)

Status: **built** 2026-11-11, not yet released. Needs the `firestore.rules` from that change
deployed (the `sharedTeams/{teamId}/matchups` match) before matchups can be published.

Step one of "share the whole team with friends". Step two, a **collaborative mode** (several people
editing one team), is discussed at the end and not built yet.

## Decisions (2026-11-11)

| Question              | Decision                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Snapshot or live link | **Live**: the same `sharedTeams/{teamId}` doc (no new doc per share), updated as the owner edits                         |
| Where matchups go     | A subcollection, `sharedTeams/{teamId}/matchups/{opponentId}` — one doc per matchup, so the 1 MB doc limit never matters |
| What's shared         | The roster and overview always; the owner ticks **Strategy** (notes + combinations), **Calcs**, **Matchups**             |
| Importing             | "Add everything to my teams" copies the team with what was shared, and its matchups into your opponents                  |
| Sign-in to view       | Not needed (like the existing shared report)                                                                             |

## Data

```ts
type ShareSection = "strategy" | "calcs" | "matchups";
interface TeamShare { sheet: "open" | "closed"; sections?: ShareSection[] }

// sharedTeams/{teamId} — SharedTeam gains:
sections?: ShareSection[];
notes?: string; combinations?: TeamCombination[];  // with "strategy"
calcs?: TeamCalc[];                                // with "calcs"

// sharedTeams/{teamId}/matchups/{opponentId}
interface SharedMatchup {
  id; label; regulationId; pokemon: ParsedPokemon[]; pokepasteUrl?; tags;
  variantOf?; sortOrder; plan: MatchupPlan; updatedAt;
}
```

A share made before sections existed has none, so it shows exactly what it did before.

## Publishing (src/lib/storage/db.ts)

- **Team doc**: unchanged path — `saveMyTeam`'s debounced push republishes it (`toSharedTeam` now
  adds the chosen sections).
- **Matchups follow every opponent edit**: `saveOpponent` (your list) and `useGroupOpponents`' store
  (a prep group's) call `publishOpponentToShares` on the same debounce. For each of your teams
  sharing matchups, an opponent in its regulations with prep for it (`hasMatchupPrep`) is published;
  otherwise its doc is removed. Deleting opponents calls `removeOpponentsFromShares`. A
  per-session fingerprint skips writes when nothing changed.
- **Reconcile**: `reconcileSharedMatchups(team, opponentsToShare(team, lists))` makes the published
  set exactly the Team Report's Matchups tab (your list + every prep group, same team once). It runs
  from the Share dialog (after the team doc is published) and once per visit to the Team Report,
  which catches what per-edit publishing can't: a teammate removing a group opponent, or prep made
  before matchups were shared.
- **Unpublish** removes the matchups first, then the team doc (the rules check the team doc).

## Rules

`sharedTeams/{teamId}/matchups/{opponentId}`: anyone reads; writes only when the parent team doc
exists and its `ownerUid` is the signed-in user.

## Viewing

- `/shared/[teamId]`: the post, then tabs — Team report, and Strategy / Calcs / Matchups when
  shared. The components are the owner's, read only: `TeamCombinationCard`, `GamePlanCard` and
  `PokemonSlotPicker` take no change handlers (`readOnly`), notes render with `RichTextView`.
  `sharedTeamAsTeam` / `sharedMatchupAsOpponent` turn the public copies into `Team` / `Opponent`.
- `/shared/[teamId]/matchups/[opponentId]`: the matchup page, read only. The matchup page's body is
  now `MatchupView` (src/components/MatchupView), shared with `/teams/[teamId]/matchups/[opponentId]`.
- **Sections are closed-sheet only** (decided 2026-11-11): calcs and plans would give away the Stat
  Points and nature an open sheet hides. `sharesSection` returns false for an open sheet, so
  switching to open stops sharing them (the matchups are removed); the ticked sections stay saved
  and come back when the sheet is closed again. The dialog says so instead of showing the boxes.

## Importing ("Add everything to my teams")

`addSharedTeamToMyTeams` (src/lib/teamExport.ts) copies the team with the shared notes, combinations
and calcs. With matchups, `importSharedMatchups` (src/lib/sharedTeam.ts) files each one under the
new team: an opponent you already have (`sameTeamKey`) gets the plan unless it already has one for
that team; the rest are added as new opponents (tags kept, a variant stays one when its main came
along). Plans point at roster slots by index, and the copied team keeps the shared order.

Prep from a prep group is shared like your own, but the shared copy never says which group it's from.

## Next: collaborative mode (not built)

Discussed 2026-11-11; open questions before designing it:

- **One shared plan per matchup, or one per player?** Decides the plan data model.
- A collaborative team has to be an online doc with members (`teams/{id}`, like prep groups), not a
  local-first `users/{uid}` record — every page reading the active team must handle both kinds.
- Its plans need a home: likely the team's own prep group, with plans shared (today prep-group plans
  are private).
- Today's sync is last-write-wins per whole record, so two editors would overwrite each other:
  field-level writes or sub-documents, live listeners, and "X is editing" soft locks for rich text
  (CRDTs/Yjs only if that isn't enough).
- Roster slots are referenced by index (`pokemonNotes`, plan picks): stable slot ids should come
  first, or a teammate reordering the roster would misattach notes and picks.
- Roles (owner / editor / viewer), invites (reuse prep-group invites), "last edited by" or a light
  history, fork a copy, what happens when the owner leaves.
