# Team Builder — Feature Plan

Companion to [PLANNING.md](../PLANNING.md), which stays the source of truth for the app's overall
vision/decisions/data model. This file is the first of what should become a series of per-feature
planning docs under `docs/` — split off because PLANNING.md's §7 roadmap has grown into a 2500+ line
changelog that's hard to navigate for a single feature. Update this file as decisions change; fold a
one-line pointer + status into PLANNING.md §7 rather than duplicating detail there.

## 1. Vision

A Pokémon Showdown-style team builder, in-app: pick a species, then set its item, ability, moves,
nature, and EV spread (Stat Points, per this app's Pokémon Champions ruleset — see PLANNING.md §3),
across a full 6-slot team, with Showdown-paste import/export at both the single-Pokémon and full-team
level. This supersedes PLANNING.md §2's "no manual team builder UI" / "paste-in is the only way to
change a team" decisions — those are superseded by this doc, not deleted, since they explain _why_
paste-only was the original design.

## 2. Scope decisions (2026-09-16)

- **Ships as a separate, standalone flow for now** — not wired into `/teams`'s UI. It reads and writes
  the same `Team` records via the same storage/sync layer, but isn't linked from `/teams` yet.
  Integrating it as `/teams`'s "New Team" / "Edit" path is explicit future work, not part of this
  phase. _(Superseded 2026-10-28 — it's now My Teams' "Build a team" and each team's "Edit
  Pokémon"; see step 16.)_
- **Becomes the general editor for any team**, not just newly-built ones. Once shipped, opening any
  existing team (however it was created — paste, folder import, or built) in the builder lets you edit
  species/item/ability/moves/nature/Stat Points per slot. This finally reverses PLANNING.md §2's
  "paste-in is the only way to change a team" — re-pasting is no longer the only fix for a wrong field.
- **MVP is the full 6-slot team builder**, not a single-Pokémon editor first. Assemble/edit all 6 slots
  in one screen, save as a real `Team`, export the full team paste — closest to the real Showdown
  teambuilder experience, not a phased-down version of it.
- **Feature-flagged**, per this app's existing pattern (`src/types/featureFlags.ts` /
  `FeatureGate`) — off by default for non-admins until it's ready to be trusted with real team data.

## 3. What already exists to build on

Nothing here needs to be invented — the Damage Calculator's "Add Any Pokémon" custom builder
(`src/components/DamageCalculator/RosterPokemonPicker.tsx`) is functionally a single-Pokémon builder
already. This feature generalizes its editing UX into a persisted, multi-slot `Team` editor rather than
a session-only side-panel:

| Concern                                    | Existing module                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Species/ability/item/nature/move search UI | `SearchableSelect` (`src/components/DamageCalculator/SearchableSelect.tsx`)                         |
| Fresh custom Pokémon defaults              | `buildCustomPokemon(speciesKey)` (`RosterPokemonPicker.tsx`)                                        |
| Stat Points → final stats                  | `calculateStatBreakdown`, `applyStatOverrides` (`src/lib/stats/`)                                   |
| Ability resolution (Mega-aware)            | `resolveEffectiveAbility` (`src/lib/species/`)                                                      |
| Species display name / normalization       | `formatSpeciesDisplayName`, `normalizeSpeciesKey`, `candidateFormKeys` (`src/lib/species/`)         |
| Regulation-legal species/items             | `REGULATIONS`, `megaStoneItemsForSpecies` (`src/data/regulations/`)                                 |
| Ability/move/base-stat/type data           | `abilities.json`, `moves.json`, `baseStats.json`, `speciesTypes.json`, `species.json` (`src/data/`) |
| Showdown paste parsing (import)            | `parseTeam`, `parsePokemonBlock` (`src/lib/parseTeam.ts`)                                           |
| Showdown paste serialization (export)      | `formatPokemonPaste`, `formatTeamPaste` (`src/lib/formatPokemonPaste.ts`)                           |
| Team creation / regulation tagging         | `createTeam`, `normalizeTeam`, `addRegulationTag` (`src/lib/team.ts`)                               |
| Persistence (local + cloud)                | `db.ts` (`myTeams` store), `createCollectionSync<Team>` (`src/lib/firebase/cloudSync.ts`)           |
| Feature gating                             | `FeatureFlags`, `useFeatureFlags`, `FeatureGate`, `SECTION_FLAGS` in `admin/features/page.tsx`      |
| Sprite/item icon rendering                 | `PokemonSprite`, `ItemIcon`                                                                         |

## 3a. Data audit (2026-09-16) — what the picker panels need vs. what exists

Checked against four Showdown-teambuilder-style picker panels (species list, item list, ability list,
move list) plus the stat/nature editor:

| Panel                                                              | Needs                                                               | Have                                                                                                | Gap                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Species list (filter/sort by name & type)                          | name, types, abilities (regular + hidden, split), 6 base stats, BST | `species.json`, `baseStats.json`, `speciesTypes.json` all present; BST is a trivial sum, not stored | `abilities.json` stores ability names as a flat `string[]` ordered "regular first, hidden last" but **discards the actual hidden flag** — ambiguous for any species with exactly 2 abilities (could be 2 regular, or 1 regular + 1 hidden) |
| Item list (name + description)                                     | name, description                                                   | Only item _names_, scattered across `REGULATION_*_HELD_ITEMS`/`_BERRIES` and `megaStones.ts`        | No item dataset with descriptions exists at all                                                                                                                                                                                            |
| Ability list (name + description, hidden split)                    | name, description, hidden flag                                      | Names only, in `abilities.json`                                                                     | No ability descriptions exist anywhere; same hidden-flag gap as the species list                                                                                                                                                           |
| Move list (name, type, category, power, accuracy, PP, effect text) | all seven fields                                                    | `moves.json` has name/type/category/power                                                           | `accuracy`/`pp` are already columns in the PokeAPI `moves.csv` our generator (`generate-move-data.mjs`) fetches, just not extracted; effect/description text is entirely missing                                                           |
| Stat/nature editor                                                 | —                                                                   | `RosterPokemonPicker`'s Stat Points UI (`calculateStatBreakdown`/`applyStatOverrides`)              | **Not a gap** — this app intentionally uses Pokémon Champions' Stat Points (0–32/stat, 66 total, no IVs, Level 50 fixed), not vanilla Showdown's 0–252 EV / 0–31 IV / moveset-guessed-spread system. Do not build the vanilla version.     |

**Decision (2026-09-16): source the three missing description datasets (items, abilities, move
effects) from [`@pkmn/dex`](https://www.npmjs.com/package/@pkmn/dex)** (MIT, Smogon/Showdown-sourced
data layer), not by extending the PokeAPI CSV pipeline further. Verified locally — its `shortDesc`
output matches this app's target UI verbatim:

```
Dex.moves.get('blizzard').shortDesc   → "10% chance to freeze foe(s). Can't miss in Snow."
Dex.abilities.get('regenerator').shortDesc → "This Pokemon restores 1/3 of its maximum HP, rounded down, when it switches out."
Dex.items.get('choiceband').shortDesc → "Holder's Attack is 1.5x, but it can only select the first move it executes."
```

`@pkmn/dex`'s `Species.abilities` shape (`{"0": "Healer", "1": "Hydration", "H": "Regenerator"}`) also
solves the hidden-flag gap directly — the `H` key _is_ the hidden ability, no ambiguity. It exposes
matching base stats/types too, but **species/stats/types generation stays on the existing PokeAPI CSV
pipeline** (`generate-species-data.mjs`) — it already works, so only the genuinely missing pieces move
to the new source, keeping blast radius small:

- New `scripts/generate-item-data.mjs` → `src/data/items.json` (`Record<itemKey, {name, shortDesc}>`),
  scoped to items actually reachable in this app (`REGULATION_*_HELD_ITEMS`/`_BERRIES` ∪ Mega Stones),
  not `@pkmn/dex`'s full item list (also includes Poké Balls, TMs, key items, etc.)
- `generate-species-data.mjs`'s ability extraction changes from `string[]` to
  `{ name: string, isHidden: boolean }[]` (or equivalently a `{regular: string[], hidden?: string}`
  shape) sourced from `@pkmn/dex`'s `Species.abilities`, and gains a `shortDesc` per ability name
  (`Record<abilityName, string>`, since descriptions are per-ability not per-species-form) — likely a
  second small output file, e.g. `src/data/abilityDescriptions.json`, rather than repeating the same
  description under every species that has that ability
- `generate-move-data.mjs` adds `accuracy`/`pp` (already available from the existing PokeAPI
  `moves.csv` fetch — no new source needed) and a `shortDesc` sourced from `@pkmn/dex`
- Both `abilities.json` consumers (`RosterPokemonPicker.tsx`, `computeSpeedTiers.ts`) need updating for
  the new ability shape — small blast radius, only two files
- `npm install @pkmn/dex` (new dependency, MIT-licensed, dev-time only — used by generator scripts, not
  imported at runtime by the app itself, matching how `moves.json`/`abilities.json` are already
  build-time artifacts rather than a live dependency)

## 4. Data model impact

Reuse `Team` and `ParsedPokemon` as-is (`src/types/team.ts`) — no new fields required:

- A builder-created team is a normal `Team`. Call `createTeam("", name, regulationId)` (empty
  `rawPaste`) then set `pokemon` directly, **or** build the 6 `ParsedPokemon` first and derive
  `rawPaste` via `formatTeamPaste(pokemon)` so the stored raw paste always matches what the builder
  produced (existing code elsewhere may read `rawPaste` for display/re-export, so it must stay in
  sync — never leave it stale after an edit).
- `ParsedPokemon.evs` stays a raw string (`"32 HP / 4 SpD / 32 Spe"`) in storage — same as pasted
  teams. While editing, the builder needs a structured `Record<StatKey, number>` (like
  `RosterPokemonPicker`'s per-stat number inputs); serialize back to the pasted-string format on
  save/blur, don't change the stored shape.
- Species/item picking must be **regulation-gated** against the team's `regulationIds` (specifically
  the regulation the user is currently building/editing under, if a team carries more than one) —
  same gating `RosterPokemonPicker` already does via `REGULATIONS[n].speciesKeys`.
- A brand-new team built from scratch has no regulation yet — the builder's "new team" entry point
  must ask for one up front (a `Team` always needs `regulationIds.length >= 1`), the same choice
  `createTeam` already requires as a parameter today (check how the current "new team" paste form
  collects this and reuse that picker verbatim).

## 5. UI structure

- New route: `/team-builder` (own route-group `layout.tsx` wrapping `<FeatureGate
flagKey="teamBuilder">`), separate from `/teams` per §2's scope decision.
- Landing view: list of existing teams (reusing whatever team-list data/hook `/teams` already uses)
  each with an "Edit in builder" action, plus a "New team" action that starts from an empty 6-slot
  roster.
- Builder screen: 6 slot boxes (sprite + species name, empty state = "+ Add Pokémon"). Selecting/
  editing a slot opens the same editor surface as `RosterPokemonPicker`'s per-Pokémon panel:
  species search → item / ability / nature dropdowns → 4-move search-select → Stat Points grid with
  live final-stats readout.
- Team-level actions: rename, change/add regulation tag, **Import** (paste replaces all 6 slots via
  `parseTeam`), **Export** (`formatTeamPaste` output in a copyable textarea/modal, matching
  `RosterPokemonPicker`'s existing export modal pattern), **Save**.
- Per-slot actions: **Export this Pokémon** (`formatPokemonPaste`), duplicate slot, clear slot,
  reorder (drag or up/down, matching however `/teams` already reorders team rows if it does).

## 6. Feature flag wiring

Per the existing pattern (`src/types/featureFlags.ts`, `src/app/admin/features/page.tsx`):

1. Add `teamBuilder: boolean` to `FeatureFlags` and `DEFAULT_FEATURE_FLAGS` (default `false` — this is
   new/unproven, unlike the existing flags which all default `true`).
2. Add `{ flagKey: "teamBuilder", label: "Team Builder" }` to `SECTION_FLAGS` in
   `admin/features/page.tsx` so it can be toggled on for testing without a deploy.
3. Create `src/app/team-builder/layout.tsx` wrapping children in `<FeatureGate
flagKey="teamBuilder">`.
4. No `firestore.rules` change needed — it writes/reads the same per-user `users/{uid}/teams`
   collection as everything else; the flags doc itself already accepts arbitrary boolean fields.

## 7. Persistence plan

No new IndexedDB store or Firestore collection — builder-created/edited teams are ordinary `Team`
records through the existing `myTeams` store (`src/lib/storage/db.ts`) and `createCollectionSync<Team>`
cloud sync. Editing an existing team in the builder just calls the same `saveMyTeam`-style update path
`/teams` already uses, bumping `updatedAt` so last-write-wins sync behaves correctly.

## 8. Suggested implementation order

1. ✅ **Data first** (§3a, done 2026-09-16): `npm install @pkmn/dex`; wrote `generate-item-data.mjs`
   (→ `src/data/items.json`, 520 entries); updated `generate-species-data.mjs` (ability shape now
   `{name, isHidden}[]` + new `abilityDescriptions.json`, 312 entries) and `generate-move-data.mjs`
   (added `accuracy`/`pp`/`shortDesc` to `moves.json`'s 937 entries); updated the two `abilities.json`
   consumers (`RosterPokemonPicker.tsx`, `computeSpeedTiers.ts`) for the new shape — the ability picker
   now labels the hidden slot ("Frisk (Hidden Ability)"), verified live in the Damage Calculator.
   Fixed an unrelated regression surfaced by re-running the generator: `species.json`'s Meowstic Mega
   entries had a hand-patched `formSuffix` ("Mega", matching the shared gender-neutral sprite) that
   plain regeneration silently overwrote with PokeAPI's real per-gender identifiers
   ("Male-Mega"/"Female-Mega") — moved the fix into a `FORM_SUFFIX_OVERRIDES` table inside the
   generator itself so it survives future regenerations. New/changed types:
   `SpeciesAbility`/`AbilityData` (`src/types/abilities.ts`), `ItemData` (`src/types/items.ts`),
   `MoveData.accuracy`/`.pp`/`.shortDesc` (`src/types/damage.ts`). Verified: `tsc --noEmit`, `npm run
lint`, `npm test` (279 passed), plus a manual browser check of `/damage-calc` and `/speed-tiers`.
2. ✅ **Extract the per-Pokémon editor (done 2026-09-16)**: new `src/components/PokemonEditor/`
   (`PokemonEditor.tsx` + `computePokemonBuild.ts`, barrel `index.ts`) — owns species search + Mega
   toggle, ability/nature/item pickers, the Base/SP/Final stat table, and the 4-move grid, with no
   opinion on layout or battle state. Two composition points let a caller extend the stat table
   without forking it: `renderStatRowExtra(stat)` (an extra per-row cell — RosterPokemonPicker uses it
   for the Stat Stage dropdown) and `renderFinalCell(stat, value)` (overrides one stat's Final-column
   display — RosterPokemonPicker uses it for the Speed row's weather/Tailwind/status multiplier
   badge); `children` renders below the table (RosterPokemonPicker's Status/current-HP controls).
   `computePokemonBuild(pokemon, mega, statOverrides)` is the pure data layer behind it — exported
   separately since RosterPokemonPicker needs the same breakdown/effectiveAbility for its own
   battle-state math (Speed multiplier, HP bar) alongside PokemonEditor's internal use of it, rather
   than threading that data back out of the component via a callback.
   Also moved `SearchableSelect` out of `DamageCalculator/` into its own top-level
   `src/components/SearchableSelect/` folder, since PokemonEditor needed it outside that folder too.
   `RosterPokemonPicker.tsx` now composes `PokemonEditor` for the editing surface and keeps only
   sidebar/Import/Export/Load-modal/battle-state concerns itself — `buildCustomPokemon`,
   `DEFAULT_SPECIES_KEY`, and `STAT_LABELS` moved to `PokemonEditor`'s barrel (`DamageCalculator.tsx`'s
   imports updated accordingly). No visual/behavioral change intended for the Damage Calculator; the
   species search box moved from the card's header strip into the content column (still full content
   width, cosmetic only). Verified: `tsc --noEmit`, `npm run lint`, `npm test` (279 passed), plus a
   manual browser pass exercising Mega toggle, Tailwind/Speed-multiplier badge, and Stat Points editing
   on `/damage-calc` with no console errors.
3. ✅ **+4 combined (done 2026-09-16)**: feature flag + route scaffold, landing list, AND the 6-slot
   builder wired to a real `Team` (steps 3+4 shipped together — splitting them would have meant a
   landing page linking to a route that didn't exist yet).
   - `teamBuilder` flag added (`src/types/featureFlags.ts`), default `false`, plus its `SECTION_FLAGS`
     entry in `admin/features/page.tsx`. `MyTeamHeader`'s `currentPage` union gained `"team-builder"`
     but it's deliberately **not** added to `NAV_LINKS` — same "reachable by direct URL only, not
     linked yet" pattern already established for `damage-calc` before it launched.
   - `src/app/team-builder/layout.tsx` (`FeatureGate flagKey="teamBuilder"`), `page.tsx` (landing list
     via `useMyTeams().activeTeams`, reusing `TeamRoster` for each row's preview; "New team" button),
     `[teamId]/page.tsx` (the slot editor, `params: Promise<{teamId}>` unwrapped via `use()`, mirroring
     `/teams/[teamId]/page.tsx`'s established pattern exactly).
   - `useMyTeams` gained `addBlankTeam(name, regulationId): Team` (since replaced by `addBuiltTeam`, step 16) — creates a real 0-Pokémon `Team`
     (`createTeam("", ...)`, `parseTeam("")` is safely `[]`) without touching `addTeam`'s
     paste-required validation, so existing paste flows are untouched.
   - **Slot semantics, and why**: the detail page renders exactly one "+ Add Pokémon" tile (the slot
     right after the roster's current end) plus dimmed non-interactive placeholders for anything
     further out — never all-empty-tiles-independently-clickable. This is deliberate, not a
     simplification of convenience: `Team.pokemon` is a plain array and **existing lead/back plan
     references elsewhere in the app are raw indices into it** (`MatchupPlan`/`TeamCombination`'s
     `leadPair`/`backPair`, `Team.pokemonNotes`) — splicing or reordering would silently repoint any
     saved plan at the wrong Pokémon. So v1 only ever appends or edits-in-place; see §9 for what's
     deferred as a result.
   - Editing is **permanent, not an overlay**: unlike the Damage Calculator's `statOverrides` (kept
     separate from the saved team), the builder's `onStatOverridesChange` immediately runs
     `applyStatOverrides` and writes the result back into that slot via `updateTeam`, same for
     ability/item/moves. `rawPaste` is regenerated (`formatTeamPaste`) on every mutation so it never
     goes stale relative to the real roster. `mega`/`onMegaChange` are omitted entirely (Team Builder
     has no use for the calculator's "preview without Mega" toggle) — `PokemonEditor` defaults to
     always showing the Mega form when one's held, which is what a real roster should do.
   - **Known limitation, not yet fixed**: species/item pickers are still hardcoded to
     `REGULATIONS[0]` (current regulation) regardless of which regulation the team being edited is
     tagged under — same pre-existing constraint `RosterPokemonPicker` already has. Follow-up:
     parameterize `computePokemonBuild`/`PokemonEditor` by `regulationId`.
   - Verified: `tsc --noEmit`, `npm run lint`, `npm test` (279 passed), plus a full manual browser
     pass — landing list, opening an existing team, switching slots, editing Stat Points and
     confirming persistence across a reload, creating a new team, and appending a from-scratch
     Pokémon into an empty slot. No console errors. (Verification required temporarily flipping the
     flag's default to `true` locally, since there's no way to sign in as the admin account in this
     environment — reverted to `false` before finishing.)
4. Load an existing team into the builder for editing — **done as part of step 3/4 above** (opening
   any existing team from the landing list already goes through the same edit-in-place path a
   from-scratch team uses).
5. Team-level Import (paste → 6 slots) and Export (slots → paste), reusing `parseTeam`/
   `formatTeamPaste` verbatim.
6. Update PLANNING.md §2 to mark the "paste-only" decisions as superseded by this doc; add a §7
   roadmap entry once shipped.
7. ✅ **Rich, Showdown-style picker content (done 2026-09-16)** — user feedback after trying step 3/4
   live: the species/ability/item/move pickers only showed a bare name, not the type/stats/description
   data step 1 already generated, and a real bug meant Mega Stones M-C added on top of M-B (e.g.
   Salamencite) never appeared in the item list at all.
   - **Bug fix**: `computePokemonBuild.tsx`'s item list was calling the bare `megaStoneItemsForSpecies`
     re-export, which is specifically Regulation M-B's function — every other caller in the codebase
     (Speed Tiers, regulationLegality) correctly threads `regulation.megaStoneItemsForSpecies` through
     instead. Fixed to `REGULATIONS[0].megaStoneItemsForSpecies(...)`. Pre-existing bug, not something
     step 2's extraction introduced — just carried over verbatim from `RosterPokemonPicker.tsx`.
   - **`SearchableSelectOption` gained an optional `content?: ReactNode`** (`src/components/
SearchableSelect/SearchableSelect.tsx`) — rendered in place of the plain label/sprite fallback
     when set, so each picker can build whatever row shape its own data supports without
     `SearchableSelect` itself knowing about moves/species/items/abilities at all. _(A `wide` prop was
     also added here for a floating dropdown wide enough for these rows — removed again in the very
     next entry below, once the layout moved to a shared panel that doesn't float per-field at all.)_
   - **Row builders**, all in `PokemonEditor.tsx`/`computePokemonBuild.tsx`: species (sprite + name +
     type icons, abilities incl. Hidden, HP/Atk/Def/SpA/SpD/Spe + BST), moves (name + type icon +
     category + Pow/Acc/PP, `shortDesc` underneath), items and abilities (name + `shortDesc`, item rows
     also get an `ItemIcon`) — sourced directly from the step 1 data (`moves.json`'s new fields,
     `items.json`, `abilityDescriptions.json`, `speciesTypes.json`, `baseStats.json`).
   - Verified: `tsc --noEmit`, `npm run lint`, `npm test` (279 passed), plus a manual browser pass on
     both `/team-builder` and `/damage-calc` confirming Salamencite now appears for Salamence, and that
     species/ability/move rows render with full Showdown-style detail with no console errors.
8. ✅ **Shared results panel + slider Stat Points editor (done 2026-09-18)** — user feedback after
   trying step 8 live: rich rows were an improvement, but each field (species/ability/item/move) still
   popped its OWN floating dropdown in a different spot depending on where that field sat in the
   layout. Real Showdown always shows results in one fixed panel regardless of which field you're
   editing. Also wanted the Stat Points editor to look like Showdown's EV sliders, with real
   validation (32/stat, 66 total) and the nature-boost/lower highlight carried into the new layout.
   - **`PokemonEditor` now owns one `activeField` state**
     (`{kind: "species"} | {kind:"ability"} | {kind:"item"} | {kind:"move", slot} | null`) instead of
     four independent `SearchableSelect` instances. Species/item/ability/move are now plain labeled
     `<input>`s (Showdown-style "Pokémon"/"Item"/"Ability"/move labels) that set `activeField` on
     focus; ONE results panel, rendered once at the bottom of the editor, reads whichever
     option list/aria-label matches `activeField` and re-renders there — same physical spot no matter
     which field is active, matching the reference screenshots exactly. Click-outside/Escape closes it
     (same pattern `SearchableSelect` used, just scoped to the whole editor's container now). Selecting
     a result routes to the right `onXChange` callback based on `activeField.kind` and clears it.
   - `SearchableSelect` itself is now only used for the Nature field (a plain small list, no rich
     rows) — its `wide` prop was removed as dead code now that nothing else uses the component's own
     floating dropdown for content-bearing options; `content` support stays on `SearchableSelectOption`
     since `PokemonEditor`'s own shared-panel rendering (not `SearchableSelect`) is what consumes it now.
   - **Stat Points editor**: each row's SP cell now has the existing number input plus a
     `<input type="range" min={0} max={32}>` slider (`accent-zinc-600`, matching the HP-percent slider
     already used elsewhere in the app) stacked underneath. A `${total}/${max} Stat Points used` line
     sits below the table (turns red only if somehow over budget). Nature's boosted/lowered stat
     arrows (↑ green / ↓ red) are unchanged in substance, just recolored from the previous
     zinc-900/zinc-400 to make the boost/cut more legible against the new denser layout.
   - **Validation — 32/stat, 66 total — is real clamping, not just a display warning**, and is
     **opt-in via a new `maxTotalStatPoints?: number` prop**, not hard-coded into `PokemonEditor`
     itself: the Team Builder passes `66` (a real team must respect the true budget); the Damage
     Calculator passes nothing, preserving its existing, deliberate "explore builds beyond a legal
     team" behavior documented in `applyStatOverrides.ts`. `updateSp` computes the OTHER five stats'
     current total and clamps the one being edited to whatever's left of the cap (never just rejects
     the keystroke) — verified live: lowering HP's SP by 20 immediately freed exactly 20 points of
     headroom on another stat, and attempting to overshoot when there was zero headroom left clamped
     to the current value unchanged.
   - Verified: `tsc --noEmit`, `npm run lint`, `npm test` (279 passed), plus a manual browser pass
     confirming the panel renders in the same spot for species/item/move on `/team-builder`, the 66-cap
     clamps correctly there while `/damage-calc` still allows exceeding it (tested up to 98), and a
     fresh custom Pokémon starts at "0/66 Stat Points used". No console errors.
9. ✅ **Team Builder slot-strip + width pass (done 2026-09-19)** — user feedback: the 6-slot grid's
   tiles were rendering huge (stretching to fill each grid column on a wide screen, well past a
   sensible sprite size), and the editor card was too narrow relative to how much room the new results
   panel (step 9) deserves, per the same "search area should be the biggest area" principle.
   - `src/app/team-builder/[teamId]/page.tsx`'s slot strip changed from a `grid` (fluid columns,
     `aspect-square`) to a `flex flex-wrap` row of fixed `h-16 w-16` (64px) tiles — a real horizontal
     tab strip like Showdown's, not a stretched grid. Also stopped pre-rendering trailing empty
     placeholder tiles for slots beyond the next open one (nothing to click there anyway, per step
     3/4's append-only design) — only existing Pokémon + one "+" tile now, exactly matching Showdown's
     own tab bar (filled tabs, one add tab, nothing further).
   - The editor card's width cap widened from `md:max-w-xl` (36rem) to `w-full max-w-4xl` (56rem),
     and `PokemonEditor`'s shared results panel (step 9) grew from a fixed `max-h-96` to a
     viewport-relative `max-h-[65vh]` — both changes make the results area the dominant visual
     element on the page, not an afterthought below a large identity form.
   - Verified: `tsc --noEmit`, `npm run lint`, `npm test` (279 passed), plus a manual browser pass —
     64px tiles confirmed in the tab strip, the results panel confirmed to grow to fill most of the
     viewport height when there are enough options (tested with the full ~500-species list), and the
     Damage Calculator's narrower three-column layout confirmed unaffected (panel still renders
     correctly inside its column, no overflow). No console errors.
10. ✅ **4-column horizontal identity layout (done 2026-09-19)** — user feedback: "more horizontal, like
    Showdown" meant more than the tab strip/width pass above — the actual Pokémon/Item/Ability/Moves/
    Stats fields should sit side by side as four columns (Pokémon | Types+Item+Ability | 4 Moves |
    Stats), not stacked vertically inside a wide card.
    - `PokemonEditor` gained a `layout?: "stacked" | "columns"` prop (default `"stacked"`, i.e. the
      exact prior behavior, zero risk to the Damage Calculator which never sets it). Every field
      (species input, item input, ability input, stat table, nature, per-move inputs) is now built
      once as a local JSX variable and _composed_ differently per layout, rather than duplicating each
      field's markup — `"stacked"` arranges them exactly as before; `"columns"` arranges them into a
      `grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1.4fr]` (the stats column gets extra width since it alone
      has four sub-columns — Stat/Base/SP/Final — versus a single input for the others). The shared
      results panel (step 9) is unchanged and still renders once, full-width, below everything,
      regardless of layout.
    - `computePokemonBuild`'s `PokemonBuild` gained a `types: string[]` field (mega-aware, via the same
      `abilityFormKey` already computed for the ability list) so the "Types+Item+Ability" column can
      show type badges — nothing else needed adding, since item/ability data was already there.
    - Team Builder's `[teamId]/page.tsx` passes `layout="columns"` and widened its card from
      `max-w-4xl` to `max-w-6xl` so the 4 columns (plus the wider stats column) have room to breathe —
      confirmed live that the stat table's "Final" column, initially clipped at `max-w-4xl`, is fully
      visible after the widen.
    - **Process note**: mid-verification, the _previous_ session's dev server (from the step 10/11
      browser checks) turned out not to have actually died — `pkill -f "next dev"` matches the
      `node .../next dev` parent but not its `next-server (vX)` child, which had been silently serving
      stale code on port 3000 across multiple later `npm run dev` invocations (each one silently fell
      back to port 3001 instead, logging `⚠ Port 3000 is in use`/`⨯ Another next dev server is already
running` — worth actually reading the dev server's own log output when a change doesn't show up
      in the browser, rather than assuming the code is wrong). Killed both PIDs explicitly and
      confirmed a clean restart before concluding the type-badge lookup was correct all along (a tight
      `zoom` crop had also independently cut the badge out of an earlier screenshot — two unrelated
      false alarms, not one bug).
    - Verified: `tsc --noEmit`, `npm run lint`, `npm test` (279 passed), plus a manual browser pass
      against a genuinely fresh dev server — all 4 columns render side by side with the full stat table
      visible, the type badge appears correctly for a Mega form (Raichu + Raichunite Y → Electric, the
      mega-aware form key), the shared results panel still opens in the same place below the grid, and
      `/damage-calc`'s stacked layout is pixel-identical to before. No console errors.
11. ✅ **Click-to-edit Stat Points, `"columns"`-only (done 2026-09-19)** — user feedback: the always-
    visible Base/SP-slider/Final table doesn't fit a quarter-width column at a glance; Showdown itself
    only shows that detail once you click in to edit, and the compact "Stats" summary should reuse the
    same shared-panel space every other field's search results already use.
    - `ActiveField` gained a `{ kind: "stats" }` variant (no params, unlike `move`'s `slot`) — set by a
      new `statsSummary` block: a clickable compact list (label + Stat Points per row, "–" for 0,
      nature ↑/↓ carried over unchanged from the full table) that replaces `statSection` in the
      `"columns"` layout's 4th column. Clicking it doesn't open a _new_ kind of panel — it just makes
      `resultsPanel` (the same shared container every other field already renders into) show
      `statSection` (the existing full slider table, unchanged) instead of a search-results list.
      Closes the same way every other field does: click-outside or Escape, no bespoke "Done" button.
    - `"stacked"` (Damage Calculator) never sets or reads `{ kind: "stats" }` — nothing there renders
      `statsSummary`, so its always-visible full table (Stage column included) is untouched. This is
      deliberate, not an oversight: that tool's workflow depends on glancing at live stats while
      adjusting weather/field conditions, so hiding them behind a click would be a regression there,
      even though it's exactly right for the Team Builder's tighter 4-column layout.
    - Verified: `tsc --noEmit`, `npm run lint`, `npm test` (279 passed), plus a manual browser pass —
      compact summary renders correctly (confirmed against the real build: HP 30, Atk ↓ "–", Def 10,
      SpA "–", SpD "–", Spe ↑ 26), clicking it opens the full slider editor in the shared panel with a
      highlighted "selected" border on the summary, editing a slider there updates live, Escape closes
      it and restores the compact view with the edited values intact, and `/damage-calc` is unaffected.
      No console errors. (Also hit and fixed a second, unrelated instance of the same stale-dev-server
      problem noted in step 12 — this time doing a full `ps aux` sweep and `rm -rf .next` before
      restarting, rather than trusting `pkill` pattern-matching again.)

12. ✅ **Resumed for 0.2: in sync with the app, wired into My Teams (done 2026-10-28)** — user
    feedback: support localization, keyboard control like the Damage Calculator's form, a UI in
    sync with the rest of the app, Import/Export, copy/paste one Pokémon, removing Pokémon, picking
    a regulation; the `/team-builder` landing list was redundant with My Teams.
    - **Routes**: `/team-builder` now _creates_ a team (no list). It's an unsaved draft
      (`createTeam("", …)` in state) until its first Pokémon, then `useMyTeams().addBuiltTeam`
      saves it and `window.history.replaceState` moves the address to `/teams/[id]/edit` without
      remounting (so the keyboard flow isn't interrupted). `/teams/[id]/edit` edits a saved team,
      linked by "Edit Pokémon" above the roster on its Team Report; My Teams has "Build a team"
      (desktop header, and a line under the Add team dialog's paste form). Both stay behind the
      `teamBuilder` flag (`useFeatureEnabled`, same rule as FeatureGate). The old
      `/team-builder/[id]` redirects to the edit page. `addBlankTeam` is gone.
    - **One shared component**, `src/components/TeamBuilder/`: name + regulation select +
      a back link (the team's page once saved, else My Teams; no Done button), one Import / Export dialog (the team's text to copy, or paste a team over it and Save), the slot strip (tabs; ← / → / Home / End), and the editor
      card: the Damage Calculator's `PokemonSetPicker` (species and saved sets, limited to the
      regulation via its new `speciesKeys` prop) with Copy / Import / Export (one dialog per Pokémon, like the team's) / Remove beside the Stats heading, Ctrl/⌘+Delete to remove, then
      `PokemonEditor layout="columns"`. Outside a text field, Ctrl/⌘+C copies the selected Pokémon
      and Ctrl/⌘+V pastes one into the selected slot (a whole team opens Import with it).
    - **`layout="columns"` reworked** to the calc's controls: the `SearchableSelect` dropdowns
      (`FLOW_FIELD`, so Enter moves on: Pokémon → item → ability → moves → Stat Points → nature),
      keeping each option's detailed row (only the calc strips them). Item/ability/moves on the
      left, the full stat table (nature on its footer) on the right. The step 14 stats summary and
      the step 9 shared results panel are no longer used by it (the panel stays for a non-simple
      stacked editor).
    - **Regulation**: the select sets the team's first `regulationIds` entry (other tags stay);
      `computePokemonBuild`/`PokemonEditor` take the regulation for items (`regulationId` prop),
      and `getRegulationLegalityIssues` rings any illegal Pokémon and lists why.
    - **Removing a Pokémon** (§15's old deferral): `src/lib/rosterSlots.ts` shifts every saved
      position — the team's combinations and `pokemonNotes` (`teamWithoutSlot`), your side of
      each matchup plan and its Plans B+ (`matchupPlanWithoutSlot`; their picks point at their
      roster and stay), and logged games' `myPicks` (`tournamentWithoutSlot`) — clearing picks of
      the removed one. `removePokemonEverywhere` applies it to your opponents, tournaments and
      prep-group plans (`getMyGroupPlans`), pulling the cloud copies first when signed in. A
      saved team asks to confirm; a draft removes in place.
    - **Fixed on the way** (also in the calc): `SearchableSelect` opened highlighting the first row
      when the current pick's label carried a note ("(Hidden Ability)", "(Mega Stone)"), so Enter
      replaced it. It now takes `selectedId`, and keeps the current pick listed when unfiltered.
    - All builder text is in `messages.teamBuilder` (English and Spanish).

13. ✅ **Showdown-style form and results area (done 2026-10-28)** — user feedback on step 16: the
    dropdowns over each field should be one selection area, like Showdown's, under a more
    compact form in three sections (the Pokémon, moves, stats).
    - New `src/components/TeamBuilder/BuilderEditor.tsx` replaces step 16's `PokemonSetPicker` +
      `PokemonEditor layout="columns"`: the Pokémon section (sprite with its types and Mega
      toggle beside it; Pokémon, Ability and Item in one row underneath), Moves (four fields) and Stats (compact bars and Stat Points; click or Enter opens
      the table) side by side from `md`, stacked on phones. The focused field's options list in
      ONE area below: its current pick pinned on top, then headed groups (Mega Stones / Items,
      Abilities / Hidden Ability, Moves), filtered as you type, capped at 150 rows. Its own
      keyboard flow: ↑ / ↓ highlight, Enter picks and focuses the next field (Pokémon → ability →
      item → moves → stats, the order they're shown in); Enter on an untouched field keeps its value (never re-picks the
      species, which would start a blank set); clicking a row also moves on. The stats area is
      `PokemonEditor layout="stats"` (just the table + nature) inside a `FLOW_ROOT`.
    - Option lists reuse `localizedOptions` (now exported, per regulation) and
      `computePokemonBuild` (now also returning `megaStones` and `hiddenAbility` for the
      headings). `layout="columns"` is gone; the calc's dropdowns are name-only again.
    - **Mega Stones and abilities** (user feedback): the ability is always the _base_ form's
      (`computePokemonBuild(…, mega=false)` for the options, `pokemon.ability` as the value) —
      that's what a team sheet lists and the export writes; the area says "Will be X after Mega
      Evolving" above the list. A "Mega" toggle (view only, per slot) switches the sprite, types
      and stats between the forms. A saved ability the base form can't have (a Mega's, from an
      older save) is pinned with an Illegal tag and outlines the field in red.
    - **Search filters** (user feedback, like Showdown's): in the Pokémon and move fields, typed
      text that starts a type's name (translated or English) — or, for moves, a category's —
      offers it as a "Filters" row on top. Picked, it becomes a chip above the list and narrows
      it (`passes`: species types from `speciesTypes.json`, move type/category from
      `moves.json`); filters stack (AND), the chip's × or Backspace in the empty field removes
      one, and leaving the field clears them.
    - **Sorting** (user feedback): a "Sort:" bar over the Pokémon and move lists (`MOVE_SORTS`,
      `SPECIES_SORTS`; `sortOptions`). Text columns read A→Z, numbers high to low; a second click
      reverses; ties fall back to the name, and a missing value (a status move's power) is last
      either way. Each list keeps its sort while you move between fields; the "Filters" rows
      aren't sorted.
    - **Columns** (user feedback): from `sm` up, Pokémon and move rows are grids (`SPECIES_GRID`,
      `MOVE_GRID`, built in `speciesCells`/`moveCells` from the species/move data rather than
      the options' stacked `content`) under a sticky column header that is the sort bar;
      the sorted column is bold. Phones keep the stacked rows and a wrapping sort bar. Item
      and ability rows are unchanged.
    - **Mega rows and ability search** (user feedback): `megaRows` adds each of the regulation's
      Mega forms right after its base species (id = the form key from `candidateFormKeys`, e.g.
      "raichu-mega-y"; `MEGA_ROWS` maps it to its base key, stone and Mega ability). Picking one
      sets the base species holding that stone — the same Pokémon keeps its set, another starts
      a blank one. A Mega Stone holder's Pokémon field shows the Mega's name and pins its row.
      Typed text also matches a row's abilities (`speciesAbilities`, translated or English), and
      abilities starting with it are offered as filters (kind `"ability"`, up to four).
    - **Learnsets** (user feedback; supersedes §15's "no learnset validation" for the builder):
      `scripts/generate-learnsets.mjs` (`npm run generate:learnsets`) writes
      `src/data/learnsets.json` from `@pkmn/dex` — per species key, the moves.json keys it learns
      in any generation, pre-evolutions included, minus nonstandard ("Past") moves; a form without
      its own learnset uses its base species'; Megas are skipped (sets store the base species).
      @pkmn/dex has no Pokémon Champions movepools, so this is an approximation (Raichu gets a
      few, like Attract, that Showdown's Champions list doesn't show). Compact (indexes into one
      move list, ~350 KB) and loaded with a dynamic `import()` only by the builder. The move list
      shows only learnable moves, with "Show all moves" to lift it (kept while editing that slot);
      a saved move outside the learnset is pinned as Illegal and its field outlined red. Species
      the data doesn't cover (some forms, e.g. Minior colors) list every move.
    - **Admin learnset corrections**: `/admin/learnsets` (admin-only, English like the other
      admin pages; linked from /admin/features) — search a species, see its moves, Remove /
      Restore generated ones and Add any other. Saved per click to `appConfig/learnsetOverrides`
      (`{ [speciesKey]: { add?, remove? } }`, `saveLearnsetOverride` merges one species; the
      existing `appConfig` rule already makes it public-read/admin-write, no rules deploy).
      `src/lib/learnsets.ts` owns loading and applying them: learnable = generated + add −
      remove (`learnableMoves`), kept minimal by `withMove` (a generated move only ever in
      `remove`, any other only in `add`; an empty override is deleted). The builder reads them
      through `useLearnsetOverrides` (one fetch per session, like the feature flags).
    - Saved calc sets aren't offered in the builder any more (step 16 had them through
      `PokemonSetPicker`).

## 15. Deferred / explicitly out of scope for this phase

- _(Done in step 16: wiring into My Teams, removing a Pokémon, Import/Export, regulation-aware
  species and items.)_
- **Reordering or duplicating a slot** — removal's position shifting (`src/lib/rosterSlots.ts`)
  is the model to follow for a reorder (a permutation instead of a removal).
- Import replaces the roster outright, so saved picks keep their positions rather than following
  the Pokémon — the dialog says so. Matching by species could carry them over.
- Turning the `teamBuilder` flag on for everyone.
- Per-species learnset validation for the move picker (the app doesn't enforce this anywhere today —
  see PLANNING.md's move-options comment in `RosterPokemonPicker.tsx`).
- IVs, Shiny, Tera Type editing — not modeled anywhere in this app (Pokémon Champions has no IVs; Tera/
  Shiny are parsed-but-unused today per PLANNING.md §4).
