# Opponent Organization — Feature Plan

Companion to [PLANNING.md](../PLANNING.md), which stays the source of truth for the app's overall
vision/decisions/data model. This doc owns the scope/decisions for organizing the Matchup Planner's
opponent list: manual ordering, tags, smarter import de-duplication, and team variants. Update it as
decisions change; PLANNING.md §7 only carries a one-line pointer + status.

## 1. Vision

A regulation's opponent list grows fast (a single "best teams" folder import is 13+ teams), and many
of those teams are near-copies of each other. The goal is to keep the list short and in an order that
means something to the user:

- **Order by perceived usage.** There's no usage data to sort by, so the user orders teams manually —
  most-used on top — and can flip that order with one button.
- **Tags** for strategies (rain, sun, perish, TR, …) that search can find.
- **Variants.** Near-identical teams collapse under one *main* team, expandable on demand, so the list
  shows each archetype once.
- **Import that understands all of the above** — catches exact duplicates even when moves are
  reordered, and offers to file a near-copy as a variant instead of a new row.

## 2. Decisions (2026-10-12)

### Ordering
- New `Opponent.sortOrder: number`, **highest first** (same convention as `Team.sortOrder`).
- **Reordering is drag-and-drop by a handle** (the row has text inputs/pickers, so the whole row
  can't be draggable like My Teams' rows), plus **Move up / Move down** in the row's ⋮ menu — HTML5
  drag-and-drop doesn't work on most touch devices, so the menu is the mobile path.
- A move rewrites **only the moved opponent** when possible: its new `sortOrder` is the midpoint of
  its new neighbors. Only when there's no room (tied neighbors, e.g. legacy opponents imported in the
  same millisecond) does it fall back to renumbering the visible list. Keeps cloud-sync writes to one
  per move in the common case.
- Ordering is **scoped to the visible regulation** — other regulations' opponents are never touched.
  Disabled while searching (the filtered list isn't the full order).
- **New opponents go on top** — a newly added team is a new threat to prep for. A bulk import lands
  on top as a block, in paste order (first pasted team first).
- Sort ties break by `createdAt` desc, then `id` — deterministic, so reloads never reshuffle.
- Legacy opponents get `sortOrder = createdAt` in ms (via `normalizeOpponent`), which reproduces the
  previous newest-first order.
- **Reverse is view-only.** It flips the displayed order without rewriting any data, so toggling back
  is free. Stored per browser in `localStorage` (a viewing preference, not team data). Dragging in
  reversed view works on the displayed order and is translated back.

### Tags
- `Opponent.tags: string[]`, free-text, lower-cased, de-duplicated.
- Search matches tags alongside Pokémon and items (same AND-of-terms semantics).
- **Suggested, never auto-applied**, from the team itself: Drizzle → `rain`, Drought → `sun`,
  Sand Stream → `sand`, Snow Warning → `snow`, Trick Room → `trick room`, Perish Song → `perish`.
  Combos: two or more different weather setters → `double weather`; a Psychic Surge setter plus an
  Expanding Force user (any Pokémon for each, including the same one) → `psyspam`.
  Tailwind is deliberately not suggested — it's a utility move on too many teams to signal a
  strategy. The user accepts or ignores each suggestion. Abilities are read through
  `resolveEffectiveAbility`, so a Mega's ability counts (Charizard @ Charizardite Y → `sun`, even
  though the paste says Blaze).
- UI: chips right-aligned on the "Game plan" title row on desktop (under the roster on mobile, where
  the game plan is collapsed by default), with a "+ Tag" button that opens an inline input
  (autocompletes from tags already used in the regulation). Suggestions only show while that input
  is open — the button says how many there are — so a long list isn't covered in dashed chips.
- Logic lives in `src/lib/opponentTags.ts`; UI in `OpponentTags`.

### Duplicate detection on import
- "Exact duplicate" compares the **team, not the paste text**: same species set, and per species the
  same item and the same set of moves (order-insensitive). Whitespace, nicknames, move order and slot
  order don't matter, and neither do the ability/nature/Stat Points lines. Replaced the old
  byte-identical `rawPaste` check. Applies to single adds and folder imports (including a folder
  that lists the same team twice); the import notice names which existing team each skipped one
  matches. Logic: `teamFingerprint`/`speciesIdentity` in `src/lib/teamIdentity.ts` —
  `speciesIdentity` is also what variant detection will compare species with.

