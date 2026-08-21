# VGC Match Planner — Project Plan

This is the living source of truth for what this app is and how it's built. Update it as decisions
change — it should always reflect the current plan, not the history of how we got there (that's what
git log is for).

## 1. Vision

A personal tool for planning Pokémon VGC matchups. You paste your team once (Pokémon Showdown export
format), then build up a list of opponent teams you expect to face (also via paste — e.g. from
tournament reports, Poképaste links, or scouting). For each opponent you sketch out one or more named
game plans: which two of your own Pokémon you lead with, which two you hold back, and freeform notes
on how the matchup plays out.

It's modeled directly on the spreadsheets VGC players already use for this (opponent roster icons +
lead/back columns + a notes column), rebuilt as a proper app with Showdown-paste import and official
sprite art instead of manual copy-pasting icons into a spreadsheet.

## 2. Decisions

Recorded so we don't re-litigate them each session. Revisit only if something concrete changes.

- **Persistence: browser-only, no backend.** Data lives in **IndexedDB** (not raw `localStorage` —
  more headroom than 5MB, async, and better suited to structured records). No login, no server, no
  sync across devices. This is a single-user, single-browser tool for now.
- **Multiple saved "My Team"s, switchable, with one shared Opponents list.** Originally there was a
  single active team. Per a 2026-08-08 user request, you can now save several of your own teams (e.g.
  one per tournament/format) and switch which is active from the header. The opponent roster/label/link
  stays shared across all your teams — scouting an opponent isn't tied to which of your teams you're
  using — but each opponent's lead/back picks + notes are specific to whichever team is active, since a
  pick is an index into *that* team's roster. See [Data model](#3-data-model)'s `plansByTeamId`.
- **One plan per opponent, not multiple named plans.** Originally each opponent could have several
  named plans ("Plan A", "Plan B") behind an expand/collapse. Reworked per a user-provided mock-up into
  a single flat row per opponent — roster, lead pair, back pair, and notes always visible, no plan name,
  no accordion. Simpler and denser; revisit if multiple strategies per opponent turns out to be needed
  after all.