### Variants
- **Each variant is a full opponent** with its own lead/back plan and notes.
- One level deep: a group is one **main** opponent plus its variants (`Opponent.variantOf?: string`
  = the main's id; a main has none). No chains.
- **New variant's plan starts as a copy of the main's plan** for each of the user's teams, and shows
  a **"Copied from <main>"** badge until that plan is edited.
- Mains are ordered among the mains; variants have their own manual order inside their group (same
  `sortOrder` field, only compared within the group), with the same drag handle and Move up/down/top/bottom
  menu items. A variant can't be dragged out of its group. A team joining a group (import or "Make
  variant of…") lands at the top of its variants. "Set as main" swaps slots: the old main takes the
  promoted variant's place among the variants. Removing a main promotes its first variant.
- **Set as main**: any variant can be promoted. It takes over the group's list position; the old main
  becomes a variant.
- Removing a main promotes its first variant rather than deleting the group.
- Variants must share the main's regulation; detection only compares within a regulation.
- **Remove from group** takes a variant out and places it in the list right below its old main.
- **Make variant of…** (⋮ menu on a main) is the manual path — for teams imported before variants
  existed, or that the rules didn't flag. It lists groups the rules match as "Suggested" first,
  then every other main. A main that already has variants brings them along (still one level).
- UI: a main with variants shows an "n variants ˅" toggle in its name row — on desktop where the ⋮
  menu used to be (desktop's ⋮ moved to the right end of the Game plan title row, after the tags);
  on mobile next to the ⋮. No extra row is added to the table. Variants render below their main
  with a "Variant" chip and an inset left bar (a shadow, so columns stay aligned with other rows).
  While searching, a group shows if its main or any variant matches, with only matching variants
  listed and auto-expanded. Reverse flips the groups; variants keep their order.
- Data: `Opponent.variantOf` (main's id) and `Opponent.copiedPlanFrom` (team id → source
  opponent id). Logic in `src/lib/opponentVariants.ts`; hook actions `setGroupMain`, `makeVariant`,
  `detachVariant` in `useOpponents`.

#### Variant detection rules
A pair of teams is a *variant candidate* if **any** of these hold:

| # | Rule | Rationale |
|---|---|---|
| 1 | **≥ 5 shared Pokémon** (Megas irrelevant) | One slot changed — same team even with a Mega swap |
| 2 | **4 shared Pokémon and ≥ 1 shared Mega** | The Mega is the team's identity |
| 3 | **Double-Mega core**: both teams carry 2 Megas, both shared, plus ≥ 1 more shared Pokémon (3 total) | A Mega pair defines the team more than the filler |

Explicitly *not* variants: 3 shared + 1 shared Mega (tested on the M-C "best teams" folder: matches
Chomp Z ↔ Perish - Archa and Double weather ↔ Zardpex, which are different teams); 4 shared with no
shared Mega (ChompZ TR ↔ sun zard — Garchomp-Z vs Charizard-Y).

Identity details:
- A Mega is identified by **species + stone** — Charizard-X and Charizard-Y count as the same
  Pokémon but not the same Mega.
- A `-Mega` species suffix is ignored when comparing (`Floette-Mega` @ Floettite ≡ Floette-Eternal);
  other forms stay distinct (Arcanine-Hisui ≠ Arcanine).
- Multiple matching groups → pick by most shared Megas, then most shared Pokémon, then most identical
  sets (same item + moves). The import review shows that default and lists the alternatives.
- A new team is compared against **every** member of a group, but is only ever suggested into one
  group — prevents chaining aerozard → sun zard → Zardpex into one blob.
- Thresholds live as constants in one module, so they're cheap to tune. No settings UI.

Against the 13-team M-C "best teams" folder these rules suggest exactly: Perish - Kommoo ↔ Perish -
Archa (rule 2), Zardpex ↔ sun zard (rule 1), aerozard ↔ sun zard (rule 2, plausible reject).

#### Import review
Single adds, mass imports and default sets all go through `analyzeImport` → `buildImport`
(`src/lib/opponentImport.ts`). The review modal (`ImportReview`) only opens when at least one
incoming team has a variant candidate — otherwise the import goes straight through as before. It
lists every team with what will happen: exact duplicates and unparseable teams are shown as skipped;
each candidate team gets a picker (Variant of X / Add as a new team / Don't import) defaulting to its
best group, with the match detail ("4 Pokémon in common, same Mega") under the picker.

Earlier teams in the same paste count as candidate groups, so a folder holding both halves of a pair
groups them. A team that picks an earlier entry joins whatever group that entry ended up in (its main,
if it became a variant itself), or is added as new if that entry was skipped.

## 3. Implementation order

1. [x] Manual order + Reverse — `sortOrder`, drag handle, Move up/down, view-only Reverse.
2. [x] Tags + suggested tags + tag search.
3. [x] Semantic duplicate detection on import.
4. [x] Variants: data model, grouped list UI (Variants (n) expander, Set as main), plan copy + badge,
       detection rules, import review step.