- **Showdown export paste is the only import method for now.** No manual team builder UI, no
  Poképaste API integration (the user pastes the exported text themselves, even if it originated from
  a Poképaste link). The one exception (2026-08-08): a **bulk import** for opponents accepts a Showdown
  *team folder* export — multiple teams in one paste, each preceded by a `=== [format] Name ===` header
  (what Showdown's teambuilder produces when exporting a whole folder) — and creates one opponent per
  team (`parseTeamFolder`, `addOpponentsFromFolder`). Entries that fail to parse into a valid 1-6
  Pokémon team are skipped with a reason shown, rather than blocking the whole import.
- **Sprites are self-hosted under `public/pokemon-sprites/thumbnails-compressed/`, sourced from
  [HybridShivam/Pokemon](https://github.com/HybridShivam/Pokemon).** Originally fetched live from
  `raw.githubusercontent.com`; switched to vendored local assets (2026-08-09) to drop the runtime
  dependency on that repo staying up/reachable, and pre-compressed (156×156, palette-encoded PNGs via
  `pngquant`) since the originals are full-resolution (~1280×1280, ~135KB each). Naming convention per
  that repo's README, unchanged: base forms are `{dexId, zero-padded to 4 digits}.png`; alternate forms
  are `{dexId}-{FormName}.png` where `FormName` is Capital-Cased and dash-delimited (e.g. `0006-Gmax`,
  `0254-Mega`, `0800-Dawn`, `0025-Rock-Star`).
  **`<Image>` uses `unoptimized` for these in `PokemonSprite`.** Diagnosed 2026-08-10: sprites were
  slow to appear on the Vercel deployment (fine on localhost). Root cause — these are already
  pre-compressed (~6KB avg) static files, but were still being routed through Next's Image
  Optimization pipeline, which re-processes every unique size on-demand via a serverless function and
  is subject to Vercel's optimization concurrency/rate limits; a page with a dozen+ opponent teams
  loads 70+ sprites at once. `unoptimized` serves them straight from `public/` via the CDN instead —
  no re-processing needed since they're already the size/format we want.
- **Icons are inline SVGs (`src/components/Icon/paths.ts`), not the `material-symbols` icon font.**
  Diagnosed and fixed alongside the sprite issue above — the font shipped the *entire* Material
  Symbols Outlined glyph set as one ~3.8MB woff2 for the 6 icons actually used (`Icon` component
  reads `IconName` → path data). Combined with the font's `font-display: block`, this meant a real
  chance of the raw icon name (e.g. "more_vert") staying visible as literal text for several seconds
  on a cold Vercel visit — again fine on localhost, bad on a real network. Path data was extracted
  from `@material-symbols/svg-400` (individually-optimized per-icon SVGs from the same source as the
  font) rather than hand-drawn. The `material-symbols` package was removed as a dependency entirely.
- **Species→image resolution needs a static lookup table, not runtime PokeAPI calls.** Showdown
  species names don't map 1:1 onto the image repo's form suffixes, and we want this to work offline
  and without rate limits. Build the mapping once (script, checked-in JSON), not on every render.
- **Team/Pokémon data also captures ability, moves, nature, and EVs.** Originally species + item only.
  Per a 2026-08-08 user request (hover-to-see-info on a sprite), `parseTeam` reads `Ability:`,
  `- Move` lines, `X Nature`, and `EVs:` when present in the pasted block. Ability and moves stay
  purely display-only. There's deliberately no IVs parsing — see below. Shiny and Tera Type remain
  unparsed. `rawPaste` is still kept on the `Team` so the full text isn't lost.
- **This app targets Pokémon Champions specifically, which changed stat training — no IVs, EVs
  replaced by Stat Points.** Verified 2026-08-09 (had first implemented this assuming the classic
  0-252 EV / 0-31 IV system, which was wrong for this game — see commit history). Pokémon Champions:
  removed IVs entirely (every Pokémon is always 31 in every stat — not even Trick Room teams can lower
  Speed IV anymore); replaced EVs with Stat Points (0-32 per stat, 66 total, 1 SP = 8 classic-EV
  equivalent). Showdown-style paste text still labels the line `EVs:` (same as how it's long reused
  that label for Let's Go's unrelated "Award Values") — the numbers in it are Stat Points, not EVs.
  `calculateFinalStats` converts (× 8) before applying the stat formula; IVs are hardcoded to 31, not
  parsed at all (nothing would ever populate an `ivs` field, so there isn't one).
- **Final (Level 50) stats are computed client-side from Stat Points/nature + a generated base-stats
  table, for the hover card.** Per a 2026-08-09 user request ("for Pokémon Champions" — always Level
  50). `scripts/generate-species-data.mjs` now also emits `src/data/baseStats.json`
  (`{hp,atk,def,spa,spd,spe}` per base stat, keyed identically to `species.json` so a held Mega Stone
  resolves to the same form's stats as its sprite — both go through the same
  `candidateFormKeys(species, item)` helper). `src/constants/natures.ts` has the 25 nature
  increased/decreased-stat pairs; `src/lib/stats/calculateFinalStats.ts` applies the standard
  Pokémon stat formula at Level 50 and flags the nature-boosted/lowered stat for the hover card to
  color red/blue. A missing EVs line defaults to 0 Stat Points per stat. This is *not* the "automatic
  damage calculation" or "speed tier charts" still listed as out of scope below — it's just a single
  Pokémon's own computed stat line, no cross-matchup comparison or type-effectiveness math.
  **Held-item stat modifiers are in scope for exactly one case so far: Choice Scarf's ×1.5 Speed.**
  Per a 2026-08-11 user request. Applied in `calculateFinalStats` after the nature multiplier (its own
  modifier slot, same as in-battle — a held Choice Scarf is invisible on the in-game stat *screen*,
  only affects actual battle speed, which is what this hover card cares about). Sets
  `speedBoostedByChoiceScarf` on the returned `FinalStats` so the hover card can bold SPE — bold is
  independent of the existing red/blue nature coloring (a neutral-nature scarfed Pokémon shows plain
  bold black SPE; a nature-boosted one shows bold *red*), so the two signals stack instead of
  colliding. Choice Band/Specs (Atk/SpA) aren't implemented — only Scarf was asked for.
- **Hover card redesigned to a two-column layout** (`PokemonHoverCard`), per the same 2026-08-11
  request, mockup-driven: left column is name + Mega badge, ability (no longer labeled "Ability:",
  just shown directly under the name), then the stat grid split into two sub-`<dl>`s (HP/DEF/SPD |
  ATK/SPA/SPE) with a vertical divider between them — matches how VGC players actually read a stat
  screen. Nature/EVs (present in the old layout, absent from the mockup) were kept, tucked below the
  stats in small muted text, rather than dropped — the mockup was a style reference, not a scope cut.
  Right column is moves, each rendered as its own filled pill/box instead of a bulleted list. Card
  widened from `w-48` to `w-80` to fit two columns without cramming.
  **The Mega toggle is a `<span role="button">`, not a real `<button>`.** Fixed 2026-08-11: a real
  `<button>` there triggered "`<button>` cannot be a descendant of `<button>`" and a hydration
  mismatch, because a Mega-holding Pokémon selected as a Lead/Back pick renders this whole card via
  `PokemonHoverCard` *inside* `PokemonSlotPicker`'s own `<button>` trigger. Same pattern (role="button"
  + tabIndex + Enter/Space handling) as elsewhere in the codebase where a button-like control has to
  nest inside a real button.
- **`OpponentCard`'s edit/delete buttons moved from an absolutely-positioned overlay in the card's
  top-right corner into the roster column's own label row, and the Poképaste link became an icon
  (`IconName.OpenInNew`) instead of underlined text.** Per 2026-08-11 user requests/mockups, in two
  passes: label + Poképaste icon-link (only rendered when present) sit in one sub-row on the left,
  edit + delete in another sub-row pushed right — not all four run together, since the icon-link
  belongs with the name, not with the destructive/edit actions. Dropped the now-unused `relative` on
  the `<li>` (only existed for the old absolute overlay).
  **All four column headers (`COLUMN_TITLE_CLASSES` + the roster label row) now share a fixed `h-7`
  height with `items-center`.** The label text and the `LEAD`/`BACK`/`GAME PLAN` headers use identical
  typography, but the label row also holds `h-7` (28px) icon buttons — a mismatched-height flex row
  (16px text next to 28px buttons) can't be made to align both "text flush with plain-text headers"
  *and* "icon glyphs centered on the text" at the same time with alignment tricks alone (tried
  `items-start` first: fixed the text-vs-headers alignment but then the icons looked off against each
  other, since a lone icon-button sub-row and a text+icon sub-row don't share a natural center).
  Giving every header the same explicit height and centering within it sidesteps the conflict — text
  and icons across all four columns land on one shared center. Verified via `getBoundingClientRect`:
  the Poképaste/edit/delete icons and the "Lead" header center all measured 195px.
  **The opponent label is capped with `max-w-28 md:max-w-36 lg:max-w-xs` + `truncate`, not just
  `truncate` alone.** Fixed 2026-08-11 — the roster column is `grid-cols-[auto_...]` (sized to the
  fixed-size sprite grid, a deliberate earlier change), and CSS Grid's `auto` track sizes to the
  *widest* content in that column. `truncate` alone (`overflow-hidden` + `nowrap`) doesn't reduce an
  element's contribution to that sizing — only an actual `max-width` does — so a long opponent name
  was stretching that `<li>`'s first column past the sprite grid's own width, and since every opponent
  is a separate `<li>` (not sharing grid tracks with sibling rows), each row's columns ended up a
  different width depending on its own label length — the misaligned-columns-between-rows bug in the
  screenshot, not just a cosmetic overflow. Capping the label's `max-width` fixes both at once: it
  truncates on its own, and it stops contributing an unbounded width to the column's auto-sizing, so
  every row's column now lines up. `title={opponent.label}` added so the full name is still available
  as a native hover tooltip since truncation hides part of it.
- **Viewport-safe positioning extracted into a shared `useViewportSafePosition` hook**
  (`src/hooks/`), reused by both `PokemonHoverCard`'s popover and `PokemonSlotPicker`'s Lead/Back
  dropdown. Fixed 2026-08-12 — the dropdown had been plain `absolute top-full`, no viewport-edge
  awareness, so on narrow viewports (Lead/Back pickers near the left edge especially) it spilled off
  the left side of the screen — the same class of bug `PokemonHoverCard` already had a fix for
  (measured position, clamped to the viewport, re-measured every animation frame while open — see the
  hook's own doc comment for why every-frame). Rather than re-implement that in `PokemonSlotPicker`,
  extracted the existing (already-verified) logic out of `PokemonHoverCard` into a hook both use.
- **`MyTeamHeader`'s active-team sprite row is responsive (`h-8 w-8` mobile → `md:h-12 md:w-12`),
  using `fill` mode like `TeamRoster`, instead of a fixed `size={36}` on `PokemonSprite`.** Fixed
  2026-08-12 — 6 fixed 48px sprites + a 28px chevron + header padding/gap never shrank on mobile,
  overflowing the header horizontally on real narrow viewports (confirmed on an iPhone 14 Pro
  Max/430px emulation) and pushing a scrollbar/white gap onto the page. `PokemonSprite`'s `size` prop
  is a fixed number, not breakpoint-reactive — needed to switch to `fill` mode (sized purely by the
  wrapping element's CSS) to make it responsive at all. Also shrank the chevron icon and the item-icon
  badge, and tightened the header's own `px-6`/`gap-4` to `px-4`/`gap-2` on mobile for extra margin.
  Verified via direct DOM measurement (`getBoundingClientRect`, `scrollWidth` vs `innerWidth`) rather
  than only visual screenshots, since this session's browser-resize tool was unreliable for hitting an
  exact narrow width.
  **Follow-up same day:** the team-switcher `<button>` also had `w-full md:w-auto`, stretching its
  clickable/hoverable box to fill the header's entire remaining flex space (measured ~357px) even
  though the visible sprite row only needed ~240px — harmless for the overflow bug itself, but a
  misleadingly large hit area with dead space reacting to hover/click as if it were content. Dropped
  `w-full`/`md:w-auto`/`md:items-start` entirely; the button now sizes to its actual content on every
  breakpoint. Confirmed via `getBoundingClientRect`: button width dropped from ~357px to ~236px.
  **Second follow-up:** shrinking the button didn't move it — it's wrapped in `<div ref={menuRef}>`,
  which still had `flex-1` (a flex *item* greedily fills its container's free space regardless of the
  content inside it, so `justify-end` on the parent had nothing left to redistribute). Removed
  `flex-1`/`md:flex-none` from that wrapper and added `justify-end` to *its* parent so the now
  content-sized wrapper gets pushed flush against the header's right padding instead of hugging the
  left. This broke the team-select dropdown's width, which had relied on that wrapper being wide
  (`left-6 right-6` stretched it to the wrapper's width minus 24px each side) — first attempt swapped
  it for `right-0 w-72`, but that anchors the dropdown to the (now narrow) trigger, not the full page
  width — wrong per a follow-up screenshot: the dropdown is deliberately full-width on mobile
  (independent of where the trigger sits), aligned to the *page's* padding, not the trigger's.
  **Third follow-up:** moved `relative` onto the `<header>` itself (still spans the full page width
  regardless of the trigger) and repointed the dropdown at it: `left-4 right-4` on mobile (matching the
  header's own `px-4`, so the dropdown's edges land flush with where the title/sprite-row content
  itself starts/ends) and back to the original `md:left-auto md:right-6 md:w-96` on desktop. Verified
  the "gap" in a follow-up measurement was the page's own scrollbar width (`clientWidth` vs
  `innerWidth`), not a leftover bug — dropdown's right edge matched the header's real layout width.
- **The opponent notes textarea auto-grows to fit its content, up to a cap, then scrolls internally.**
  Fixed 2026-08-11 (`OpponentCard`) — a ref + effect resets `style.height` to `"auto"` then to
  `scrollHeight` on every `notes` change; `resize-y` was dropped (fighting the auto-grow) in favor of
  `resize-none` + `min-h-16`/`max-h-32` so it starts at roughly two rows, grows with short notes, and
  for long notes scrolls (`overflow-y-auto`) inside that cap instead of growing the whole card (first
  attempt) or silently clipping content with no way to see the rest (the bug actually reported).
- **`TeamRoster`'s sprite size is fixed (not responsive) from `md:` up; only mobile still auto-shrinks
  to fit.** Landed 2026-08-11 after an earlier attempt (`md:grid-cols-3` only, no `lg:` tier) got
  reverted for changing desktop too. The constraint that makes this need two breakpoints: the roster
  column is a fixed `26rem` from `md:` up with no further width change on its own (`OpponentCard`'s
  `md:grid-cols-[26rem_auto_1fr]`) — so "tablet" and "desktop" are the *same* width unless something
  else changes it. Mobile (base, single-column stacking) keeps the original `aspect-square w-full` +
  `grid-cols-6`, which auto-shrinks to always fit exactly 1 row regardless of viewport — already
  correct, left untouched. From `md:` up, sprites switch to a real fixed size (`md:h-16 md:w-16`,
  64px, no longer scaling with the grid): at `md:` alone the roster grid goes `md:grid-cols-3` (2
  rows) since 6×64px doesn't fit the 26rem column; at `lg:` the grid goes back to `lg:grid-cols-6` (1
  row) and `OpponentCard`'s column widens to `lg:grid-cols-[30rem_auto_1fr]` specifically so 6×64px
  sprites actually fit there. Verified at 1800px (lg, 1 row @ 64px), 900px (md, 2 rows @ 64px — same
  size), and ~500px (mobile, 1 row, auto-shrunk) via `resize_window` + reading computed tile size.
- **Item icons come from PokeAPI's sprite repo, resolved by guessing a kebab-case URL — no static
  table.** Unlike species (which need a dex id lookup), PokeAPI's item sprite filenames are just the
  item's normalized slug (reusing `normalizeSpeciesKey`, which was already written generically enough
  for this). `resolveItemImage` always returns a best-guess URL; an `ItemIcon` component falls back to a
  placeholder on image load error (404) rather than pre-validating against a table, since building one
  wasn't worth it for icons this simple.
- **Mega Evolution: a per-Pokémon toggle in the hover card (opponent rosters only) switches between
  base and Mega sprite+stats.** Per a 2026-08-10 user request. `PokemonHoverCard` detects a held Mega
  Stone via `candidateFormKeys(species, item).length > 1` and, when true, shows an interactive "Mega"
  badge; toggling it swaps both the computed stats (via an `item`-stripped `ParsedPokemon` into
  `calculateFinalStats`) and the sprite (via a `children: (showMega) => ReactNode` render-prop so
  `TeamRoster`'s wrapped `PokemonSprite` can react to the same state). `PokemonSprite` gained an `item`
  prop for this — previously no sprite anywhere in the app ever accounted for a held Mega Stone, an
  unrelated pre-existing gap fixed as a side effect.
  **`MEGA_STONE_SUFFIX_BY_ITEM` (`src/constants/megaStones.ts`) covers all 55 Mega Evolutions in
  Pokémon Champions, not just the original ~46 from Gen 6/7 (X/Y, ORAS).** Verified 2026-08-10:
  Champions added most of the extra 9 via Pokémon Legends: Z-A (e.g. Mega Froslass, Mega Dragonite,
  Mega Staraptor, Mega Meganium) — real, official content, not user typos. Initially assumed our
  sprite set and `species.json`/`baseStats.json` (both generated pre-Champions) wouldn't have art/stats
  for any of these — wrong: turned out every one of the 55 already has a matching sprite file and data
  entry (PokeAPI's bulk export, whenever it was pulled, already included them), so the item table was
  the *only* missing piece — without the right key here, `candidateFormKeys` never builds the
  `<species>-mega` candidate to look up. Extended the table to all 55, verified against Bulbapedia (each
  has its own dedicated page) and cross-checked against real pasted items from this app's own data.
  Two related `SPECIES_ALIASES` additions were needed too: Meowstic's Mega forms are gendered
  (`Female-Mega`/`Male-Mega` formSuffix, not `Mega-Female`/`Mega-Male`, so the naively-built candidate
  key doesn't match), and Floette's Mega form is keyed as plain `floette-mega` (only the Eternal Flower
  form can Mega Evolve, so it's unambiguous) while Showdown writes the species as `Floette-Eternal`.
  Also fixed a genuine bug found in the same pass: the table had `blastoisite`, but Blastoise's real
  item is `Blastoisinite` (verified against Bulbapedia) — silently broke detection for every Blastoise
  until fixed. `isLikelyMegaStoneItem` (same file) still exists for whatever Mega Stone comes *after*
  this table's last update — recognizes the universal `<species>ite` naming convention and the hover
  card shows a disabled "Mega?" badge with an explanatory title instead of silently showing nothing.
  One known gap that can't be fixed via this item-based approach at all: Mega Rayquaza has no held-item
  requirement in the actual games (Mega Evolves by knowing the move Dragon Ascent instead).
- **Opponent record: label + 6 Pokémon (species+item) + paste link.** Dropped the `replicaCode` field
  from the earlier draft — it wasn't part of this request. Add it back if it turns out to be needed.
- **`leadPair`/`backPair` are a fixed 2-tuple of independently-nullable slots, not `[number,number] |
  null`.** The all-or-nothing shape looked cleaner on paper but silently discarded the first pick: a
  UI that only commits the pair once both slots are set has nowhere to hold "just picked slot 1,
  haven't picked slot 2 yet" — the in-progress selection gets thrown away on the very next render.
  Caught this by actually driving the picker in a browser, not just from reading the code.
- **Single page, not three routes.** Originally built as `/`, `/opponents`, `/opponents/[id]` with a
  nav bar. Reworked into one page (`/`) with My Team at the top and an Opponents accordion below —
  each opponent row expands in place to show its roster and game plans, instead of navigating away.
  Explicit user request: a single simple flow, not a multi-page app. The `NavBar` is gone since there's
  only one page to navigate to.
- **My Team moved into a sticky header, edited via a dialog.** Per a user-provided mock-up: the team
  paste/roster no longer lives inline on the page — it's a persistent bar pinned to the top of the
  viewport (title left, team/actions right), and both adding and editing the team happen in a modal
  rather than an inline form. Required building a minimal `Modal` component from scratch (no dialog
  primitive existed yet in the project).
- **Storage reads normalize old-shaped records.** IndexedDB is schemaless — when `Opponent`'s shape
  changed (dropping `gamePlans` for `leadPair`/`backPair`/`notes`), records saved before that change
  were still sitting in users' browsers and crashed the app on load (`opponent.leadPair` was
  `undefined`). `db.ts`'s `getOpponents()` now runs every record through `normalizeOpponent()`
  (`opponent.ts`), which backfills any missing fields with defaults. Any future field added to
  `Opponent` needs the same treatment there, since there's no migration step otherwise — old browser
  data just keeps loading through whatever's the current shape.
- **Single color palette: `mauve` (a built-in Tailwind v4 color, `mauve-50`…`mauve-950`), no dark
  mode.** Per a 2026-08-10 user request. All prior `zinc-*` neutrals were swapped 1:1 for the
  matching `mauve-*` shade, every `dark:` variant class was removed, and `globals.css`'s
  `prefers-color-scheme: dark` block was deleted. Semantic accent colors (red for
  delete/errors/decreased-stat, blue for increased-stat, amber for warnings) are unchanged, just
  without their `dark:` variants. If dark mode comes back later, it needs a real design pass, not a
  blanket re-add of `dark:` classes.
- **"Load default set" — a one-click preset that bulk-imports a hand-picked opponent roster, offered
  only when there are zero opponents.** Per a 2026-08-10 user request, first preset is
  `regulation-m-b-m-4` (`src/data/presets/regulationMbM4.ts`) — 13 real Regulation M-B teams the user
  provided verbatim, as a Showdown team-folder export. `TEAM_PRESETS` (`src/data/presets/index.ts`) is
  a registry of `{id, label, rawPaste}`; loading one just runs `parseTeamFolder` +
  `addOpponentsFromFolder`, the same path "Mass import" already uses. Presets are meant to be
  versioned by adding a new id (e.g. a future `regulation-m-c-*`), not by editing an existing preset's
  `rawPaste` in place, since that'd silently change what "load default set" produces for anyone who
  already used it once.
- **Opponents header condensed to one primary button ("Add opponent") + a kebab "more options" menu**
  (`OpponentsSection`), per a follow-up 2026-08-10 request. The menu holds "Load default set: …" (per
  `TEAM_PRESETS` entry, only when there are zero opponents — same gating as before, just relocated),
  "Mass import" (was the standalone "Import teams" button), and "Clear all data" — a new destructive
  action (`removeAllOpponents` in `useOpponents`, backed by a new `clearOpponents()` in `db.ts` that
  does an IndexedDB store `.clear()`) gated behind a confirm modal mirroring `MyTeamHeader`'s
  confirm-delete-team pattern, disabled entirely when there are no opponents to clear.
- **Individual opponent deletion also went through a confirm modal.** Per a same-day follow-up —
  the per-card trash icon in `OpponentCard` previously called `removeOpponent` immediately with no
  guard. `OpponentsSection` now tracks `confirmRemoveId`; the trash icon sets it instead of deleting
  directly, and a confirm modal (same pattern as "Clear all data" and `MyTeamHeader`'s team delete)
  names the specific opponent and requires an explicit confirm.

### Deliberately out of scope for now

Don't build these unless asked — they'd be premature for a tool that doesn't have its core loop
working yet:

- Multi-user / auth / cloud sync
- Cross-team speed-tier comparison charts (basic single-hit damage calculation, added 2026-08-12, is
  now in scope — see §7's Damage Calculator phase)
- Editing a parsed Pokémon's fields in the UI (EVs, moves, etc.) — paste-in is the only way to change
  a team; if a paste was wrong, re-paste it

## 3. Data model

Everything below lives in IndexedDB under a single app-state object store (or a few small stores —
implementation detail, not worth over-designing before Phase 1 is built).

```ts
interface ParsedPokemon {
  species: string; // canonical Showdown species name, e.g. "Landorus-Therian" — used to resolve the sprite
  item?: string;
  ability?: string;  // display-only, for the hover card
  moves?: string[];  // display-only, for the hover card
  // Shown as pasted, but also fed into calculateFinalStats for the hover card's Level 50 stat line:
  nature?: string;
  // Raw EVs line as pasted, e.g. "32 HP / 4 SpD / 32 Spe" — despite the "EVs:" label, these are
  // Stat Points (0-32/stat) in Pokémon Champions, not classic 0-252 EVs. Missing stats default to 0.
  evs?: string;
  // No ivs field — Pokémon Champions has no IVs; every Pokémon is always 31 in every stat.
}

// hp/atk/def/spa/spd/spe base stats, keyed identically to the species→sprite table (src/data/species.json)
// so a held Mega Stone resolves the same form for both. See src/data/baseStats.json,
// src/lib/stats/calculateFinalStats.ts, src/constants/natures.ts.
interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

interface Team {
  id: string;
  name: string;              // user-facing label, e.g. "Regionals Team" — distinguishes your saved teams
  rawPaste: string;          // keep the original text around, even though most of it is unparsed for now
  pokemon: ParsedPokemon[];  // up to 6
  updatedAt: string;         // ISO timestamp
}

type PokemonSlot = number | null; // index into a Team's pokemon, or "not picked yet"

interface MatchupPlan {
  leadPair: [PokemonSlot, PokemonSlot];
  backPair: [PokemonSlot, PokemonSlot];
  leadMega: [boolean, boolean]; // per-slot Mega toggle, persisted; defaults to true via EMPTY_PLAN
  backMega: [boolean, boolean];
  notes: string;
}

interface Opponent {
  id: string;
  label: string;   // e.g. "Blastoise Delphox - LenVGC"
  team: Team;      // the 6 Pokémon (species + item, + display-only ability/moves/nature/EVs)
  pokepasteUrl?: string;
  plansByTeamId: Record<string, MatchupPlan>; // keyed by which of your Teams is planning this matchup
  createdAt: string;
  updatedAt: string;
}

interface AppState {
  myTeams: Team[];
  activeTeamId: string | null;
  opponents: Opponent[];
}
```

## 4. Showdown paste parsing

Input looks like:

```
Grimmsnarl @ Light Clay
Ability: Prankster
Shiny: Yes
EVs: 32 HP / 20 Def / 14 SpD
Calm Nature
- Foul Play
- Parting Shot
- Reflect
- Light Screen
```

Pokémon blocks are separated by a blank line. For this version we only care about **the first line**
of each block — everything else (Ability, EVs, Nature, moves, etc.) is left in `rawPaste` but not
parsed. The first line is one of:

- `Species`
- `Species @ Item`
- `Species (Gender) @ Item`
- `Nickname (Species) @ Item`
- `Nickname (Species) (Gender) @ Item`

So `parsePokemonBlock` just needs to: take the first line, strip a leading `Nickname (` / trailing `)`
if present (keep `Species`, discard the nickname), strip a trailing `(M)`/`(F)` gender marker (not
stored — see [Decisions](#2-decisions)), and split on ` @ ` to separate `species` from `item`.

Write this as a small set of pure functions (`parseTeam(raw: string): ParsedPokemon[]`,
`parsePokemonBlock(block: string): ParsedPokemon`) so they're unit-testable in isolation — nickname vs.
species vs. gender-marker parsing is still the fiddly part even in this reduced scope, so it's worth
adding a test runner (Vitest) to pin down edge cases as they're discovered, even though nothing is
configured yet.

## 5. Species → image resolution

`resolveSpeciesImage(species: string, item?: string): { dexId: number; formSuffix?: string; imageUrl: string }`

1. Normalize `species` (parser already strips nickname/gender) and look it up in a static, checked-in
   table (`src/data/species.json`) mapping normalized Showdown species name → `{ dexId, formSuffix? }`.
2. **Mega handling**: Showdown paste species names don't change when holding a Mega Stone (e.g.
   `Metagross @ Metagrossite`) — the mega form is implied by the item. Maintain a small item→suffix
   table (`Metagrossite → Mega`, `Charizardite X → Mega-X`, `Charizardite Y → Mega-Y`, etc.) and prefer
   that over the base entry when the held item matches.
3. Build the local path:
   `/pokemon-sprites/thumbnails-compressed/{dexId padded to 4}{-formSuffix?}.png`
4. **Fallback**: if the species isn't in the table (or an image 404s at render time), show a
   placeholder (e.g. a Poké Ball icon) rather than a broken image — and this is a signal the static
   table needs an entry added.

### Building `species.json` and `baseStats.json`

One-off script (`scripts/generate-species-data.mjs`, `npm run generate:species`), not a runtime
dependency — emits both files in one pass since they're keyed identically:

- Pull species/varieties/forms + per-variety base stats from PokeAPI's bulk CSV export
  (`pokemon_species.csv`, `pokemon.csv`, `stats.csv`, `pokemon_stats.csv`).
- Normalize each variety into a Showdown-style key — mostly a casing transform
  (`necrozma-dawn-wings` → `Necrozma-Dawn-Wings`), but Showdown and the image repo don't always agree
  on exactly which forms get a suffix at all, so entries will need spot-checking against real pastes
  as they come up rather than trusting the transform blindly.
- Re-run only when new Pokémon/forms exist to add (e.g. a new game release) — this is not something
  that runs per-request.

## 6. UI structure

The app lives at **`/matchup-planner`**; `/` is a server-side `redirect()` there (no UI of its own) —
so the URL says what the page is, while a bare root still works for anyone's old bookmark/link.

- **My Team header** — sticky full-width bar pinned to the top of the viewport (`MyTeamHeader`),
  always visible while scrolling the opponents list below it. Left: the app title. Right: a row of
  **team tabs**, one per saved team (mini sprite row + name), the active one highlighted; each tab has
  its own edit (pencil) and remove (trash) icon, plus a **+** button to add another team. With zero
  teams saved, the row collapses to a single "Add your team" button. Add/edit both open the same
  `Modal` containing `TeamPasteForm` (now with a **name** field alongside the paste) — pasting a team
  is always a dialog, never inline on the page.
- **Opponents** (below the header) — "Add opponent" (paste + label + optional Poképaste link) above a
  list of opponent rows (`OpponentCard`), all always visible — no navigation, no expand/collapse. Each
  row is a 3-column layout (stacks to 1 column on narrow screens): **Team** (label, Poképaste link,
  Remove, compact roster), **Lead/Back** (4 `PokemonSlotPicker`s — 2 lead, 2 back — picked from the
  *active* team's Pokémon), **Notes** (freeform textarea). The lead/back picks and notes shown are the
  `MatchupPlan` for whichever team is currently active (`getPlanForTeam`); switching teams in the header
  switches what's shown here, per opponent, without touching the opponent's roster/label.
- **Hover info** — hovering (or focusing) a Pokémon sprite that has ability/moves/nature/EVs parsed
  from its paste shows a small popover with that text (`PokemonHoverCard`). Renders nothing extra when
  none of those fields were present, so plain species+item entries behave exactly as before.
- **Item icons** — items render as a small icon (`ItemIcon`, from PokeAPI's sprite repo) next to the
  item name, everywhere an item is shown (compact and full `TeamRoster` modes).
- **Opponent search** — a search icon button next to the "Opponents" title (`OpponentsSection`) toggles a
  search box, hidden by default; closing it also clears the query. Filters opponents down to those
  holding a matching Pokémon species or item (case-insensitive substring, `pokemonMatchesQuery`).
  Space-separated terms are ANDed (`parseSearchTerms`) — "charizard scarf" only matches a team with both,
  not either — and every Pokémon matching any one term gets a highlight ring (no dimming of the rest, per
  user feedback that opacity looked worse than just ringing the matches).

## 7. Roadmap

- [x] **Phase 1 — Parsing & image resolution core.** `parseTeam` (`src/lib/parseTeam.ts`),
      `resolveSpeciesImage` (`src/lib/species/`), `species.json` generated from PokeAPI's bulk CSV
      export (`scripts/generate-species-data.mjs`, `npm run generate:species`), Vitest unit tests for
      both. No UI yet.
- [x] **Phase 2 — My Team.** Paste-in UI (`TeamPasteForm`), roster display with sprites
      (`TeamRoster`/`PokemonSprite`), IndexedDB persistence for `myTeam` (`src/lib/storage/db.ts`,
      `useMyTeam` hook). Wired into `/` (`src/app/page.tsx`).
- [x] **Phase 3 — Opponents list.** Add/remove opponents (`OpponentForm`, `useOpponents`), compact
      roster icon row per opponent (`TeamRoster`'s `compact` mode), IndexedDB `opponents` store (DB
      bumped to v2).
- [x] **Phase 4 — Game plans.** Per-opponent named plans (`GamePlanCard`) with lead/back slot pickers
      (from My Team) and notes. Add/remove plans freely.
- [x] **Single-page rework.** Collapsed `/`, `/opponents`, `/opponents/[id]` into one page: My Team
      section + an Opponents accordion (`OpponentsSection`/`OpponentCard`) where each opponent expands
      in place to show its roster and game plans. `NavBar` removed. See
      [Decisions](#2-decisions) for why.
- [x] **Sticky My Team header.** Replaced the inline My Team section with `MyTeamHeader` — sticky,
      full-width, title + team/actions. Add/edit go through a new `Modal` + `TeamPasteForm`; a trash
      icon clears the team (`clearTeam` in `useMyTeam`, `clearMyTeam` in `db.ts`).
- [x] **Opponent row rework.** Replaced the game-plan accordion with one always-visible 3-column row
      per opponent (`OpponentCard`: Team | Lead/Back | Notes), per a user-provided mock-up. `GamePlan`
      removed from the data model; `leadPair`/`backPair`/`notes` now live directly on `Opponent`.
      `PokemonSlotPicker` extracted as its own component. Caught two real layout bugs while verifying:
      a CSS grid column sized `auto` grew unbounded and squeezed the Team column until text wrapped and
      "Remove" got clipped (fixed with explicit column widths); and the Lead/Back flex row didn't wrap,
      so grid's default `min-width: auto` forced the whole page wider than the viewport on mobile
      (fixed with `min-w-0` on the row columns + `flex-wrap` on the Lead/Back row).
- [x] **Full-width layout.** Dropped the page's `max-w-6xl` cap — the Opponents section now spans the
      full viewport width, per user request. Widened `OpponentCard`'s middle column (`28rem` → `36rem`)
      so Lead's 2 pickers and Back's 2 pickers fit on one row instead of wrapping to two (they were
      wrapping because the column was too narrow, not by design). The Notes column stays `1fr`, so it
      absorbs whatever space is left and grows with the viewport.
- [x] **Bigger roster sprites + cleaner slot pickers.** `TeamRoster`'s compact sprite size went
      40px → 56px (Team column widened to `26rem` to fit); `OpponentCard`'s Team roster wraps
      (`flex-wrap`) so 6 larger icons don't force overflow. `PokemonSlotPicker` now hides its `<select>`
      once a Pokémon is picked, showing just the sprite + species name + a small "×" button that clears
      the slot back to the dropdown — the select only reappears once empty.
- [x] **Native `<select>` replaced with a custom sprite-grid dropdown.** `PokemonSlotPicker`'s empty
      state (the dashed circle) and its selected sprite are both now a `<button>` that opens a small
      `role="listbox"` panel showing the team as clickable sprite tiles (image + name), instead of a
      text-only native select. Closes on Escape, on picking a tile, or on clicking outside
      (`pointerdown` listener checked against a `ref`). Positioned `absolute` (not `fixed`), so it isn't
      affected by the header's `backdrop-filter` containing-block quirk from earlier — no portal needed
      here, unlike `Modal`.
- [x] **Picker/roster sizing + opponent item captions.** `PokemonSlotPicker`'s selected sprite went
      48px → 56px to match `TeamRoster`'s (compact) opponent roster sprites. `TeamRoster`'s compact mode
      now shows the held item (truncated, full name on hover) under each opponent Pokémon, matching
      what non-compact mode already showed for My Team.
- [x] **Phase 5 — Polish.** Verified in a real browser at desktop/mobile widths and light/dark —
      layout already held up (flex-wrap patterns used throughout meant no responsive fixes were
      needed). Added: accessible labels/`role="alert"` on all form inputs, an accessible fallback for
      unresolved sprites (`role="img"`), and clearer empty-state copy for game plans.

Anything past this (multi-device sync, damage calc helpers, etc.) is explicitly deferred — see
[Deliberately out of scope](#deliberately-out-of-scope-for-now).

The 5 phases above are the full original roadmap — the core app (paste team → paste opponents → plan
leads/backs) is complete and working end to end.

- [x] **Phase 6 — Multi-team, item icons, hover info, `/matchup-planner` route.** Per a 2026-08-08 user
      request: `/` now redirects to `/matchup-planner`, where the app actually lives. `MyTeamHeader`
      became a team switcher (`useMyTeams`, replacing `useMyTeam`) — teams get a `name`, opponents' lead/
      back/notes moved from flat fields into `Opponent.plansByTeamId` keyed by team id
      (`getPlanForTeam`), and IndexedDB was bumped to v3 with a migration that folds any existing single
      team + its opponents' picks into the new shape rather than discarding them (`storage/db.ts`).
      `parseTeam` now also captures ability/moves/nature/EVs (display-only) for a new hover popover
      (`PokemonHoverCard`) on sprites. Items get an icon (`ItemIcon`/`resolveItemImage`, PokeAPI sprite
      repo) next to their name in `TeamRoster`.
- [x] **Phase 7 — Bulk opponent import.** Per a 2026-08-08 user request: an "Import teams" flow
      (`BulkImportForm`) alongside "Add opponent" accepts a pasted Showdown team-folder export and
      creates one opponent per team in it (`parseTeamFolder`, `addOpponentsFromFolder`). Shows a live
      "Found N teams" preview while pasting, and a post-import summary noting any entries skipped for
      not parsing into a valid team.
- [x] **Phase 8 — Self-hosted sprites.** Per a 2026-08-09 user request: species sprites moved from a
      live fetch against `raw.githubusercontent.com/HybridShivam/Pokemon` to vendored local files under
      `public/pokemon-sprites/thumbnails-compressed/` (1368 files, 156×156, ~11MB total — down from
      ~180MB uncompressed), resized via `sips` and palette-quantized via `pngquant`. Only
      `resolveSpeciesImage`'s base URL and `next.config.ts`'s `remotePatterns` changed; the
      dexId/form-suffix naming convention and resolution logic are untouched. Item icons stay on
      PokeAPI's remote sprite repo.
- [x] **Phase 9 — Computed Level 50 stats in the hover card.** Per a 2026-08-09 user request: added
      `src/data/baseStats.json` (generated alongside `species.json`, same keys), the 25-nature
      increased/decreased table (`src/constants/natures.ts`), and `calculateFinalStats`
      (`src/lib/stats/`) applying the standard Level 50 stat formula against Pokémon Champions' Stat
      Points system (verified via web search after a first pass wrongly assumed classic 0-252 EVs /
      0-31 IVs — see the decision above). `PokemonHoverCard` shows the six stats above the existing
      ability/nature/EVs/moves block, with the nature-boosted stat in red and the lowered one in blue.
      Extracted `candidateFormKeys` out of `resolveSpeciesImage` so it and `calculateFinalStats` resolve a held
      Mega Stone to the same form.
- [x] **Phase 10 — Opponent search.** Per a 2026-08-12 user request: a search input above the Opponents
      list matches against Pokémon species or held item name (`pokemonMatchesQuery`), filtering the
      opponent list down to matching teams and highlighting the matching Pokémon within each
      (`TeamRoster`'s new `isMatch` prop). Shows a "no matches" empty state distinct from the "no
      opponents at all" one. Follow-up same day (twice): space-separated terms are ANDed per opponent
      (`parseSearchTerms`) so "charizard basculegion" only returns teams holding both, highlighting
      each matched Pokémon; dropped the opacity dim on non-matches (kept only the ring) per feedback
      that it didn't look good; and the search box itself is now hidden by default behind a toggle
      icon next to the "Opponents" title, rather than always shown above the list.
- [x] **`PokemonSlotPicker` hover/click conflict fixed.** A picked slot's sprite was both the click
      trigger for its own swap dropdown *and* (via `PokemonHoverCard`'s default `hover` trigger) the
      hover trigger for the stats/moves info popover — clicking to swap necessarily also hovers, so both
      popovers rendered at once and overlapped. Per a 2026-08-12 discussion, chose to keep click-to-swap
      as the primary action (that's what a picker's sprite click means everywhere else in this
      component) and suppress the info popover while the swap dropdown is open, rather than flipping to
      TeamRoster's click-to-info pattern. `PokemonHoverCard` gained a `disabled` prop that forces it
      closed regardless of hover/click state; `PokemonSlotPicker` passes `disabled={isOpen}` (its own
      dropdown's open state) so the two can never be open simultaneously.
- [x] **Hover-triggered popover now interactive.** Per a 2026-08-12 follow-up: the hover-triggered
      variant of `PokemonHoverCard` (only `PokemonSlotPicker` uses it — `TeamRoster` uses `click`) had
      `pointer-events-none` on the tooltip, so its contents (e.g. the Mega toggle) couldn't be clicked,
      and moving the mouse from the trigger into the tooltip closed it immediately — the tooltip renders
      a few px below/above the trigger (`useViewportSafePosition`), and that gap belongs to neither
      element, so `mouseleave` fired on the wrapper before the cursor ever reached the tooltip. Fixed by
      making the tooltip `pointer-events-auto` always, and closing on a short (200ms) delay instead of
      immediately on `mouseleave`, cancelled if the pointer re-enters the wrapper's subtree (trigger or
      tooltip) within that window — standard hover-intent pattern, lets the mouse actually cross the gap.
- [x] **`PokemonSlotPicker` slot size matched to `TeamRoster`'s.** Per a 2026-08-12 user report (with a
      side-by-side screenshot), the Lead/Back slot boxes were a fixed `h-14 w-14` (56px) while
      `TeamRoster`'s opponent-roster tiles are `h-16 w-16` (64px) from `md:` up — a visible size mismatch
      between an opponent's roster and your own lead/back picks sitting right next to it. Bumped
      `PokemonSlotPicker`'s trigger box (and its empty-slot placeholder) to a flat `h-16 w-16`, matching
      exactly at `md:`/`lg:`; verified via `getBoundingClientRect` (64×64 both sides) and visually at
      mobile widths too, where the roster's fluid `grid-cols-6` sizing lands within ~3px of the picker's
      fixed size — close enough not to read as mismatched.
- [x] **Header logo + `PokemonSlotPicker` Mega toggle fixed.** Per 2026-08-12 requests: replaced the
      "Matchup / Planner" text `<h1>` in `MyTeamHeader` with the user-supplied `public/resources/logo.png`
      plus a "VGC Tools" label alongside it. Separately, `PokemonSlotPicker`'s selected-slot sprite wasn't
      using `PokemonHoverCard`'s render-prop `children` pattern (`(showMega) => ...`) the way `TeamRoster`
      does — so toggling Mega in the popover updated the stats panel but never the Lead/Back sprite itself.
      Switched it to the same pattern, passing `item={showMega ? selected.item : undefined}` to
      `PokemonSprite`, matching `TeamRoster`'s existing behavior.
- [x] **Mega preference persisted per Lead/Back slot.** Per a 2026-08-12 request: the Mega toggle in
      `PokemonSlotPicker` used to reset to "on" every reload (local `useState` inside `PokemonHoverCard`).
      `MatchupPlan` gained `leadMega`/`backMega: [boolean, boolean]`, set via new `setLeadMega`/`setBackMega`
      in `OpponentCard` (mirroring `setLeadSlot`/`setBackSlot`) and persisted through the existing
      `updateOpponentPlan`/IndexedDB path. `PokemonHoverCard` gained optional `megaEnabled`/`onMegaToggle`
      props — when passed, the toggle is controlled by the caller instead of tracking its own state;
      `PokemonSlotPicker` now always passes them. `TeamRoster` (opponent rosters) still doesn't pass them,
      so its toggle stays session-only, matching what was actually asked for ("some picks" — i.e.
      Lead/Back, not every roster sprite). `getPlanForTeam` merges over `EMPTY_PLAN` so plans saved before
      these fields existed backfill to `true` (the old, always-Mega behavior) instead of `undefined`.
- [x] **Local fallback art for items missing from PokeAPI.** Per 2026-08-12 requests: the user
      hand-sourced icons for 43 of the newer Pokémon Champions Mega Stones (`public/items/mega-stones/`,
      named after `normalizeSpeciesKey` with hyphens stripped — e.g. `raichunitex.png`) plus one ordinary
      item, Fairy Feather (`public/items/fairyfeather.png`), all missing from PokeAPI's sprite repo, so
      `ItemIcon` was falling back straight to the "?" placeholder for them. `resolveItemImage` now also
      returns an optional `fallbackImageUrl` (looked up by normalized-key-with-hyphens-stripped in
      `LOCAL_ITEM_FALLBACK_IMAGES`, `src/constants/localItemFallbackImages.ts` — a flat key→path map, not
      Mega-Stone-specific, so it covers any item); `ItemIcon` still tries the PokeAPI URL first and only
      switches to the local image on a real 404 (`onError`), so the day PokeAPI adds real art for one of
      these, it's used automatically with no code change — the local entry just becomes unused for that key.
- [x] **"Opponents" → "Opposing Teams"; onboarding empty state.** Per 2026-08-12 feedback: kept "Opponents"
      as the underlying terminology (data model, hooks, aria-labels) since it's exactly how VGC players
      already talk about this — but the section's visible `<h2>` now reads "Opposing Teams", read as more
      natural sentence-level copy without the surface area of renaming everything. Separately, redesigned
      the zero-opponents empty state as a proper onboarding card (`OpponentsSection`): a dashed bordered
      panel with the app logo, a heading, a one-line explanation of what pasting a team does, the existing
      "Add opponent" / "Use default set" actions, plus a previously-buried mass-import entry point
      surfaced as a text link ("Prepping for a big tournament? Import a whole folder of teams at once").
- [x] **Onboarding card's action buttons same width on mobile.** Per a 2026-08-12 report: "Add opponent"
      and "Use default set: Regulation M-B (M-4)" sized to their own (very different-length) text, reading
      as mismatched when stacked on narrow screens. The button row is `flex-col items-stretch` (full width,
      equal) below `sm:`, `flex-row flex-wrap` (auto width, as before) at `sm:` and up.
- [x] **`MyTeamSection` added.** Per a 2026-08-12 request: a new component, mirroring
      `OpponentsSection`'s onboarding card (`src/app/matchup-planner/page.tsx`, placed above
      `OpponentsSection`) — visible only while `teams.length === 0`, with an "Add a team" button that
      opens a self-contained `Modal` + `TeamPasteForm`, calling the same `addTeam` already passed to
      `MyTeamHeader` from the page. Deliberately doesn't share `MyTeamHeader`'s own internal add-team
      modal state (the two are never open at once, so a second independent instance is simpler for now
      than lifting that state up) — worth revisiting if this section grows beyond onboarding. Unwired
      from the page immediately after (same day) per feedback to hide it for now — the component still
      exists (`src/components/MyTeamSection/`), just isn't imported/rendered in
      `src/app/matchup-planner/page.tsx`.
- [x] **"Add your team" CTA in the Lead/Back column — tried, reverted same day.** Per a 2026-08-12
      request, added an "Add your team" button (opening a shared `Modal`/`TeamPasteForm` owned by
      `OpponentsSection`) to each `OpponentCard`'s "no active team" message. User feedback: repetitive,
      one button per opponent row read poorly. Reverted `OpponentCard`/`OpponentsSection` back to the
      plain-text message, and instead **re-enabled `MyTeamSection`** (unwired the same day it was built —
      see above) in `page.tsx`, above `OpponentsSection` — since it was already exactly "visible only
      while `teams.length === 0`", that alone gives the behavior asked for here: a single onboarding
      prompt once you've started adding opponents but haven't added your own team yet, gone the moment
      you have.
- [x] **Paste a Poképaste link instead of the full export.** Per a 2026-08-12 request: pokepast.es has a
      stable, undocumented, CORS-open (`access-control-allow-origin: *`) JSON endpoint at `<url>/json`
      returning `{ paste, title, ... }`, where `paste` is exactly the raw Showdown export text our parser
      already expects — fetchable client-side with no server proxy. Added `src/lib/pokepaste/`
      (`isPokepasteUrl` + `fetchPokepaste`, the latter throwing an already-user-facing message on any
      failure). Both `TeamPasteForm` and `OpponentForm` now detect a bare pokepast.es link in their paste
      textarea on submit, fetch it, and use the resolved text — `submit` became async, with a brief
      "Loading…" disabled-button state during the fetch. Left blank, the name/opponent-label field is
      prefilled from the paste's `title`. `OpponentForm` additionally resolves from its dedicated
      "Poképaste link" field when the paste box itself is left empty (so filling in just that one field —
      needed anyway for the "Open Poképaste" button — is enough to import the roster too), and backfills
      that field from the textarea's link when it was left blank. One caveat found while testing: an
      invalid/deleted paste's `/json` 404 response lacks the CORS header entirely, so the browser blocks
      it as an opaque network error rather than a readable 404 — `fetchPokepaste`'s 404-specific message
      is therefore effectively unreachable in the browser (the generic "couldn't reach" one shows
      instead); harmless, but the 404 branch exists mainly for the unit tests' mocked-fetch case.
- [x] **`ItemIcon` unoptimized, fixing intermittent "?" placeholders.** Per a 2026-08-12 report (item
      icons sometimes failing to load in the header's active-team sprite row, on an already-deployed
      team). Same root cause already diagnosed and fixed for `PokemonSprite` (see the sprite entry
      above): the PokeAPI item icon, though it genuinely exists (verified — e.g. Swampertite's URL
      returns 200), comes from a *remote* host (`raw.githubusercontent.com`) and was being routed
      through Next's Image Optimization pipeline (`next.config.ts`'s `images.remotePatterns` allows that
      host), which re-fetches/re-encodes on demand via a serverless function subject to Vercel's
      optimization concurrency/rate limits — an intermittent failure there fires `<Image>`'s `onError`
      and falls through to the "?" placeholder even though the source image is fine. `ItemIcon`'s
      fallback-image branch already had `unoptimized`; the primary (PokeAPI) branch now always does too,
      serving the URL straight to the browser instead of proxying it through the optimizer.
- [x] **Damage Calculator: Basic Singles.** Per a 2026-08-12 request, referencing
      [NCP-VGC-Damage-Calculator](https://github.com/nerd-of-now/NCP-VGC-Damage-Calculator) (MIT) as
      guidance — see that repo's own dedicated "VGC 2026 Champions" tab, which independently confirms
      this app's Stat Points/Mega Evolution model. New route `/damage-calc`
      (`src/components/DamageCalculator/`), linked from `MyTeamHeader`. Per user confirmation, Pokémon
      are picked from already-saved teams/opponents (`useMyTeams`/`useOpponents`), not a freeform
      species search — reuses `calculateFinalStats` outright for both sides' stats (Mega form, Stat
      Points, nature, Choice Scarf all already handled there).
      Net-new data, all generated at build time (no runtime API calls, same philosophy as
      `species.json`/`baseStats.json`): `src/data/moves.json` (`scripts/generate-move-data.mjs`, PokeAPI
      CSV bulk export — power/type/category per move) and `src/data/typeChart.json`
      (`scripts/generate-type-chart.mjs`, an 18×18 multiplier matrix, same source). Also extended
      `scripts/generate-species-data.mjs` to additionally emit `src/data/speciesTypes.json`
      (species/form → 1-2 types) — a gap the original plan missed, since STAB and defender
      type-effectiveness both need it and nothing in the app tracked Pokémon typing before this.
      Hand-curated (not generated, small starting subset, grows like `megaStones.ts`):
      `src/constants/abilityDamageModifiers.ts` (type-immunity abilities like Levitate, plus ~10
      always-on multiplier abilities like Technician/Huge Power/Filter) and
      `src/constants/itemDamageModifiers.ts` (Choice items, Life Orb, Assault Vest, type-boosting held
      items). New engine `src/lib/damage/calculateDamage.ts`: standard Level-50 damage formula, STAB,
      type effectiveness, the curated modifiers, and the conventional 16-roll 85–100% damage spread;
      returns `null` for Status moves and fixed/variable-damage moves (Seismic Toss, Counter, etc. —
      PokeAPI's `power` is `null` for these, not yet special-cased). KO-chance text uses a same-roll-
      repeated approximation (exact for the "guaranteed" case, an approximation otherwise) rather than
      full independent-roll convolution — noted in the module's own comment as a Full Singles Accuracy
      candidate.
      Verified via a hand-computed exact-roll-list unit test (Jolly Garchomp Earthquake vs. 0 SP Ditto)
      plus live manual checks (Fighting vs. Ghost/Steel correctly returning 0 damage from the generated
      type chart alone, Mega toggle correctly changing both stats and results). Explicitly deferred to
      later phases (renamed to avoid colliding with this section's own numbered Phase 1-9 — see the plan
      file): **Full Singles Accuracy** (status conditions, critical hits, weather/terrain/screens) and
      **Doubles & Matchup Planner Integration** (doubles-only mechanics like Helping Hand and spread-move
      ×0.75, plus the real end goal — loading a Lead/Back scenario straight from the matchup planner,
      blocked on today's data model only tracking *my* Lead/Back picks, not which opponent Pokémon is the
      target).
- [x] **Mega forms now use their own ability, not the base form's.** Per a 2026-08-13 bug report: Mega
      Raichu Y showed Lightning Rod's Electric immunity in the calculator, but Mega Raichu Y's real
      ability is No Guard — Mega Evolution always replaces the ability with a fixed one of its own, and
      a pasted export's `Ability:` line only ever records the *base* form's (Showdown's teambuilder has
      no separate slot for "ability after Mega Evolving"). Added `src/constants/megaFormAbilities.ts`
      (`MEGA_FORM_ABILITY_BY_FORM_KEY`, ~80 entries, sourced from NCP-VGC-Damage-Calculator's
      `pokedex.js`) and `src/lib/species/resolveEffectiveAbility.ts` (species+item+pasted-ability →
      the actual in-battle ability, falling back to the pasted one when there's no curated override —
      a handful of the newest Champions Megas, like Magearna and Zeraora, genuinely keep their base
      ability by design). `calculateDamage.ts` and the damage-calc UI (which now also *displays* the
      resolved ability, previously invisible) both resolve through this instead of reading
      `pokemon.ability` directly. Also renamed the results panel's "Rolls:" label to "Possible damage
      rolls:" with an explanatory `title`, per the same report asking what they meant — each hit's
      damage varies ±15% (85-100% in sixteen 1% steps), so the panel lists all sixteen possible exact
      values for the current matchup rather than a single number.
- [x] **Damage Calculator: Full Singles Accuracy.** Per a 2026-08-13 request to continue the damage-calc
      roadmap (phases renamed to avoid colliding with this section's own numbered Phase 1-9 — see the plan
      file). Adds burn, critical hits, weather (Sun/Rain/Sand/Snow), terrain (Electric/Grassy/Psychic/
      Misty), and screens (Reflect/Light Screen/Aurora Veil) to the single-hit engine — still no doubles
      modifiers or multi-hit moves (deferred to Doubles & Matchup Planner Integration, since multi-hit
      doesn't fit the existing "one call → 16 rolls for one hit" result shape). `calculateDamage.ts` grows
      an optional 4th `options: DamageCalcOptions` parameter (`src/types/damage.ts`) — deliberately kept
      out of `ParsedPokemon`, since these describe the moment of the hit, not the Pokémon's own build.
      Sand/Snow are modeled as a defender stat boost (Rock Sp.Def / Ice Def ×1.5) applied before the
      base-damage formula, not a post-hoc multiplier, matching how they actually work in-game. Terrain
      only boosts a *grounded* attacker (`isGrounded`: not Flying-type, not Levitate, no Air Balloon); Misty
      Terrain instead halves Dragon damage to a grounded defender. Guts is special-cased directly in the
      engine (not added to `abilityDamageModifiers.ts`) since it both cancels burn's halving and separately
      boosts Attack — a two-part effect that doesn't fit that table's flat-multiplier shape. New "Battle
      Conditions" panel in `DamageCalculator.tsx` (weather/terrain pill buttons, checkboxes for crit/burn/
      screens) between the Pokémon pickers and the move list; `RosterPokemonPicker.tsx` stays
      Pokémon-identity-only. Verified with 11 new unit tests (one per mechanic, directional comparisons
      against a no-condition baseline) plus a live check (Sand correctly dropped a Focus Blast from Raichu
      vs. Mega Tyranitar from a guaranteed OHKO to a guaranteed 2HKO; Light Screen correctly halved that
      same Special hit).
- [x] **Damage Calculator: type-chart immunity fix, weather-Speed display, both-sides movesets.** Per a
      2026-08-13 bug report (Zap Cannon vs. Ground-type Mega Swampert showed "0-0 (0%-0%) -- not a KO in 4
      hits" instead of "immune") plus two follow-up requests. Fixed `calculateDamage.ts`'s immunity check —
      it only short-circuited to the `"immune"` result for *ability*-granted immunity (Levitate, Water
      Absorb, ...); a plain type-chart 0x multiplier (e.g. Electric vs. Ground) fell through to the normal
      formula instead, producing a 0-damage roll list with misleading "not a KO" text. Now checks
      `typeMultiplier === 0` up front alongside the ability check. Added Speed display for weather-doubling
      abilities: `src/constants/speedModifiers.ts` (`WEATHER_SPEED_DOUBLING_ABILITIES` — Swift
      Swim/Chlorophyll/Sand Rush/Slush Rush, small curated starting set like the other modifier tables) and
      a `weather` prop threaded from `DamageCalculator.tsx` into `RosterPokemonPicker.tsx`, which now shows
      e.g. "216 (×2 Swift Swim)" on the Spe stat when the selected weather matches. Not modeling other
      Speed-changers (Quick Feet, Unburden, Tailwind) yet. Reworked the move UI to show *both* Pokémon's
      full movesets simultaneously, each move labeled with its own damage-% range against the other side —
      closer to the reference calculator's layout and no longer requiring "pick attacker's move" as the
      only direction. `calculateDamage` now runs once per move per side up front
      (`attackerMoveResults`/`defenderMoveResults` in `DamageCalculator.tsx`) instead of only on-select;
      clicking a row still opens the full roll-list detail panel below, now tracking `{ side, move }` so
      selection works for either direction. Verified live: Zap Cannon vs. Mega Swampert now reads "immune";
      Mega Swampert's Speed shows "216 (×2 Swift Swim)" under Rain (and its Wave Crash's % range rises too,
      from Rain's own Water boost); both movesets render side-by-side with correct per-move percentages.
      New regression test in `calculateDamage.test.ts` for the type-chart immunity fix.
- [x] **Damage Calculator: Field panel (Helping Hand, Friend Guard, Protect, Tailwind, Fairy Aura,
      Gravity).** Per a 2026-08-13 request to mirror the reference calculator's two-column Field panel.
      User confirmed (via a scope question) a damage-relevant subset only — the reference's hazard/DoT
      toggles (Stealth Rock, Spikes, Salt Cure, Leech Seed, Curse, Binding, Charge, Ingrain, Aqua Ring) are
      multi-turn HP mechanics this single-hit calculator has no way to model (no turn/HP tracking exists at
      all) and were deliberately left out rather than added as inert placeholders. Added to
      `DamageCalcOptions`: `attackerHelpingHand` (×1.5, doubles ally effect modeled as a flat toggle since
      this app doesn't track a separate partner Pokémon), `defenderFriendGuard` (×0.75, same reasoning),
      `defenderProtected` (blocks the hit entirely — checked first, before type effectiveness), `fairyAura`
      (×1.33 to Fairy-type moves, field-wide not per-side), and `gravity` (grounds every Pokémon).
      Implementing Gravity surfaced a real pre-existing gap: Air Balloon's actual primary effect
      (Ground-move immunity) was never implemented at all — only its secondary effect on Terrain-groundedness
      was. Added that immunity now, alongside Gravity correctly negating it (and Levitate's, and the
      Flying-type chart immunity) per the real mechanic. Fixed a second, more important bug surfaced by the
      same work: since the prior "both-sides movesets" change, `attackerBurned` and `defenderScreens` were a
      single flat state applied identically to both directions — meaning "Attacker Burned" or "Reflect"
      silently applied to the wrong Pokémon whenever the defender was the one attacking in
      `defenderMoveResults`. Fixed by restructuring all side-scoped conditions (burn, screens, Helping Hand,
      Friend Guard, Protect, Tailwind) into a `SideConditions` object per picker side (`attackerSide`/
      `defenderSide` state in `DamageCalculator.tsx`) and a `optionsFor(attackingSide, defendingSide)`
      helper that assigns the correct role per direction — attacking-role fields (burn, Helping Hand) come
      from whichever side is actually attacking in that computation, defending-role fields (screens, Friend
      Guard, Protect) from whichever side is defending. New "Field" panel replaces the old flat "Battle
      Conditions" checkboxes with this mirrored two-column layout (named after each side's selected
      Pokémon, e.g. "Raichu side" / "Tyranitar side"), matching the reference's visual pattern. Tailwind
      doesn't affect `calculateDamage`'s output (Speed doesn't factor into single-hit damage) so it's wired
      directly into `RosterPokemonPicker.tsx`'s Speed display instead, stacking multiplicatively with the
      existing weather-ability doubling (e.g. "400 (×2 Tailwind)", or ×4 if both apply). Verified with 8 new
      unit tests plus a live check: Tyranitar-side Protect blocked all of Raichu's incoming moves ("protected")
      while leaving Tyranitar's own moves unaffected; Raichu-side Helping Hand boosted only Raichu's own
      moves; Raichu-side Aurora Veil (toggled to spot-check the burn/screens direction fix) reduced only the
      damage Raichu takes, not what it deals; Raichu-side Tailwind showed "400 (×2 Tailwind)" on Raichu's
      Speed only.
- [x] **Damage Calculator: per-Pokémon detail panel (Base/SP/Final stats, stat stages, nature markers,
      status, current HP).** Per a 2026-08-13 request to mirror the reference calculator's per-Pokémon
      panel. `src/lib/stats/calculateFinalStats.ts` gained an exported `calculateStatBreakdown()` (base
      stats + raw 0-32 Stat Points + the existing `calculateFinalStats()` final stats, reused rather than
      duplicated) backing a new 5-column Base/SP/Final/Stage table per Pokémon in
      `RosterPokemonPicker.tsx`, replacing the old plain stat list. Nature boost/cut markers (↑/↓ next to
      the stat label) use `FinalStats.increasedStat`/`decreasedStat`, which already existed on that type
      but had never actually been rendered anywhere until now.
      Stat stages (-6 to +6, Attack through Speed — HP has none in the real games) are a genuine engine
      addition, not just display: added `StatStages`/`attackerStages`/`defenderStages` to
      `DamageCalcOptions`, and `calculateDamage.ts` now applies the standard Gen 3+ stage fraction table
      (`STAT_STAGE_MULTIPLIERS`, e.g. +2 → ×2, -2 → ×0.5) to whichever stat the move's category actually
      uses. Critical hits correctly ignore a *negative* attacker stage and a *positive* defender stage for
      that specific stat only (the real Gen 6+ crit mechanic) rather than ignoring stat stages entirely as
      before. A general per-Pokémon `status` dropdown (Healthy/Burned/Poisoned/Badly Poisoned/Paralyzed/
      Asleep/Frozen) replaces the old boolean "Attacker Burned" Field checkbox — deliberately kept as the
      full standard 7-value list even though only Burned (halves Physical damage) and Paralyzed (halves the
      Speed display) currently change any computed number, so the calculator can still track what's
      inflicted without pretending every status does something numeric yet. Fixed Guts while at it: it was
      keyed to `attackerBurned` specifically, but the real ability boosts Attack ×1.5 under *any* status,
      not just burn — added `attackerStatused` to `DamageCalcOptions` (burn alone still implies it even if
      a caller only sets `attackerBurned`, so the existing burn/Guts unit test needed no changes) and fixed
      the trigger.
      Current HP is a new engine capability too: `defenderCurrentHpPercent` (0-100, defaults to full) is
      compared against for `koChanceText` — "chance to KO" now reflects a defender already chipped down —
      while `minPercent`/`maxPercent` stay relative to MAX hp, matching how real calculators report a
      move's damage as "% of the total HP pool" independent of current HP. Status/stat stages/current HP
      are deliberately modeled as `PokemonBattleState` (owned per Pokémon, reset whenever the selected
      Pokémon changes) rather than folded into the per-side `SideConditions` from the Field panel work
      above — those two concepts are genuinely different in the real games: status/stages/HP belong to the
      individual Pokémon, while screens/Tailwind/Helping Hand belong to the side and persist across
      switches. `DamageCalculator.tsx`'s `optionsFor()` helper was extended to also flip which
      `PokemonBattleState` plays attacker/defender per direction, same as it already did for
      `SideConditions`. Verified with 9 new unit tests (stage boosts/drops, crit-aware stage clamping in
      both directions, Guts-on-any-status, current-HP-changes-KO-chance-not-percent) plus a live check: a
      Raichu +2 SpA stage roughly doubled Zap Cannon's damage %, and dropping Tyranitar to 40% current HP
      changed a non-OHKO into "guaranteed OHKO" while its displayed damage % stayed identical.
- [x] **Damage Calculator: editable Stat Points and nature.** Per a 2026-08-13 follow-up — the SP/Final
      table and per-stat stages shipped read-only for SP/nature; this makes both editable for
      theorycrafting without touching the saved team. New `src/lib/stats/applyStatOverrides.ts`
      (`StatOverrides { nature?, sp?: Partial<Record<StatKey, number>> }`) layers edits on top of a
      Pokémon's pasted build by re-serializing an `evs` string and reusing `calculateStatBreakdown`/
      `calculateFinalStats` for the actual math — no formula duplicated. Each stat's SP input is a number
      field clamped to 0-32 (the real per-stat cap), but the total across all six is deliberately **not**
      capped at 66 — per explicit request, exploring a build beyond what a legal team could have is the
      point of an editable calculator, not a bug to prevent. The nature select lists all 25 natures
      (`natureLabel()` formats e.g. "Timid (+Spe, -Atk)", reusing the existing `NATURE_MODIFIERS` table);
      changing it immediately updates Final stats and the ↑/↓ nature markers, since both read from
      `calculateStatBreakdown` over the overridden Pokémon rather than the pasted one.
      `DamageCalculator.tsx` holds the overrides per side (`attackerStatOverrides`/`defenderStatOverrides`),
      threads them into `toEffectivePokemon()` so the actual `calculateDamage()` calls (not just the
      display table) see the edited build, and resets them on Pokémon change but **not** on Mega toggle
      (still the same build, just a different form). Verified with 4 new unit tests (SP override affects
      only the touched stat, a >66-total spread round-trips correctly, nature override changes which stat
      is boosted/cut) plus a live check: setting Raichu's Atk to 32 SP and switching Timid→Adamant
      correctly moved the ↑/↓ markers to Atk/SpA and recalculated every Final stat (Atk 108→167, SpA
      182→163, Spe 200→182) with a 98-point total left unblocked.
- [x] **Damage Calculator: multi-hit moves, Focus Sash/Sturdy, and an SP-annotated result line.** Per a
      2026-08-14 bug report — Dual Wingbeat was computed as a single hit (half its true damage) since
      multi-hit was explicitly deferred in the original Basic Singles plan. `scripts/generate-move-data.mjs`
      now also joins PokeAPI's `move_meta.csv` for `minHits`/`maxHits`, present only on multi-hit moves
      (Dual Wingbeat 2/2, Bullet Seed 2/5, ...); ordinary moves have neither field. `calculateDamage.ts`'s
      `resolveHitCount()` uses the exact count for fixed moves, the max for a Skill Link attacker, and 3 hits
      for variable ones otherwise — not arbitrary: 3 is the exact probability-weighted expected value of the
      standard 2/3/4/5-hit (35/35/15/15%) distribution. Triple Kick/Triple Axel are hand-curated as the only
      two moves where each successive hit's power increases (hit N = basePower×N) rather than staying flat.
      The engine now simulates hit-by-hit per damage roll (same 85-100% roll shared across all sub-hits of
      one scenario, extending the existing "same roll repeated" convention `describeKoChance` already used)
      so multi-hit totals and a Focus Sash/Sturdy save both fall out of one loop: a hit that would reduce the
      defender from exactly full HP to ≤0 is clipped to leave 1 HP instead, once — a later hit (whether the
      same multi-hit move's next sub-hit, or a later `describeKoChance` "turn") starts from non-full HP and
      gets no further protection, matching the real one-time-save mechanic. Surfaced and fixed a real bug
      caught while validating this: the first implementation clamped every hit to remaining HP, silently
      destroying the overkill values several exact-value regression tests already depended on (e.g. the
      original "guaranteed OHKO" test's 151-178 roll list) — fixed to only clip when Sash/Sturdy actually
      triggers, otherwise reporting the true (possibly overkill) raw damage like a single hit already did.
      `DamageResult` grew `hitCount`/`attackStatKey`/`defenseStatKey` so the UI never re-derives what the
      engine already determined. Also enhanced the result line per the reference calculator's own format —
      `formatCalculationLabel()` in `DamageCalculator.tsx` prefixes the attacker with the Stat Points behind
      whichever stat the move actually used (e.g. "32 Atk") and the defender with its HP and defensive-stat
      SP (e.g. "2 HP / 0 Def"), plus a "(N hits)" suffix when hitCount > 1 — reusing `calculateStatBreakdown`
      rather than duplicating stat math. Verified with 7 new unit tests (multi-hit totals against an
      equal-power single-hit move for an exact 2x check, Triple Kick's increasing power, Sash/Sturdy clipping
      to exactly hp-1, Sash not triggering below full HP, and the "Sash saves hit 1, hit 2 still kills"
      multi-hit interaction) plus a live check reproducing the original bug report's own matchup: Mega
      Staraptor's Dual Wingbeat vs. Swampert now reads "19 Atk Staraptor Dual Wingbeat (2 hits) vs. 18 HP / 0
      Def Swampert: 66-78 (34.2% - 40.4%) -- guaranteed 3HKO", matching the reference's label format exactly.
      Known gap: PokeAPI's `move_meta.csv` doesn't have an entry at all for Population Bomb (a newer Gen 9
      1-10 hit move) — it falls back to being treated as single-hit rather than crashing; not hand-patched,
      since the underlying gap is in the third-party data source, not this app's extraction logic.
- [x] **Damage Calculator: auto-set weather from a selected Pokémon's ability, team quick-switch sprite
      row, Attacker defaults to the header's active team.** Per a 2026-08-14 request with reference
      screenshots. New `src/constants/weatherSettingAbilities.ts` (`WEATHER_SETTING_ABILITIES` — Drought/
      Drizzle/Sand Stream/Snow Warning → Sun/Rain/Sand/Snow) checked via `resolveAutoWeather()` in
      `DamageCalculator.tsx`, called from every place a Pokémon's identity can change (roster pick, Pokémon
      pick, Mega toggle) on both sides — selecting Sand Stream Tyranitar now sets Field weather to Sand
      immediately, without a manual click. Deliberately only sets forward (never clears weather when
      switching to a non-weather-setter), since the ask was specifically about auto-*setting*.
      `RosterPokemonPicker.tsx`'s "Select a Pokémon…" dropdown is replaced with a sprite quick-switch row
      (all of the loaded team's Pokémon as clickable tiles with an item-icon badge, current selection
      outlined) — the same pattern the reference calculator's sidebar and this app's own header team-switcher
      already use, reusing `ItemIcon` rather than inventing new badge logic. Roster changes now auto-select
      the first Pokémon (index 0) instead of resetting to nothing, matching how both reference patterns
      default to "Pokémon 1" the moment a team loads.
      The Attacker side is now scoped to "my teams" only (a separate `myTeamRosters` list, filtered out of
      the combined `rosters` before it reaches that picker) — opponent teams only make sense as the thing
      being studied, matching the app's existing MatchupPlan mental model; the Defender picker keeps the
      full combined list (own teams or any opponent). The Attacker also now defaults to whichever team is
      active in the header (`useMyTeams()`'s `activeTeamId`, already IndexedDB-persisted and read by
      `MyTeamHeader.tsx`) the first time it becomes available — implemented as a direct state adjustment
      during render (React's own documented pattern for "sync state once when a value changes," guarded by
      an `attackerDefaultedFor` tracker so a later explicit change is never overridden), not a `useEffect`;
      the first implementation used an effect and was rejected by this project's ESLint config's
      `react-hooks/set-state-in-effect` rule, which correctly flagged it as an anti-pattern here since
      nothing external needs synchronizing beyond a one-time initial default. Verified live: switching the
      header's active team to "M-Swamper" and navigating to the calculator loaded it immediately with
      Grimmsnarl (index 0) pre-selected and no manual clicks; the Attacker team dropdown showed only the two
      "my team" entries (opponents excluded) while the Defender dropdown still showed everything; and
      selecting the Sand Stream Tyranitar team as Defender set Field weather to "Sand" instantly.
    - Damage Calculator: moved the move lists + result readout to the top of the page, in a 3-column
      layout (attacker's moves | compact result card | defender's moves) matching the reference
      calculator's own layout, ahead of the Pokémon pickers and Field panel below — per the user's
      screenshots, this is "the important part" and shouldn't require scrolling past the setup UI first.
      `MoveList` was restyled from bordered pill-buttons to a flat divided row list (selected row gets a
      subtle `bg-mauve-100` highlight instead of a filled color swap) to read as a compact table, matching
      the reference's list style; each list also grew a small "click a move to see details" hint line under
      its heading. The previously separate full-width bottom result panel became `ResultPanel`, a new
      component always rendered as the middle column (with a "Click a move on either side to see the
      calculation" placeholder when nothing's selected yet) rather than only appearing after a move is
      picked — content unchanged (SP-annotated calculation line + KO chance + possible-rolls list).
      Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (127/127) all clean; live browser check
      selecting Grimmsnarl's Foul Play vs. Excadrill confirmed the 3-column layout renders correctly above
      the pickers, with the result card updating in the middle column on move selection.
    - Damage Calculator: the Pokémon pickers + Field panel below the move-list section were restructured
      into the same 3-column pattern — Attacker picker | Field configuration | Defender picker — instead of
      a 2-column picker row with the Field panel stacked full-width underneath, per the user's screenshot.
      The Field panel's per-side conditions (`SideConditionsPanel` for the attacker's and defender's side)
      switched from a 2-column grid to stacked vertically, since the Field column is now roughly a third of
      the page width rather than full-width — 2 columns of checkboxes side by side would have been cramped.
      The Field panel no longer gates on `attackerPokemon` being selected (weather/terrain/critical hit
      don't depend on a Pokémon being picked) so its grid position stays stable even before any team loads.
      Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (127/127) all clean; live browser check with
      Raichu vs. Excadrill confirmed all three columns render at comparable heights side by side.
    - Damage Calculator: fixed two layout issues the user flagged with an annotated screenshot after the
      two 3-column passes above. (1) The top move-list row used a custom `[1fr_1.4fr_1fr]` column template
      while the picker/Field row below used plain equal `grid-cols-3`, so the vertical column boundaries
      between the two rows didn't line up — changed the top row to `grid-cols-3` too, matching the bottom
      row exactly so both rows' column edges align. (2) `ResultPanel` (the middle result card) had extra
      empty space above its content — first attempted as a stretch/height problem (`self-start`), but a
      follow-up screenshot from the user clarified the actual complaint: the card's *top edge* itself was
      positioned wrong, starting level with the "MOVES" heading above the move lists rather than level with
      the first move row, since `MoveList` has a heading+hint block above its bordered row-list that
      `ResultPanel` didn't have an equivalent of. Fixed by adding an `invisible` spacer inside `ResultPanel`
      with the exact same heading+hint markup/classes as `MoveList`'s, so it reserves identical height
      without rendering, then the visible card sits right below it — guaranteed to line up with the move
      rows by construction (same classes), not by hand-tuned margins. Verified: `npx tsc --noEmit`,
      `npm run lint`, `npm test` (127/127) all clean; live browser check reproducing the user's exact
      Raichu vs. Mega Blastoise Water Pulse matchup confirmed the card's top edge now lines up with
      "Zap Cannon"/"Water Pulse" (the top move row) instead of the headings above them.
    - Damage Calculator: `formatCalculationLabel`'s result text now folds in each side's stat stage when
      non-zero, e.g. "+6 19 Atk Staraptor Close Combat vs. 25 HP / +6 2 Def Staraptor" — the SP number was
      already there, but a +6 Atk/+6 Def boost set via the Stage column wasn't reflected in the text at all,
      only in the computed damage. `formatStatToken` prefixes the SP figure with `+N`/`-N ` when the stage
      backing `result.attackStatKey`/`defenseStatKey` is non-zero (via new `STAGE_FIELD_BY_ATTACK_STAT`/
      `STAGE_FIELD_BY_DEFENSE_STAT` lookups, since the stage lives on `PokemonBattleState` while the SP
      figure comes from `calculateStatBreakdown`). Required threading the correct `PokemonBattleState` into
      `ResultPanel` — whichever of `attackerBattleState`/`defenderBattleState` is actually "attacking" flips
      with `selectedMove.side`, same ternary already used for `selectedAttackerMon`/`selectedDefenderMon`.
      Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (127/127) all clean; live browser check
      reproducing the user's exact Staraptor-mirror matchup with +6 Atk / +6 Def set confirmed the result
      text now reads "+6 19 Atk Staraptor Close Combat vs. 25 HP / +6 2 Def Staraptor: 50-59 (27% - 31.9%)
      -- guaranteed 4HKO", matching the numbers from their screenshot with the stages now shown.
    - Damage Calculator: extended `formatCalculationLabel` to fold in Helping Hand and damage-reducing
      conditions too, following the same reference-calculator screenshot pattern (e.g. "... Helping Hand
      Poltergeist vs. ... through Reflect: ..."). "Helping Hand " is prefixed right before the move name
      when `options.attackerHelpingHand` is set; a new `activeDamageReducers()` helper builds a " through
      X"/" through X and Y" suffix after the defender's species from whichever of Reflect/Light
      Screen/Aurora Veil/Friend Guard actually applied — Reflect and Light Screen only count when they
      match the move's own category (mirroring `screenMultiplier`'s category check in
      `calculateDamage.ts`, derived here from `result.attackStatKey` since "atk" and "spa" always
      correspond 1:1 to Physical/Special in this engine), Aurora Veil and Friend Guard apply regardless of
      category, matching the engine's own precedence (Aurora Veil supersedes the other two screens).
      `formatCalculationLabel` needed the actual resolved `DamageCalcOptions` for this calculation, not
      just the two `PokemonBattleState`s — added a `selectedOptions` (picking `attackerMoveOptions` or
      `defenderMoveOptions` by `selectedMove.side`, the same options objects already fed into
      `calculateDamage` for the move list) threaded through `ResultPanel`. Deliberately left out of scope:
      the item name and nature "+"/"-" suffix also visible in the reference screenshot — the user's ask was
      specifically about damage modifiers being reflected, not the full Showdown-calc text convention.
      Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (127/127) all clean; live browser check
      (Staraptor mirror, attacker's Helping Hand + defender's Reflect both toggled on, Close Combat
      selected) confirmed the text reads "19 Atk Staraptor Helping Hand Close Combat vs. 25 HP / 2 Def
      Staraptor through Reflect: 37-44 (20% - 23.8%) -- not a KO in 4 hits", with the displayed range
      matching what Reflect's 0.5x actually did to the numbers.
    - Damage Calculator: reworked the Field panel's controls to match the reference calculator's pill-toggle
      style throughout, per the user's screenshots. Extracted a shared `ToggleButton` component (the same
      `rounded-full border ...` pill style Weather/Terrain already used) and reused it for Weather, Terrain,
      Critical Hit/Fairy Aura/Gravity (previously plain checkboxes), and every per-side condition — replacing
      all the `<input type="checkbox">` rows in this panel. The two side-condition panels (attacker's/
      defender's) also moved from stacked vertically (one block, then the other below it) to side by side in
      a `grid-cols-2`, each rendering its conditions as a single column of full-width toggle buttons instead
      of a 2-column grid of checkbox+label rows — Reflect and Light Screen share one row split in half
      (`flex-1` each), matching the reference's own pairing, since they're mutually exclusive in practice.
      `SIDE_CONDITION_FIELDS` (the old generic checkbox-mapping array) was removed since the explicit
      per-button JSX needed direct control over the Reflect/Light Screen pairing anyway. Verified:
      `npx tsc --noEmit`, `npm run lint`, `npm test` (127/127) all clean; live browser check confirmed every
      toggle (Weather, Terrain, Critical Hit/Fairy Aura/Gravity, and both side panels' conditions) switches
      between the pill's active (filled `bg-mauve-600`) and inactive (outlined) states correctly, and the two
      side panels now render side by side instead of stacked.
    - Damage Calculator: added "add any Pokémon" — a from-scratch build (species, ability, held item,
      nature, Stat Points, up to 4 moves), gated by a new first-class "Regulation" concept, starting with
      Regulation M-B. Sources (both user-supplied): the legal species list came from
      [Bulbapedia's Regulation Set M-B page](https://bulbapedia.bulbagarden.net/wiki/Regulation_Set_M-B)
      (235 species — resolved to exact `species.json` keys, including ~25 tricky regional/gender/size/Rotom-
      forme ones, e.g. Bulbapedia's "Gourgeist (Jumbo Variety)" → `gourgeist-super`, PokeAPI/Showdown's own
      name for it); the legal item list from [RotomPicks' item page](https://rotompicks.com/en/items/) (148
      entries: 45 held items, 75 Mega Stones, 28 Berries). New data: `src/data/regulations/regulationMB.ts`
      + `index.ts` (a `Regulation` registry mirroring `presets/`' one-file-per-entry pattern, so a future
      Regulation M-C is one new file + one array entry), verified by `regulationMB.test.ts` — every species
      key resolves in `species.json`/`baseStats.json`/`speciesTypes.json`, and (this is the real safety net
      for a hand-typed 235-entry list) `normalizeSpeciesKey(formatSpeciesDisplayName(key)) === key` holds
      for every one, proving the new `formatSpeciesDisplayName()` helper's species.json-key → Showdown-style
      display name round-trips losslessly with zero alias-table dependency. Mega Stone legality
      (`REGULATION_M_B_MEGA_STONE_SPECIES`, 75 items → 73 species) was resolved by cross-referencing
      RotomPicks' item descriptions against `megaStones.ts`'s already-verified key spelling — confirmed
      megaStones.ts already covers every Mega this regulation allows (it deliberately covers more, e.g.
      Mewtwo/Latias/Latios that aren't in M-B). Extended both generation scripts (same CSV-join pattern as
      the existing stats/types blocks): `generate-species-data.mjs` now also fetches
      `pokemon_abilities.csv`/`abilities.csv`/`ability_names.csv` → new `src/data/abilities.json`;
      `generate-move-data.mjs` now fetches `move_names.csv` for real English move display names (`MoveData`
      gained `name?: string`) — this surfaced and fixed a latent CSV-parsing bug (naive `split(",")` broke
      on `"10,000,000 Volt Thunderbolt"`'s quoted comma; `splitCsvLine()` now respects quotes). New shared
      `SearchableSelect.tsx` combobox (reusing `PokemonSlotPicker.tsx`'s click-outside/`useViewportSafePosition`
      pattern) powers both the species search and a 4-slot move search. `RosterPokemonPicker.tsx` grew
      optional `isCustomRoster`/`onAddCustomPokemon`/`onRemoveCustomPokemon`/`onAbilityChange`/`onItemChange`/
      `onMovesChange` props — absent for every pasted-team/opponent roster (unchanged, read-only, as before);
      present only for a new synthetic "Custom Pokémon" pseudo-roster per side
      (`attackerCustomPokemon`/`defenderCustomPokemon` in `DamageCalculator.tsx`, session-only state, not
      persisted) where they switch the sprite row to a "+" add tile with per-sprite remove buttons and the
      ability/item/moves displays from read-only to editable selects. A caught-and-fixed bug along the way:
      the first wiring passed these callbacks unconditionally to both `RosterPokemonPicker` instances, which
      made the edit UI appear even for ordinary pasted Pokémon since the JSX only checked "is this callback
      present", not "is this actually the custom roster" — fixed by gating each editable section on
      `isCustomRoster && onXChange` together. A second bug caught in the same pass: `attackerPokemon`'s
      lookup used the full `rosters` array (which holds the *defender's* "custom" pseudo-roster) instead of
      `myTeamRosters` (the attacker's own) — both pseudo-rosters share the id `"custom"`, so this would have
      resolved the attacker's custom Pokémon from the wrong side's array. Deliberately out of scope: per-
      species move learnsets (any move stays pickable, consistent with this app's existing theorycrafting-
      over-strict-legality stance — see `applyStatOverrides.ts`) and persisting custom Pokémon across
      sessions. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (133/133, the 6 new
      `regulationMB.test.ts` cases catching zero regressions) all clean; live browser check built a fully
      custom Raichu-Alola (auto-defaulted to its real ability, Surge Surfer) with Thunderbolt added via the
      move search, and a fully custom Blastoise that auto-gained a Mega badge and switched to Mega Launcher
      the moment Blastoisinite was picked from the item select — the resulting calculation ("0 SpA
      Raichu-Alola Thunderbolt vs. 0 HP / 0 SpD Blastoise: 89-105 (57.8% - 68.2%) -- guaranteed 2HKO") ran
      correctly end-to-end between two from-scratch Pokémon; also confirmed the species search excludes a
      known-restricted example (Mewtwo — "No matches.") and the remove ("×") button works.
    - Damage Calculator: reworked the Attacker/Defender pickers to select one individual Pokémon directly
      instead of a two-step "pick a team, then pick within it" flow, per the user's screenshots. The "Select
      a team…" `<select>` is gone; in its place, `flattenRosterOptions()` builds one flat searchable list
      across every roster on that side (`"Staraptor (MM - Raichu Staraptor (my team))"`, etc.), reusing the
      `SearchableSelect` combobox built earlier for species/move search — each option's id packs both the
      roster id and the index within it (`${rosterId}#${index}`, split from the last `#` since roster ids
      like `"team:<uuid>"` already contain colons but never `#`), unpacked by `parseFlattenedOptionId()`.
      The old horizontal sprite row moved to a vertical strip on the *right* of the detail panel instead of
      above it — now serving specifically as a "quick-switch to a teammate in the currently selected roster"
      control (still wired through the existing `onPokemonChange`), while the flattened search is the
      primary "which Pokémon, from anywhere" entry point. The always-visible "+" button (add a custom
      Pokémon) moved next to the search input so it's reachable regardless of what's currently selected,
      rather than only appearing inside the old sprite row once the Custom roster was already active.
      `RosterPokemonPicker`'s `onRosterChange` prop was replaced with `onSelectPokemon(rosterId, index)` —
      needed because the old "call onRosterChange then onPokemonChange" two-step would have read a stale
      `attackerRosterId`/`defenderRosterId` from closure inside the second call (React state updates from
      the first call aren't visible until the next render), silently looking up the wrong roster's Pokémon
      for the auto-weather check; one combined callback with both values as parameters avoids that
      entirely. Both sides now also default to the very first Pokémon across every roster the first time
      that list is available (the Defender never auto-selected anything before this) — folded into the
      Attacker's existing "default to the header's active team" render-time adjustment as a fallback when
      there's no active team to prefer, and a new analogous one-shot default for the Defender. Separately
      fixed `SearchableSelect`'s dropdown to match its input's width exactly (previously a fixed `w-64`
      regardless of the input) — measured via `triggerRef.current?.offsetWidth` inside a `useEffect` (not
      during render, which React Compiler's lint rule forbids for ref reads) and applied as an explicit
      `width` style alongside `useViewportSafePosition`'s position. Verified: `npx tsc --noEmit`,
      `npm run lint`, `npm test` (133/133) all clean; live browser check confirmed the flattened search lists
      individual Pokémon with team context, the dropdown width now matches the input, both sides auto-select
      their first Pokémon on load with no manual clicks, and both the side-strip teammate switch and the
      persistent "+" add-custom-Pokémon button still work correctly after the restructure.
    - Damage Calculator: corrected course on the flattened-roster search above after the user clarified
      what they actually meant — team/opponent selection is omitted entirely for now, not flattened. The
      search dropdown on both sides is now purely the Regulation M-B species search (previously only used
      for the "add a custom Pokémon" popup) — picking any result always builds a fresh from-scratch Pokémon
      (`buildCustomPokemon()`, now exported from `RosterPokemonPicker.tsx`), never loads a saved team's
      paste. The side "teammates" strip's source changed from "whichever roster is currently selected" to a
      single fixed source: the header's active team (`useMyTeams()`'s `activeTeamId`) — the *same* strip
      content on both Attacker and Defender, confirmed with the user rather than assumed, since Defender
      showing "your own" team is a real behavior change from defender-picks-an-opponent. Clicking a
      teammate loads that real pasted Pokémon (read-only ability/item/moves, as before this whole custom-
      Pokémon feature existed); picking from the species search always builds an editable custom one.
      This let a lot of machinery from the previous two passes disappear entirely: `flattenRosterOptions`/
      `parseFlattenedOptionId`, the `RosterOption`/roster-array plumbing, the `onSelectPokemon(rosterId,
      index)` two-argument callback, the array-based `attackerCustomPokemon`/`defenderCustomPokemon` state
      (now just a single `attackerPokemon`/`defenderPokemon` object per side, since there's no longer a
      "list of custom Pokémon" to manage — selecting a new species simply replaces whichever Pokémon was
      showing), the always-empty "no active team" gate and its "add a team first" message, and the
      `useOpponents()` hook entirely (opponents are no longer read anywhere in this component). Both sides
      still default sensibly: to the active team's first Pokémon when one exists, falling back to the very
      first Regulation M-B species (`DEFAULT_SPECIES_KEY`, i.e. Venusaur) built as a custom Pokémon when
      there's no active team at all. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (133/133) all
      clean; live browser check confirmed both sides default to the active team's Raichu, the species search
      builds a fully custom, editable Garchomp (correct base stats, ability/item/moves all editable) without
      touching the teammates strip, and clicking a teammate afterward correctly swaps back to a real,
      read-only Pokémon from the paste.
    - Damage Calculator: made the header's team switcher persistent and visible across pages, and turned
      the read-only "teammates strip" from the previous pass into a real, editable working roster (add/
      remove, capped at `MAX_SIDEBAR_POKEMON` = 6) with different seeding rules per side, all per the user's
      explicit requests.
      - **Persistence turned out to already work** — `activeTeamId` was already written to and read from
        IndexedDB (`src/lib/storage/db.ts`'s `meta` store) by `useMyTeams()`, so it already survived
        navigation. The actual gap (confirmed via a research pass before implementing) was that
        `/damage-calc/page.tsx` never rendered `MyTeamHeader` at all — it had its own bespoke header with
        just a logo and a link back, so the active team was invisible and unreachable there even though the
        underlying selection was intact. Fixed by having `/damage-calc/page.tsx` call `useMyTeams()` and
        render `MyTeamHeader` exactly as `/matchup-planner/page.tsx` already does (no shared layout — this
        repo has none for either route yet, so matching the existing per-page composition pattern was the
        smaller, more consistent change over introducing a Next.js route group). `MyTeamHeader.tsx` needed
        one adjustment to be reusable this way: its single nav link was hardcoded to `/damage-calc`, which
        would have self-linked when rendered on that same page — replaced with a `currentPage:
        "matchup-planner" | "damage-calc"` prop (via a small `NAV_LINK_BY_PAGE` lookup) so the link always
        points at the *other* page.
      - **Sidebar redesign**: `RosterPokemonPicker`'s `teamPokemon`/`selectedTeamIndex`/`onSelectTeamPokemon`
        (read-only, previous pass) became `sidebar: SidebarEntry[]` (`{ pokemon, isCustom }`, exported)/
        `selectedIndex`/`onSelectIndex`/`onAddPokemon`/`onRemovePokemon` — a full add/remove working roster,
        capped at `MAX_SIDEBAR_POKEMON`. Adding (from either the main species search or the sidebar's own
        "+" tile, both wired to the same `onAddPokemon`) appends a new custom entry while under the cap;
        at the cap it replaces whichever entry is currently selected instead of blocking, so the search bar
        never needs to be disabled. Each tile grew a remove ("×") badge (mirrors the pattern already used
        for moves/custom-species removal elsewhere in this file). Removing the currently-selected entry
        clears the selection; removing an entry *before* the selected one shifts the selected index down by
        one so it keeps pointing at the same Pokémon post-splice — a straightforward but easy-to-miss
        off-by-one that would otherwise silently show the wrong Pokémon after a remove.
      - **Per-side seeding, per explicit instruction**: Attacker's sidebar seeds from the header's active
        team's full roster (once, on first load) if one exists, otherwise stays empty — no fallback species,
        unlike every other "default" in this feature so far. Defender's sidebar always starts with exactly
        one entry, the first Regulation M-B species (Venusaur) built as a custom Pokémon, regardless of
        whether an active team exists — it never seeds from the active team, since Defender is conceptually
        "the other side," not a mirror of Attacker's team.
      - Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (133/133) all clean; live browser check
        switched the header's active team to "M-Swamper" on `/matchup-planner`, navigated to `/damage-calc`,
        and confirmed the Attacker sidebar auto-loaded all 6 of M-Swamper's Pokémon (Grimmsnarl selected)
        while the Defender showed just Venusaur; added Tyranitar to the Defender's sidebar via its "+" tile
        (auto-set Field weather to Sand from Sand Stream), then removed Venusaur and confirmed Tyranitar
        correctly shifted to index 0 and stayed selected.
    - Damage Calculator: the Moves editor (chips with remove buttons + a `SearchableSelect` to add) was
      gated on `isCustom && onMovesChange`, so it only ever appeared for from-scratch Pokémon — a real
      pasted team member's moves were fully computable and shown in the top move-list panel, but had no way
      to be viewed or changed from the detail panel itself. Changed the gate to just `onMovesChange` (always
      truthy — both sides wire it unconditionally), matching how `attackerMovesChange`/`defenderMovesChange`
      already operated generically on `sidebar[selectedIndex].pokemon.moves` regardless of `isCustom`; ability
      and item stayed read-only for real team members (unchanged, since those are closer to "which build is
      this" identity than a quick swap). Editing a real team member's moves this way is local-only, same as
      every other in-calculator override (Stat Points, nature, stat stages) — never written back to the saved
      team. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (133/133) all clean; live browser check
      showed Grimmsnarl's real parsed moveset (Foul Play/Parting Shot/Reflect/Light Screen) as editable
      chips, and removing Foul Play correctly updated both the detail panel and the top move-list panel.
    - Damage Calculator: two follow-up polish requests on that Moves editor. (1) Changing an already-picked
      move required removing it first (clearing the slot) before a fresh empty search would appear — fixed
      by giving `SearchableSelect` a new optional `value` prop: the input now always shows the current move
      (instead of only rendering while empty), and clicking/focusing it selects that text and reopens the
      dropdown with every option available (not narrowed to a self-match) — so replacing a move is click,
      type-or-pick, done, no separate clear step. Internally this is still a local, editable text buffer
      (not a fully controlled input) that only resyncs to `value` when the prop itself changes — e.g.
      switching which slot/Pokémon is shown — via the same render-time "adjust state when a prop changes"
      pattern used elsewhere in this feature, not a `useEffect`. Each slot's `onSelect` now replaces at that
      index when it already holds a move (`next[slot] = ...`) instead of always appending, and a separate
      "×" button next to the input still clears the slot entirely. (2) Moved the whole Moves section to
      render after Status/Current HP instead of before the stat table, per explicit request. Verified:
      `npx tsc --noEmit`, `npm run lint`, `npm test` (133/133) all clean; live browser check clicked
      Grimmsnarl's "Foul Play" slot (it opened pre-selected with the full move list visible), typed "Thunder
      Wave", and confirmed it replaced Foul Play in one step with the top move-list panel updating to match.
    - Damage Calculator: fixed a real bug the user hit while rapidly adding/changing moves — the top
      move-list panel would show extra, stacked/overlapping rows (duplicated move names) that didn't match
      the 4 moves actually shown in the detail panel's editor. Root cause: `MoveList`'s rows were keyed by
      `key={move}` (the move's own name), but nothing prevented picking the same move for two different
      slots — a classic React duplicate-key situation, where a shared key confuses reconciliation and can
      leave stale rows behind even after the underlying data changes again. Two-part fix: (1) `MoveList` now
      keys each row by its array index instead of the move name — always unique regardless of value
      duplicates, the direct fix for the reported symptom; (2) the Moves editor's per-slot options are now
      filtered to exclude whatever's already picked in the *other* slots (still showing the slot's own
      current move so re-opening it works normally) — since a real Pokémon can't know the same move twice
      anyway, this closes off the root scenario rather than just patching its rendering symptom. Verified:
      `npx tsc --noEmit`, `npm run lint`, `npm test` (133/133) all clean; live browser check reproduced the
      original scenario on a custom Pidgeot (added Acid Armor/Bolt Strike/Acid Spray/Acid Downpour, then
      rapidly replaced the first slot with Whirlwind) — the top move-list panel stayed in sync with exactly
      4 correct, non-duplicated rows at every step.
    - Damage Calculator: fixed a real bug — held item was completely absent (not just read-only, actually
      missing from the DOM) for a real pasted team member, since it was still gated on `isCustom &&
      onItemChange` (a leftover from before the same fix was applied to Moves) with no read-only fallback
      the way ability had one. Same fix as Moves: dropped the `isCustom` gate, so the item `<select>` is now
      always shown and editable regardless of source. Added one safety net beyond the moves fix: a pasted
      team's real item might not be one of the enumerated Regulation M-B items (an older or off-meta paste)
      — the select now injects that value as its own `<option>` when it isn't already in the Held
      Items/Berries/Mega Stone lists, so it displays accurately instead of silently falling back to
      "(no item)" while the underlying `pokemon.item` stays correct either way. Also confirmed and explained
      (this was a real, fair question, not just a bug report) that item effects already do feed into the
      calculation and always have, independent of this fix: `calculateFinalStats.ts` applies Choice Scarf's
      ×1.5 Speed multiplier directly off `pokemon.item`; `calculateDamage.ts` applies `ITEM_DAMAGE_MODIFIERS`
      (`src/constants/itemDamageModifiers.ts` — Choice Band/Specs, Life Orb, Expert Belt, Muscle Band, Wise
      Glasses, Assault Vest, every type-boosting item) for both attacker and defender, plus Air Balloon's
      Ground immunity and Focus Sash — all read straight off `ParsedPokemon.item`, so they've applied to
      custom-built and real pasted Pokémon identically the whole time; the missing item *display* never
      affected the actual math, only whether the user could see/change it. Verified: `npx tsc --noEmit`,
      `npm run lint`, `npm test` (133/133) all clean; live browser check showed Grimmsnarl's real held item
      ("Light Clay") now rendering in an editable select, where the row was previously missing entirely.
    - Damage Calculator: replaced the held-item `<select>` with the same `SearchableSelect` combobox already
      used for moves, per request ("make the item select in a custom select, with autocomplete as the
      attacks"). `itemOptions` is now built per-Pokémon in `RosterPokemonPicker.tsx` (a flat list: the
      Pokémon's own species-specific Mega Stone(s) first, labeled `"{item} (Mega Stone)"` since the combobox
      has no optgroup grouping, then every Regulation M-B held item/Berry; a real pasted team's off-meta item
      is still injected as its own option first, same safety net as the previous native select) and passed to
      `SearchableSelect` via its existing `value`/`onSelect` props — clicking the field opens the dropdown
      with the current item selected and every option browsable/searchable, exactly like a move slot. Paired
      with a small "×" clear button next to the field (`onItemChange(undefined)`), replacing the native
      select's "(no item)" option. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (133/133) all
      clean; live browser check on Grimmsnarl confirmed the field shows "Light Clay", opens a searchable
      dropdown listing every option, typing "choice s" filters to "Choice Scarf", picking it updates the
      field and correctly re-applies the ×1.5 Speed multiplier (80 → 120 Final Spe), and the "×" button
      clears it back to empty; also confirmed on the Defender (Venusaur) that an empty item field opens with
      "Venusaurite (Mega Stone)" listed first ahead of the full Held Items/Berries list.
    - Damage Calculator: converted the ability and nature `<select>`s to the same `SearchableSelect` combobox
      as items/moves, per request ("can we make ability select and nature select the same pattern"). Added a
      `compact` prop to `SearchableSelect.tsx` (smaller padding/font-size for both the input and the dropdown
      rows) since ability/nature sit in a tight inline row next to each other, not a full-width form field —
      the underlying filter/open/sync/click-outside behavior is unchanged, only the sizing. `RosterPokemonPicker.tsx`
      gained a module-level `NATURE_OPTIONS` (all 25 natures, `id` the lowercase key `applyStatOverrides`
      expects, `label` the existing `natureLabel()` "+/-" format) and a per-Pokémon `abilitySelectOptions`
      (mapped from the existing form-aware `abilityOptions`). Ability keeps its existing `isCustom` gate
      unchanged — still a read-only `<span>` for real pasted team members, only its *editable* case (custom
      Pokémon) is now the combobox instead of a native select; nature was already always-editable for every
      Pokémon and is now the combobox unconditionally. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test`
      (133/133) all clean; live browser check on Grimmsnarl (real team member) confirmed the nature field
      opens a searchable dropdown of all 25 natures, typing "timid" filters to it, and picking Timid correctly
      recalculates Speed (80 → 88) and Sp. Def (119 → 109); on Venusaur (custom) confirmed the ability field
      opens with its two real options (Overgrow, Chlorophyll) rather than the full ability list.
    - Damage Calculator: dropped the ability field's `isCustom` gate too — same bug/fix class as the earlier
      Moves and Item fixes ("the ability of my team appears like a text, why don't show in the a select?").
      It had been deliberately read-only for real pasted team members (a prior design call — "closer to
      'which build is this' identity than a quick swap") but the user now wants it editable everywhere, same
      as everything else in this panel; the read-only `<span>` fallback stays in the component only for the
      case where a caller doesn't pass `onAbilityChange` at all (both Attacker and Defender always do, so in
      practice this row is always the combobox now). Removing the gate left the local `isCustom` variable in
      `RosterPokemonPicker.tsx` unused, so it was deleted along with it. Verified: `npx tsc --noEmit`,
      `npm run lint`, `npm test` (133/133) all clean; live browser check confirmed Grimmsnarl's (a real pasted
      team member) ability field now opens a searchable dropdown of its 3 real abilities (Prankster, Frisk,
      Pickpocket) instead of rendering as plain text.
    - Damage Calculator: gave the held-item field the same `compact` sizing as ability/nature, per request
      ("I like the slim version of the select, can we make the item the same pattern... keep moveset select
      the way they are") — a one-line change (added `compact` to the item `SearchableSelect` call in
      `RosterPokemonPicker.tsx`), no other behavior change. Moves deliberately left as the larger/default
      size, per the explicit "keep moveset select the way they are." Verified: `npx tsc --noEmit`,
      `npm run lint`, `npm test` (133/133) all clean; live browser check confirmed the item field now matches
      ability/nature's slim styling while the 4 move fields are visually unchanged.
    - Damage Calculator: fixed a real gap — type-resist Berries (Occa, Yache, Colbur, etc.) and Chilan Berry
      weren't factored into the calculation at all, per the user's question ("there are berries that reduce
      supereffective hits from attacks like occa berry, are we considering that for calculation"). Added 17
      type-resist Berries (`TYPE_RESIST_BERRIES` in `src/constants/itemDamageModifiers.ts`, one per
      attacking type except Normal) as `defender` entries in `ITEM_DAMAGE_MODIFIERS` — `{ multiplier: 0.75,
      types: [type], onlySuperEffective: true }`, the modern Gen 6+ value (25% reduction; it was 50%
      pre-Gen 6) — reusing the existing `onlySuperEffective` flag and `sideMultiplier()` machinery already in
      `calculateDamage.ts` for Expert Belt, so no engine changes were needed, only new table entries. Also
      added Chilan Berry (`{ multiplier: 0.5, types: ["Normal"] }`, no `onlySuperEffective` — it unconditionally
      halves Normal-type damage since Normal is never actually super-effective against anything, the one
      type with no natural "resist berry" case otherwise) — together these cover all 18 attacking types.
      Deliberately still deferred, per the file's existing header comment: Sitrus/Oran (trigger on low HP,
      needs a damage-simulation loop) and the 7 status-cure Berries (cure status, don't affect damage taken).
      Added 2 unit tests to `calculateDamage.test.ts`: a type-resist Berry (Yache) cuts a confirmed 4x
      super-effective hit by 25% but is a no-op on a neutral hit of the same type; Chilan Berry halves a
      neutral Normal-type hit unconditionally. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test`
      (135/135) all clean; live browser check with Grimmsnarl's Foul Play (Dark, super-effective) vs. a Gengar
      (Ghost/Poison) holding Colbur Berry confirmed the shown damage range dropped from 125.9-148.9% to
      94.1-111.1% — a 25% cut, matching the formula.
    - Damage Calculator: the result text (`formatCalculationLabel` in `DamageCalculator.tsx`) now prefixes
      each side's held item onto its species name — e.g. "Occa Berry Sinistcha" — the standard Showdown-calc
      convention, per request ("can we reflect that in the calc text", referring to the previous entry's
      resist-Berry fix: the berry affected the number but was invisible in the text explaining it). A 2-line
      change: `attackerItemLabel`/`defenderItemLabel` (`` `${item} ` `` when present, else `""`) inserted
      right before `attacker.species`/`defender.species` in the existing template string — no change to what
      the label already showed (Stat Points, stat stage, Helping Hand, screens/Friend Guard). Verified:
      `npx tsc --noEmit`, `npm run lint`, `npm test` (135/135) all clean; live browser check reproduced the
      screenshot's exact pattern — Grimmsnarl (Light Clay) Foul Play vs. Venusaur holding Colbur Berry now
      reads "...vs. 0 HP / 0 Def Colbur Berry Venusaur" with the item visible in the line itself.
    - Damage Calculator: moved the item field's clear "×" from a separate button next to the combobox to
      inline inside the input's own right edge, per request ("would like to move the clear (x button) inside
      the input it self"). `SearchableSelect.tsx` gained a general `onClear?: () => void` prop — when set and
      `value` is present, an absolutely-positioned "×" button renders inside the input's right edge (the
      input gains matching right padding, `pr-5`/`pr-8` compact/default, so typed text never runs under it);
      clicking it calls `onClear()` and closes the dropdown without triggering the input's own `onFocus`-opens
      behavior. `RosterPokemonPicker.tsx`'s item field now passes `onClear={() => onItemChange(undefined)}`
      instead of rendering its own adjacent button, collapsing the `flex items-center gap-1` wrapper back down
      to just the `SearchableSelect` itself. Moves keep their existing external "×" button, unchanged (this
      was scoped to the item field only, matching the screenshot). Verified: `npx tsc --noEmit`,
      `npm run lint`, `npm test` (135/135) all clean; live browser check confirmed the "×" now sits inside
      Grimmsnarl's item input exactly like the screenshot, clicking it clears the item without opening the
      dropdown, and clicking elsewhere in the field still opens it normally.
    - Damage Calculator: extended the previous entry's inline "×" to the 4 move slots too, per follow-up
      request ("I would like that to apply to the moveset inputs as well"). Each slot's `SearchableSelect` in
      `RosterPokemonPicker.tsx` now passes `onClear` (the same splice-out-this-slot logic the old adjacent
      button ran) instead of rendering its own external button, so the `flex items-center gap-1` wrapper
      around each slot collapsed away — the grid's 4 children are now just the 4 `SearchableSelect`s directly
      (keyed by `slot`, same as before). No engine or data changes; purely the same UI pattern already built
      for the item field, reapplied here. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (135/135)
      all clean; live browser check on Grimmsnarl confirmed all 4 move slots now show the "×" inline like the
      item field, and clearing "Foul Play" correctly removed it and shifted the remaining 3 moves up (Parting
      Shot/Reflect/Light Screen), matching the prior splice-based remove behavior exactly.
    - Damage Calculator: fixed the Speed row's stage-multiplier label showing a raw repeating decimal (e.g.
      "×0.3333333333333333 -4 stage" at a -4 stage, since 1/3 has no exact binary-float representation) — per
      request ("this numbers needs to be round"). Added `roundedSpeedMultiplier` in `RosterPokemonPicker.tsx`
      (`Math.round(totalSpeedMultiplier * 100) / 100`, display-only — the actual `effectiveSpe` computation
      still uses the full-precision `totalSpeedMultiplier`, unchanged) and swapped it into both the visible
      "(×... stage)" text and the hover title. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test`
      (135/135) all clean; live browser check reproduced the screenshot's exact -4 stage on Grimmsnarl's
      Speed — now reads "26 (×0.33 -4 stage)" instead of the long decimal.
    - Damage Calculator: fixed a real gap — Water Spout and Eruption's base power is supposed to scale with
      the ATTACKER's own current HP (`floor(150 * currentHP / maxHP)`), but the engine had no concept of the
      attacker's HP at all: `DamageCalcOptions` only ever tracked the *defender's* current HP percent, and
      `moves.json` stores a flat `150` for both moves (PokeAPI's full-HP value, since PokeAPI has no notion
      of this scaling) — so the calculator always computed as if the attacker were at full HP regardless of
      the Attacker panel's own "Current HP" slider, per the user's report ("how are we calculating move like
      Water Spout? that power changes base on hp... look at the damage from our app and from the reference
      they are different"). Added `attackerCurrentHpPercent?: number` to `DamageCalcOptions`
      (`src/types/damage.ts`), wired it through `DamageCalculator.tsx`'s `optionsFor()` from the attacking
      side's `PokemonBattleState.currentHpPercent` (the exact mirror of how `defenderCurrentHpPercent` was
      already wired), and added `resolveMovePower()` in `calculateDamage.ts` — a 2-move `HP_SCALED_POWER_MOVES`
      set (`water-spout`, `eruption`) that recomputes power as `max(1, floor(storedPower * percent / 100))`
      before the base-damage formula runs; every other move's power is unaffected. Explicitly still out of
      scope, and noted as such in the new code's comment: Flail/Reversal (attacker's own HP, inverted —
      power rises as HP drops), Grass Knot/Low Kick (defender's weight), Gyro Ball/Electro Ball (relative
      Speed) — PokeAPI already reports `power: null` for all of those, so they correctly return no result
      today rather than a wrong one; this fix only covers the two moves PokeAPI mislabels with a fixed value.
      Note for the specific screenshot comparison that prompted this: since the attacker was at 100% HP in
      both tools, this particular gap wasn't the cause of the visible number difference there (100% of 150
      is still 150 either way) — that gap is far more likely explained by the two setups using different
      Special Defense Stat Point investment on the defending Scizor between the two separate tools, not a
      remaining engine bug; the fix here addresses the underlying mechanic the user was correctly asking
      about, confirmed by testing at non-100% HP where the old code was provably wrong and the new code isn't.
      Added 4 unit tests to `calculateDamage.test.ts`: omitting the option defaults to full 150 power (same
      result as passing 100 explicitly); 50% HP roughly halves the roll; 0% HP still produces at least 1
      power (never fully blocked); an ordinary fixed-power move (Ice Beam) is correctly unaffected by a low
      `attackerCurrentHpPercent`. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (139/139) all
      clean; live browser check with a fresh Blastoise + Water Spout confirmed 23.9-28.4% at 100% HP dropping
      to 11.6-14.2% (roughly half) when the Current HP slider was dragged down to 49%.
    - Damage Calculator: fixed a real display bug the user spotted comparing two side-by-side screenshots
      against the reference calculator ("do you see any reason way calc are different here") — Mega
      Blastoise's ability field showed "Torrent" (the base form's ability) instead of "Mega Launcher" (what
      Mega Blastoise actually has), because the now-always-editable ability `SearchableSelect` in
      `RosterPokemonPicker.tsx` displayed `value={pokemon.ability}` (the raw pasted/base value) instead of
      the already-computed, mega-aware `effectiveAbility` (from `resolveEffectiveAbility`, used correctly
      elsewhere in this same component for the read-only fallback span and the Tailwind-ability-doubling
      check). Fixed by swapping the `value` to `effectiveAbility` — picking a new option still writes to the
      base `pokemon.ability` field via `onAbilityChange` unchanged, so this is purely a display fix, not a
      behavior change (a Mega form only ever has one ability anyway). Confirmed this was cosmetic only: the
      actual damage math was never affected, since `calculateDamage.ts` independently calls
      `resolveEffectiveAbility` off the raw `ParsedPokemon.item`/`.ability`, not off anything read from this
      UI state. For the numbers themselves in the screenshots that prompted this (Water Spout doing
      98.3-115.8% in this app vs. 71.7-84.7% in the reference): explained to the user this isn't the
      HP-scaling mechanic from the previous entry (both attackers were at 100% HP in both tools, so power is
      150 either way) — working the base-damage formula backward from each tool's own displayed final stats
      showed our number is internally consistent with the stats OUR tool actually has entered (Atk 205 /
      Def 100 / power 150 / STAB 1.5 reproduces our exact 205 max roll by hand), while the reference's
      required defense stat to produce its own reported 150 max roll is far higher than what's entered in our
      tool's Scizor (Sp. Def Stat Points, not ability/item, since neither differing ability (Swarm vs.
      Technician) nor item (none vs. Life Orb) affects damage a Pokémon *takes*) — concluded this is a
      build/Stat-Point mismatch between the two separately-configured Scizors rather than an engine bug, and
      recommended matching the exact Sp. Def Stat Points between the two tools to confirm. Verified: `npx tsc
      --noEmit`, `npm run lint`, `npm test` (139/139) all clean; live browser check confirmed a freshly-added
      Mega Blastoise (Blastoisinite) now shows "Mega Launcher" instead of "Torrent" the moment Mega is
      toggled on, alongside the already-correct Mega-form base stats.
    - Damage Calculator: implemented the doubles ×0.75 spread-move damage reduction, per request ("this kind
      of spreed moves hit diferent when is a single or double target, what approach use the calculator?" →
      "yes, implement it") — previously not modeled at all (`moves.json` had no target-type data, so
      Earthquake/Rock Slide/Heat Wave/Water Spout/etc. were always computed as full-power single-target
      hits, a real accuracy gap given this app's whole purpose is a doubles format). `scripts/
      generate-move-data.mjs` (regenerated via `npm run generate:moves`) now reads moves.csv's own
      `target_id` column directly (no extra CSV fetch needed — ids 9 "all-other-pokemon" and 11
      "all-opponents" are the two PokeAPI target types eligible for the reduction, confirmed against
      move_targets.csv's stable id→name mapping) and writes `isSpread: true` onto exactly those moves in
      `moves.json` (absent for everything else, same "only present when true" shape as `minHits`/`maxHits`).
      `MoveData` (`src/types/damage.ts`) gained `isSpread?: boolean`; `DamageCalcOptions` gained
      `attackerHitsMultipleTargets?: boolean` (only has an effect when the move itself `isSpread`); the
      modifier chain in `calculateDamage.ts` gained one factor,
      `(move.isSpread && options.attackerHitsMultipleTargets ? 0.75 : 1)`, next to the existing Friend Guard
      entry it mirrors. `DamageResult` gained `isSpreadMove: boolean` (independent of whether the reduction
      was actually applied, so the UI can label "spread move, 1 target" differently from "spread move, 2
      targets") — set on all three of `calculateDamage`'s return paths (Protect-blocked, immune, and the
      normal result). UI: `SideConditions` (`DamageCalculator.tsx`) gained a `spreadTarget` boolean, off by
      default like every other side condition so existing calculations don't silently change; a new "Spread
      Target (2 Pokémon)" pill sits next to Helping Hand in each side's Field panel (same
      `SideConditionsPanel`/`ToggleButton` pattern, unconditionally visible like the rest — a no-op on a
      non-spread move, exactly like Reflect is already a no-op on a Special move); `formatCalculationLabel`
      appends " (spread)" after the hits label when both the move and the toggle are active, mirroring the
      existing "Helping Hand "/" through Reflect" conditional-label pattern. Added 4 unit tests to
      `calculateDamage.test.ts`: the reduction only applies when both `move.isSpread` and the option are
      true (verified exactly `floor(singleTargetMaxRoll * 0.75)`); `isSpreadMove` correctly true/false per
      move; a non-spread move is unaffected by the option; omitting the option behaves identically to
      passing it explicitly `false`. Also updated 4 pre-existing exact-shape `toEqual` tests to include the
      new `isSpreadMove` field. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (143/143) all clean;
      live browser check on Grimmsnarl's Earthquake vs. Venusaur confirmed single-target damage of 46-55
      (29.7-35.5%) drops to exactly 34-41 (21.9-26.5%, the ×0.75 factor) with "Spread Target" toggled on and
      the result text reading "Earthquake (spread)", while the same toggle left Foul Play (non-spread)
      completely unchanged at 67-79 (43.2-51%).
    - Damage Calculator: replaced the previous entry's two per-side "Spread Target (2 Pokémon)" pills with a
      single global "Singles / Doubles" segmented control at the top of the Field panel, defaulting to
      Doubles, per explicit follow-up request ("instead of this buttoms, let's have it like this, a single
      double buttom if one is enable the other can't, also as default it will be double... and move on top
      of the field area"). Removed `spreadTarget` from `SideConditions`/`DEFAULT_SIDE_CONDITIONS` and its
      `ToggleButton` in `SideConditionsPanel` entirely; added a new `battleFormat: "Singles" | "Doubles"`
      state (default `"Doubles"`, since this app's whole context is VGC — a spread move's reduction now
      applies out of the box instead of needing an opt-in per calc) feeding `optionsFor()`'s
      `attackerHitsMultipleTargets: battleFormat === "Doubles"` directly via closure, for both calculation
      directions at once (previously two independent per-side toggles). Added a new `SegmentedToggle`
      component (`DamageCalculator.tsx`) — a single connected pill with a shared border between segments and
      only one active at a time, visually distinct from `ToggleButton`'s separate-pill rows and matching the
      reference calculator's own Singles/Doubles control — rendered above the Weather row. `DamageCalcOptions.
      attackerHitsMultipleTargets` and `calculateDamage.ts`'s modifier logic are unchanged from the previous
      entry; this was purely a UI/state-shape change in how that option gets set. Verified: `npx tsc
      --noEmit`, `npm run lint`, `npm test` (143/143) all clean; live browser check confirmed Doubles is
      selected by default with Earthquake already showing the ×0.75-reduced "(spread)" result on page load,
      and clicking Singles switches it back to full single-target damage with the segmented control's active
      state moving accordingly.
    - Damage Calculator: implemented recoil damage — both a move's own recoil (Wave Crash, Flare Blitz,
      Double-Edge, Volt Tackle, Brave Bird, Wood Hammer, Head Smash, Take Down, Submission, Wild Charge, ...)
      and Life Orb's flat 10% max HP, per request with a reference-calculator screenshot ("for damage that
      have recoil as water crash or for pokemon that has life orb equipeted we could calculate the recoil
      like this, can we do it"). `scripts/generate-move-data.mjs` (regenerated via `npm run generate:moves`)
      now reads move_meta.csv's existing `drain` column (already fetched for `minHits`/`maxHits`, no new
      request needed) — a negative value means recoil, mapped through `DRAIN_TO_RECOIL_FRACTION` to the true
      in-game fraction (-25/-33/-50 → 1/4, 1/3, 1/2) rather than trusting the CSV's rounded integer percent
      directly, which would have compounded a small error through the damage formula. Wave Crash (a Gen 8
      move) has no move_meta.csv row at all — a confirmed real gap, filled via a one-entry
      `MANUAL_RECOIL_OVERRIDES` map (0.25, per Bulbapedia), same "small starting subset, grows as gaps are
      found" pattern as this app's other hand-curated tables. `MoveData` gained `recoilFraction?: number`
      (absent for drain-heal moves like Giga Drain and flat-self-cost moves like Mind Blown/Steel Beam/
      Struggle/Jump Kick's miss-only crash damage — all naturally excluded since none show a negative
      `drain`, explicitly noted as still out of scope in the generator's file header). `calculateDamage.ts`
      computes a parallel `recoilRolls` array alongside the existing damage `rolls` in the same per-hit loop
      (move-recoil is `floor(dealt * recoilFraction)` per hit, based on the post-Focus-Sash-clipping damage
      dealt — a documented simplification vs. the real games' pre-clip basis) plus Life Orb's flat
      `ceil(attackerStats.hp / 10)` added once per roll, not per hit; `DamageResult` gained
      `recoilMinPercent`/`recoilMaxPercent` (percent of the ATTACKER's own max HP, undefined when neither
      source applies — omitted from the two early-return paths, Protect/immune, since no damage means no
      recoil either). UI: `formatMoveResultLabel` appends "(N% recoil)" (Life-Orb-only, a flat cost so
      min===max) or "(N - M% recoil)" (a real recoil move, varies with the roll) to each move-list row,
      matching the reference screenshot's exact format; the detail `ResultPanel` gained a dedicated "Recoil
      to {species}: ..." line. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (147/147, 4 new
      recoil-specific tests) all clean; live browser check with a fresh Swampert (Torrent, no item) using
      Wave Crash showed "27.7-32.9% (5.7 - 6.9% recoil)" and a "Recoil to Swampert: 5.7% - 6.9%" line;
      switching to Life Orb bumped both damage (Life Orb's own ×1.3) and recoil to "36.1-42.6% (18.3 - 19.4%
      recoil)" (the two sources correctly stacking); swapping to Earthquake (non-recoil) with Life Orb still
      equipped showed a flat "45.2-53.5% (10.3% recoil)" — Life Orb alone, no range.
    - Damage Calculator: two small requests in one turn. (1) Centered the Field panel's Weather, Terrain, and
      Critical Hit/Fairy Aura/Gravity button rows (added `justify-center` to each, matching the reference
      screenshot's centered layout — they were left-aligned before). (2) Added read-only "120 Water · Phys"
      move info next to each picked move slot, per "do we have data to display moves with power and type
      like this" — yes, `moves.json` already has `power`/`type`/`category` per move (used throughout
      `calculateDamage.ts` already), this was purely a display gap. Changed the Moves section's layout from
      a `grid-cols-2` (2×2) to a single-column list (`RosterPokemonPicker.tsx`) to make room for the info
      column each row now shows via a new `CATEGORY_ABBREVIATION` lookup (Physical→"Phys", Special→"Spec",
      Status→"Status", mirroring the reference calculator's own abbreviations); the info span only renders
      when a move is picked (empty slots stay full-width). Kept this deliberately read-only/informational —
      unlike the reference calculator's editable Power/Type/Category override fields, this app's move data
      already comes from real game data (or an explicit pick from the same searchable move list), so there's
      no legitimate case for overriding it per-slot. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test`
      (147/147) all clean; live browser check confirmed the Field rows are now centered and Grimmsnarl's
      moves show "95 Dark · Phys" (Foul Play), "Dark · Status" (Parting Shot), "Psychic · Status"
      (Reflect/Light Screen — both Psychic-type Status moves), while empty Defender move slots correctly show
      no info column and stay full-width.
    - Damage Calculator: two follow-up tweaks to the move-info column from the previous entry, per request
      with screenshots showing the problem ("let's just leave power and type, let's make the input a fixed
      width in order to avoy this" — a screenshot of "100 Ground · Phys" wrapping onto two lines since the
      info column's width varied row to row depending on how long each move's type/category text was).
      Dropped the `· Phys`/`· Spec`/`· Status` category suffix entirely (now just "120 Water", "100 Ground"),
      removing the now-unused `CATEGORY_ABBREVIATION` lookup. Fixed the wrapping by giving the move
      `SearchableSelect`'s wrapper a fixed `w-56` (was `flex-1`, sized to fill whatever space was left after
      the variable-width info column) instead of the other way around — the info column now gets whatever
      fixed space remains after a stable-width input, rather than the input's width shifting row to row as
      the info column's own text length changed. Verified: `npx tsc --noEmit`, `npm run lint`, `npm test`
      (147/147) all clean; live browser check swapping a move to "Earthquake" (100 Ground) confirmed the info
      column no longer wraps to a second line, matching the second screenshot's example exactly.
    - Damage Calculator: swapped the move-info column's type text for a type icon, per request — the user
      added `public/resources/types-icons/` themselves (18 PNGs, one per standard type, filenames matching
      the lowercased type name — e.g. `water.png`), asking to use them instead of text, icon before power.
      New `src/components/TypeIcon/TypeIcon.tsx` (`{ type, size = 16 }` → `<Image src="/resources/types-icons/
      {type.toLowerCase()}.png">`), same directory-per-component/`index.ts` pattern as `ItemIcon`. Verifying
      the type coverage against `moves.json` surfaced a real edge case the "18 types, closed set" assumption
      would have missed: `moves.json` actually has a 19th type, "Shadow" (Pokémon Colosseum/XD-exclusive
      moves like Shadow Rush — never legal in any real VGC format, but still present as pickable data), with
      no matching icon file — so `TypeIcon` got the same `onError` → "?" placeholder fallback pattern
      `ItemIcon` already uses, rather than assuming the set is fully closed. `RosterPokemonPicker.tsx`'s move
      info span now renders `<TypeIcon type={moveInfo.type} />` before the power number (was `"120 Water"`
      text, now icon + `"95"`/`"120"` etc., matching the requested icon-then-power order). Verified: `npx tsc
      --noEmit`, `npm run lint`, `npm test` (147/147) all clean; live browser check confirmed Dark and
      Psychic type icons render correctly next to Grimmsnarl's Foul Play/Parting Shot/Reflect/Light Screen.
    - Damage Calculator: sized the type icon to match the move input's own rendered height, per follow-up
      request ("i would like to make the icons same height as the input"). Measured the compact
      `SearchableSelect` input's actual height live via `getBoundingClientRect()` (38px) rather than guessing
      from Tailwind spacing values, and passed `size={38}` at this one call site in
      `RosterPokemonPicker.tsx` (the `TypeIcon` component's own default stays 16 for any other future use).
      Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (147/147) all clean; live browser check
      confirmed the icons now sit flush edge-to-edge with the move field beside them, matching the
      screenshot.
    - **Damage Calculator: "Open in Damage Calculator" from an opponent card.** Closes part of the
      long-standing "real end goal" gap noted since the very first Basic Singles entry (loading a scenario
      straight from the matchup planner) — per request, a calculator icon on each `OpponentCard` now opens
      `/damage-calc` in a new tab with the Attacker pre-loaded from the header's active team (already the
      existing default) and the Defender pre-loaded from *that specific opponent's* full roster. New
      `IconName.Calculate` (`src/enums/iconName.ts` + `src/components/Icon/paths.ts` — Material Symbols
      Outlined "calculate", fetched from the same google/material-design-icons source the other icons were
      manually extracted from) renders as a new button in `OpponentCard.tsx`'s icon row, before Edit/Delete:
      a plain `<a href="/damage-calc?opponentId={opponent.id}" target="_blank" rel="noopener noreferrer">`,
      mirroring the existing "Open Poképaste" external-link pattern in the same file rather than `next/link`
      (which has no special new-tab semantics). `DamageCalculator.tsx` reads the `opponentId` query param via
      `useSearchParams()` (the first use of Next's URL-param hooks in this codebase — confirmed via
      `node_modules/next/dist/docs` per AGENTS.md's directive that this Next version may differ from training
      data) and `useOpponents()` to resolve it to the actual `Opponent`, then seeds the Defender's sidebar
      from `opponent.team.pokemon` using the exact same render-time-adjust-state pattern already used for the
      Attacker's active-team seed (a sentinel `defenderDefaultedForOpponentId` state, mirroring
      `attackerDefaultedFor`) — except gated on the opponent object actually resolving (not just the sidebar
      being empty), since `useOpponents()` loads asynchronously from IndexedDB and `opponentId` can be
      present in the URL before the opponents list has finished loading; once applied for a given
      `opponentId`, later manual Defender edits are never overridden, same guarantee as the Attacker side.
      `useSearchParams()` requires a `<Suspense>` boundary around any client component that calls it or a
      static build fails with Next's "missing Suspense boundary" error (confirmed by reading
      `use-search-params.md` directly rather than assuming) — added `<Suspense fallback={null}>` around
      `<DamageCalculator />` in `src/app/damage-calc/page.tsx`. Verified: `npx tsc --noEmit`, `npm run lint`,
      `npm test` (147/147) all clean, **and `npm run build`** (the actual missing-Suspense failure mode only
      surfaces in a production build, not `next dev` — confirmed clean, all 4 routes still prerender static);
      live browser check clicking the new calculator icon on the "M-Staraptor-Milotic Sand" opponent opened a
      new tab at `/damage-calc?opponentId=...` with the Attacker already showing the active team (Grimmsnarl)
      and the Defender showing that opponent's full 6-Pokémon roster (Tyranitar first, matching the card's
      own display order), both sidebars fully populated with sprites.
    - Damage Calculator: fixed a real correctness gap — Foul Play was being computed with the ATTACKER's own
      Attack stat, when its actual mechanic uses the DEFENDER's own Attack stat (and Attack stage) instead,
      per the user's question ("does move Foul Play take consideration targets attack for damage, can you
      take a look how we calculate that"). It had zero special-casing anywhere in `calculateDamage.ts` — just
      a plain 95 BP Dark-type Physical move like any other, always reading `attackerStats[attackStatKey]`.
      Added `TARGET_ATTACK_STAT_MOVES` (currently just `foul-play`) and swapped the attack-stat/stage source
      to the defender's when the move is in that set — reusing the exact same "crit ignores an unfavorable
      stage" logic already in place, just pointed at the other Pokémon's stat/stage. Everything else about
      the hit (STAB from the attacker's own type, the attacker's item/ability modifiers, the defender's own
      Defense stat) is unaffected, matching the real mechanic. This also naturally excludes the defender's
      ability-based Attack multipliers (Huge Power, Guts, ...) from the figure used, since
      `calculateFinalStats` already keeps those out of the raw stat everywhere in this engine — no extra
      filtering needed. Noted Body Press (uses the ATTACKER's own Defense stat as its attack term — a
      related but different quirk) as an explicitly out-of-scope case in the new code comment, since it
      wasn't what was asked about. Added 6 new unit tests to `calculateDamage.test.ts`: the attacker's own
      Attack investment/stat stage has zero effect on the damage; the defender's Attack investment/stat stage
      does affect it (both directions); a crit ignores a negative defender Attack stage (the stat actually in
      play); STAB still comes from the attacker's own type. Verified: `npx tsc --noEmit`, `npm run lint`,
      `npm test` (153/153) all clean; live browser check on the existing Grimmsnarl/Venusaur matchup confirmed
      raising Venusaur's (defender) Atk Stat Points from 102 to 134 final raised Foul Play's damage from
      34.8-41.3% to 45.8-54.2%, while separately raising Grimmsnarl's (attacker) own Atk from 126 to 154 left
      the damage completely unchanged at 45.8-54.2%.
    - **Formula audit against the NCP-VGC-Damage-Calculator reference.** Per the user asking to verify our
      math against that reference directly, rather than only spot-checking output numbers as earlier entries
      had done — cloned the actual repo (`nerd-of-now/NCP-VGC-Damage-Calculator`, into the scratchpad, not
      committed) and read its real formula source (`script_res/damage_SV.js`, `damage_MASTER.js`'s
      `calcAtMods`/`calcDefMods`/`calcFinalMods`/`calcGeneralMods`/`calcBaseDamage`) line-by-line against
      `calculateDamage.ts`, rather than treating the earlier "cross-check a few outputs" verification as
      sufficient on its own. Found and fixed two real, confirmed value bugs:
      - **Type-resist Berries were ×0.75, should be ×0.5.** The reference's `calcFinalMods` pushes
        `0x800/0x1000` = exactly 0.5 for every resist Berry, unconditionally across every generation this app
        targets — not a "50% pre-Gen 6, 25% from Gen 6 on" distinction as the code comment previously (and
        incorrectly) claimed. That comment was this session's own mistake, introduced when the berries were
        first added — confirmed via this audit, not something carried over from anywhere else. Fixed
        `TYPE_RESIST_BERRIES`' multiplier in `itemDamageModifiers.ts` (Chilan Berry was already correct at
        0.5, unaffected). Strengthened the existing berry test from a loose `toBeLessThan` check to an exact
        `floor(fullDamage * 0.5)` assertion.
      - **Screens (Reflect/Light Screen/Aurora Veil) don't get weaker in Doubles.** The real games use
        ×2732/4096 (≈0.667) in Doubles/multi-battle formats instead of ×0.5 — a real, documented VGC mechanic
        this app had simply never modeled (the very first Full Singles Accuracy plan explicitly deferred
        "screens are 2/3 not 1/2 for spread moves" as doubles-only and out of scope at the time — but this app
        now defaults to Doubles, per an earlier session's Singles/Doubles toggle, so the deferred gap was
        actually live and affecting the default experience). Added `DamageCalcOptions.isDoublesFormat`
        (field-wide, distinct from `attackerHitsMultipleTargets` which is about one specific move's target
        count), wired from `DamageCalculator.tsx`'s existing `battleFormat` state; `screenMultiplier()` now
        takes an `isDoublesFormat` param and picks the right fraction. Added 2 new tests (the Doubles value is
        meaningfully weaker than Singles but still reduces damage; omitting the option matches the old
        Singles-only default, so no existing calc silently changes).
      - **Confirmed correct, no change needed:** the core Level-50 base-damage formula
        (`floor(floor(floor(2L/5+2)*power*attack/defense)/50)+2`) matches exactly; every other spot-checked
        modifier value matched ours precisely — Technician (1.5, ≤60 BP), Huge Power/Pure Power (2.0,
        Physical), Thick Fat (0.5, Fire/Ice), Filter/Solid Rock (0.75, super-effective only), Choice Band/
        Specs (1.5), Guts (1.5), Life Orb (1.3), Expert Belt (1.2, super-effective only), Friend Guard (0.75),
        type-boosting items (1.2), Fairy Aura (1.33), Muscle Band/Wise Glasses (1.1), Ice Scales (0.5,
        Special), Dry Skin (1.25 vs. Fire); and Foul Play — the reference literally has
        `attackSource = move.name === "Foul Play" ? defender : attacker` in the same spot, independently
        confirming the earlier fix in this same session was exactly right.
      - **Known, deliberate structural difference, not fixed in this pass:** the reference applies damage
        modifiers via the real games' own fixed-point "chain modifiers" system — each stage (base power mods,
        attack-stat mods, defense-stat mods, then STAB, type effectiveness, and a combined chain of every
        other modifier) is applied and ROUNDED SEPARATELY at each step (`pokeRound`, which rounds exactly
        .5 DOWN — a genuine Game Freak engine quirk), and critically, the 85%-100% random roll is applied
        immediately after `calcBaseDamage`, BEFORE STAB/type effectiveness/other modifiers — not last, as
        `calculateDamage.ts` does. This engine instead multiplies every modifier together as plain floats and
        floors once at the very end, then applies the roll percent. For a single modifier this rarely
        diverges; empirically (the new Doubles-screens test) a realistic multi-step case came out 1 damage
        point off from the reference's own step-order (99 vs. an expected 98) — small, and unlikely to
        qualitatively flip a KO read on its own, but a real, quantifiable source of drift under enough
        stacked modifiers, flagged here rather than silently glossed over. Fully matching this would mean
        restructuring the modifier chain and roll loop to mirror the reference's exact stage order and
        rounding function — a substantial rewrite of `calculateDamage.ts`'s core, not attempted unless
        explicitly requested. Also noted for later: the reference lists a few other "uses a different stat
        source" quirks beyond Foul Play — Body Press (attacker's own Defense as its attack stat) and Photon
        Geyser/Light That Burns The Sky/Shell Side Arm/Tera Blast (uses whichever of Atk/SpA is higher) — none
        modeled here yet, out of scope for this pass since they weren't what was asked about.
      Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (155/155) all clean; live browser check on the
      existing Grimmsnarl/Venusaur matchup (Foul Play, Reflect up on the defender's side) confirmed Singles
      shows exactly half damage (17.4-20.6%, down from 34.8-41.3% with no screen) while Doubles shows the
      weaker ~2/3 reduction (23.2-27.7%) — matching the reference's own distinction precisely.
    - **Precision rewrite: matched the real games' exact fixed-point damage algorithm.** Per explicit
      follow-up to the formula audit above ("let's try to be as precise as we can") — the audit had flagged
      one remaining structural gap (this engine applied every modifier as one combined float multiplication,
      floored once at the end, instead of the real games' own step-by-step fixed-point "chain modifiers"
      system) as a known limitation rather than fixing it; this entry closes that gap. Read
      `damage_SV.js`/`damage_MASTER.js`'s full `calcBPMods`/`calcAtMods`/`calcDefMods`/`calcFinalMods`/
      `calcGeneralMods`/`calcBaseDamage`/`chainMods`/`pokeRound` from the reference and reimplemented
      `calculateDamage.ts`'s core to match exactly:
      - `pokeRound(num)` — Game Freak's own rounding rule (exactly .5 rounds DOWN, not up like
        `Math.round`) — and `chainMods(mods)` — combines a list of 4096ths (`0x1000`) fixed-point modifiers
        via the real games' own sequential algorithm (`Math.round` at each intermediate step, skipping
        neutral/`×1` entries) — added as the two core primitives, ported faithfully from the reference.
      - Every modifier now applies at its OWN correct stage, not one flat end-of-calc multiplier: base power
        (`bp` — Technician, Helping Hand, terrain, type-boosting items, Muscle Band/Wise Glasses, Fairy Aura,
        Dry Skin), the attack stat (`at` — Choice Band/Specs, Guts, Huge Power/Pure Power, and — surprisingly,
        confirmed against the reference rather than assumed — Thick Fat/Heatproof, which reduce the
        ATTACKER's effective attack stat even though they're defender-side abilities), the defense stat
        (`df` — Assault Vest, Fur Coat; Sand/Snow's boost applies as its own separate direct step first, "unlike
        all other defense modifiers" per the reference's own comment), and a `final` stage applied once per
        85-100% roll alongside STAB/type effectiveness/burn (screens, Friend Guard, Filter/Solid Rock, Ice
        Scales, Expert Belt, Life Orb, resist Berries). `AbilityDamageModifierSide`/`ItemDamageModifier`
        gained `multiplier4096` (the exact hex constant, not a re-derived decimal — Life Orb's real value is
        `0x14CC` = 1.2998..., which is NOT what `round(1.3 * 4096)` gives, `0x14CD` — a precision loss the
        old plain-float approach was already silently carrying) and a `stage` field; every ability/item
        entry was individually re-verified and re-bucketed against the reference's source, not just
        decimal-converted.
      - The 85-100% random roll now applies immediately after `calcBaseDamage` — BEFORE STAB, type
        effectiveness, burn, and every `final`-stage modifier — matching the reference's exact order
        (previously last, after everything). Spread (×0.75)/Weather (×1.5 or ×0.5)/Critical hit (×1.5) apply
        directly to `baseDamage`, each as its own step, before the roll — Spread and Weather via `pokeRound`,
        but Critical hit via plain `Math.floor` (confirmed as a deliberate distinction in the reference's own
        `calcGeneralMods`, not an oversight to normalize away). STAB is its own dedicated `pokeRound` step
        (not chained with anything), and — a genuine, previously-nonexistent gap — **Adaptability is now
        actually implemented** (STAB ×2.0 instead of ×1.5): a prior code comment in
        `abilityDamageModifiers.ts` claimed this was "special-cased" in `calculateDamage.ts`, but no such
        code actually existed anywhere in the file before this pass — Adaptability had zero effect.
      - Also picked up, while re-deriving each terrain modifier's exact stage/value from the reference:
        Grassy Terrain halves Earthquake/Bulldoze specifically against a grounded defender (a real, separate
        mechanic from its general Grass-move boost, not previously modeled) — and confirmed the terrain
        attack-boost value is `0x14CD` (≈1.3, the modern Gen 8+ value this app already had) rather than the
        older `0x1800` (1.5) pre-Gen-8 value, so no change needed there, just confirmation.
      - Updated the one pre-existing test whose hardcoded roll list actually changed (the very first
        Garchomp/Ditto Earthquake test — recomputed and independently hand-verified via a throwaway Node
        script using the documented new algorithm, not just accepted from the code's own output) and
        strengthened the Doubles-vs-Singles screens test from an approximate `toBeCloseTo` check to an exact
        `toEqual` on the full 16-roll list (also independently hand-verified). Added new coverage for
        Adaptability (2 tests) and for every ability/item whose stage bucket the rewrite actually touched —
        Technician, Huge Power, Thick Fat, Fur Coat, Assault Vest, and the new Grassy Terrain/Earthquake
        case (7 tests) — since none of these had ANY dedicated test before this pass despite being
        real, shipped behavior.
      - One self-caught bug during the rewrite itself: the base-power modifier chain (`bpMods`) was computed
        but never actually multiplied into the damage formula on the first pass — caught immediately by an
        unused-variable ESLint warning (`finalBasePower` assigned but never read) before it ever reached a
        test run, not by a wrong test result.
      Verified: `npx tsc --noEmit`, `npm run lint`, `npm test` (163/163, 8 new tests) all clean, **and
      `npm run build`** (confirmed the rewrite doesn't affect the earlier Suspense-boundary requirement; all
      4 routes still prerender static); live browser re-check of the exact scenario from the "audit" entry
      above (Foul Play, still 34.8-41.3% baseline, unchanged) plus a fresh Colbur Berry vs. Gengar check
      (Dark is 2x super-effective against Ghost) showing 85.9-102.2% drop to exactly 43-51.1% — a clean half,
      confirming the corrected 0.5 resist-Berry multiplier survived the full rewrite intact.

## 8. Attribution

- Team paste format: [Pokémon Showdown](https://pokemonshowdown.com/) export format.
- Sprites: [HybridShivam/Pokemon](https://github.com/HybridShivam/Pokemon) (web-scraped from
  Bulbapedia), self-hosted locally (compressed) under `public/pokemon-sprites/thumbnails-compressed/`.
- Item icons: [PokeAPI/sprites](https://github.com/PokeAPI/sprites); newer Mega Stone icons missing from
  that repo are user-supplied, self-hosted under `public/items/` (Mega Stones under `mega-stones/`).
- Species/form data for building the static lookup table: [PokeAPI](https://pokeapi.co/).
- Move/type-chart data for the damage calculator: also [PokeAPI](https://pokeapi.co/) (bulk CSV export).
  The damage formula and ability/item modifier scope were guided by
  [NCP-VGC-Damage-Calculator](https://github.com/nerd-of-now/NCP-VGC-Damage-Calculator) (MIT licensed).
- Regulation M-B legality data for the "add any Pokémon" feature: species list from
  [Bulbapedia's Regulation Set M-B page](https://bulbapedia.bulbagarden.net/wiki/Regulation_Set_M-B); item
  list from [RotomPicks](https://rotompicks.com/en/items/).
