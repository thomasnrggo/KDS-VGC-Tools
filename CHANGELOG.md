# Changelog

What shipped and when — a record of the project's progress, not a public release notes page.
Newest first. The app isn't versioned, so entries are grouped by date. [PLANNING.md](./PLANNING.md)
holds the reasoning behind each change; this file is the short "what and when".

Format loosely follows [Keep a Changelog](https://keepachangelog.com): **Added**, **Changed**,
**Fixed**, **Removed** under each date.

## 2026-10-21

### Added
- A search box on the team page's Calcs tab: type a Pokémon (e.g. "Gholdengo") to see, under each
  of your Pokémon, only its calcs against that one. Works with the Pokémon names in either language.
- Damage Calculator: saving a calc that's already saved on that Pokémon does nothing; the save
  button shows a check ("Already saved on your team") instead.

### Fixed
- Damage Calculator: against Focus Sash or Sturdy the damage rolls show the move's real damage
  (they were all capped at the target's HP minus 1); the verdict accounts for the save and says so
  ("guaranteed 2HKO (Focus Sash)").
- Damage Calculator: Life Orb's recoil rounds down (a tenth of max HP, rounded down), like the
  games; it was rounded up (e.g. 10.1% instead of 9.5%).

## 2026-10-19

### Changed
- The Damage Calculator's calc line names what else changed the damage, like Showdown's: an ability
  that mattered ("Tough Claws Mega Metagross", "… Multiscale Dragonite"), "burned" when a burn
  halved the hit, and "Fairy Aura boosted" before a Fairy move.
- The team page's Calcs tab shows one Pokémon per row on phones (two from 640px), so the calc
  lists have room.

### Fixed
- The Damage Calculator's calc line now says "in Electric Terrain", "in Sun" (or "in Sun and
  Electric Terrain") when the field's weather or terrain changed the damage, like Showdown's. A
  Mega-evolved Pokémon is written as its form ("Mega Staraptor") instead of "Staraptite Staraptor".

## 2026-10-15

### Added
- **Save calcs to your team** from the Damage Calculator: one click on the button next to "Copy"
  saves the calc line (plain text, Showdown format) on your active team, under the left-side
  Pokémon — offensive when it's that Pokémon's move, defensive when it's the right side's.
- A **Calcs tab** on the team page: each Pokémon's card, collapsed to its sprite header until
  clicked, with its saved calcs underneath in collapsible Offensive and Defensive lists (with a
  remove button).
- Damage Calculator: a dashed "+" tile after each side's roster (and in the phone bar) adds a blank
  Pokémon and opens it, while the roster has room (up to 6).
- **Damage Calculator sets.** "Save set" in the Pokémon panel saves the current build (item,
  ability, nature, Stat Points, moves) under a name. Your sets are saved in the browser and sync
  to your account when signed in. The admin can save **public sets** that everyone sees. Sets
  show under their species in the Pokémon picker, tagged "Mine" or "Public", with rename and
  delete in place; saving under an existing name replaces that set. After picking (or saving) a
  set, "Save set" opens with its name filled in, so saving again overwrites it. Renaming a set to a
  name its species already uses is refused.
- The Damage Calculator remembers the right-hand side (its Pokémon, which one is open, Mega and
  Stat Point/nature edits) in the browser, so leaving the page and coming back resumes the work.
  Opening it from an opponent's "Open in Damage Calculator" still loads that opponent instead.
- **Damage Calculator accuracy pass**, checked roll for roll against Showdown's own damage calculator
  (including its Pokémon Champions mode): ~25 more abilities (Pixilate, Tough Claws, Sheer Force,
  Multiscale, Fluffy, Sharpness, Mega Sol, Aura Guard, …), variable-power moves (Low Kick, Grass
  Knot, Heavy Slam, Gyro Ball, Last Respects, Knock Off, Weather Ball, …), Body Press and Psyshock's
  stat swaps, Parental Bond. A "Fainted allies" input for Last Respects.
- The Damage Calculator is translated (English/Spanish), with its nav link and "Open in Damage
  Calculator" in an opponent's menu back.

### Changed
- **The Damage Calculator is open to everyone**: its feature flag is gone, so its nav link always
  shows.
- "Open in Damage Calculator" is back as a calculator icon next to each opponent's name in the
  Matchup Planner (it had moved into the ⋮ menu), and now works for prep-group opponents too.
- The main menu is reordered: My Teams, Matchup Planner, Damage Calculator, Speed Tiers,
  Tournaments.
- Damage Calculator: each move's Crit toggle and its Effect count (Last Respects, Rage Fist) or hit
  count (multi-hit moves) moved from the Pokémon editor's move slots onto the move's row in the
  move list, right after the move's name (the damage stays on the right).
- Damage Calculator on phones and tablets: the open side's roster moves to a bar fixed to the bottom
  of the screen (like the Matchup Planner's team bar) and follows the side tabs; tap a Pokémon to
  open it, or the open one's × to remove it. The result card drops the VS sprites there, since the
  side tabs already show both Pokémon.
- Damage Calculator Field panel: the Weather and Terrain labels and their "None" buttons are gone;
  click the active weather or terrain again to turn it off.
- Damage Calculator: neither side is ever empty. Both start on the regulation's first Pokémon
  (the left side still loads your active team when there is one); removing the open Pokémon opens
  its neighbor, and removing the last one puts the default Pokémon back.
- Damage Calculator move lists: each move is a higher-contrast pill with its type icon on a slanted,
  type-colored cap, and the selected move gets a solid dark highlight. The result card shows the
  two Pokémon centered on top (left side vs. right side, shown even before a move is picked) and a button beside the calc line that
  copies it, in Showdown format, to the clipboard.
- Damage Calculator layout: the two Pokémon get more room (narrower middle column). Below 1280px the
  field moves into a drawer opened from a "Field setup" button in a bar that sticks to the top of
  the screen, right under the site header, with the page title in it (styled like the Matchup
  Planner's team bar). The button shows what's set as chips: each side's own
  conditions (Tailwind, screens, …) on its side, attacker left and defender right, and what applies
  to both (weather, terrain, Gravity, Fairy Aura) in the middle; the Pokémon sit side by side from 1024px.
  Below 1024px the two sides are tabs (each Pokémon's sprite) in that bar, above the Field setup
  button: only the open side's moves and panel show, under the result, with the roster as a
  row after the moves on phones.
- Header: its bottom border (and the Matchup Planner's bottom team bar's) is gray instead of white.
- Header: the active-team strip shows from 1280px; between 1024 and 1280px it overlapped the page
  links, so the Matchup Planner uses its bottom team bar there too.
- Damage Calculator: the Pokémon search is now a compact dropdown listing each species with its sets
  underneath (Showdown-style), instead of the Team Builder's search with abilities and base stats.
  Only "Blank Set" for now; sets from your teams, opponents and saved sets come next.
- Damage Calculator: the stats are one compact line each (stat, base, SP, slider, final, stage),
  plus the stat's in-battle value next to the stage, shown only when something changes it: stage,
  item (Choice Scarf/Band/Specs, Assault Vest, Iron Ball), ability (Huge Power, Guts, Swift Swim,
  …), weather, Tailwind, paralysis. Hover it for what's changing it. Final now shows Speed without
  the Choice Scarf.
- Damage Calculator: item and ability are plain name-only searchable lists, instead of the Team
  Builder's detailed rows with descriptions. Moves too, one per row, each with its own **Crit**
  toggle (replacing the field's single "Critical Hit") and, where it applies, an **Effect** count
  (Last Respects' fainted allies, Rage Fist's times hit) or a **Hits** count (Bullet Seed 2-5,
  Population Bomb 1-10, Triple Axel 1-3). Enter picks the top result in these searches. Clearing
  a move leaves its slot empty instead of moving the others up.
- Damage Calculator: one line under the stats with the Stat Points remaining (x / 66) and the
  nature. Stat Points are now capped at 66 in total, as in the game.

### Fixed
- The Damage Calculator's calc line now writes its % range the way Showdown does ("25.8 - 31%").
- Damage Calculator: Protect no longer blocks contact moves from Unseen Fist (Mega Golurk) or
  Piercing Drill (Mega Excadrill); both hit through it at 1/4 damage, as in Pokémon Champions.
  The calc line notes "through Protect".
- Damage Calculator roster tiles: the item badge is no longer cut off at the corner, and the
  sprite shows the Mega form (following the Mega toggle for the open Pokémon) like the calc's other
  sprites.
- Damage Calculator: Assault Vest no longer reduces Psyshock (it hits Defense).
- Damage Calculator: Rage Fist's power now grows with the times the user was hit; Population Bomb
  is calculated as up to 10 hits (it was a single hit); a multi-hit move's total counts every hit,
  even past a KO, like Showdown's calc (stopping at the KO could show a range like 189-175).

## 2026-10-14

### Added
- **Prep groups (collaborative Matchup Planner):** a shared opponent list for an event. Members add,
  edit, tag, group and order opponents together, live; each player's picks and notes stay private.
  Invite by link, several groups (one per event), archive, leave, owner removes members. Only the
  group's owner or whoever added an opponent can remove it. Copy opponents between your list and a
  group. See [docs/prep-groups.md](./docs/prep-groups.md).

## 2026-10-13

### Added
- **Localization: English and Spanish.** A language menu in the header with two separate settings:
  the app's own text (English / Español) and the official Pokémon names (English, Spain Spanish or
  Latin-American Spanish) for Pokémon, forms, moves, items, abilities, types and natures. Saved
  data, pastes and exports stay in English. Search matches names in both languages, ignoring
  accents. See [docs/localization.md](./docs/localization.md).
- `npm run generate:names` to regenerate the localized name data from PokeAPI.

### Changed
- **Pokémon picker** (Matchup Planner lead/back, Strategy combinations, tournament game picks): a
  Pokémon can only be in one slot of a group. Ones already used show dimmed with a tag ("L1",
  "B2", "#3"); picking one swaps it with the current slot. Older data with a repeat gets a warning
  ring on the repeated slot.
- **Pokémon quick card** (the hover/click card on rosters and picks) shows what matters at a glance:
  ability, item, the nature as the stat it raises and lowers, Speed, and the moves. An
  opponent's Speed is a best-guess range (single value when its nature implies max or no
  investment); your own Pokémon's is exact. Speed-doubling abilities (weather abilities, Unburden)
  add a "×2" line. The six-stat block moved out of this card — it stays on the Team Report cards.
- **One Mega per side:** turning a Mega on turns the others off, and a second Mega-capable pick
  starts in its base form. Older plans with two Megas on show only the first.
- Strategy tab: each common combination shows Leads above Back, with its notes box beside them
  matching their height.

### Fixed
- The Pokémon hover/click card and the tournament round's opponent cards show the Mega form's
  ability (Mega Raichu X: Electric Surge), not the pasted base ability.
- Only one Pokémon card is open at a time: hovering a lead/back pick closes an opponent card opened
  by click, and the other way round.
- Navigating between pages no longer makes the header's team (and the signed-in avatar) disappear
  and reappear: the signed-in user, teams, opponents and tournaments stay in memory between pages
  and refresh in the background.
- Opening a lead/back picker (or a Pokémon card) no longer makes the page jump: for one frame the
  dropdown sat in the page flow, pushing the rows below it down and back.

## 2026-10-12

### Added
- **Opponent organization:** manual ordering (drag or menu), tags with suggestions,
  duplicate-team detection on import, and variants (alternate versions of a team grouped under a
  main team, sharing its plan).
- **Team Report rework:**
  - Compact Pokémon cards (six per row) with a Stat Points table and type-coloured move pills.
  - A team "post" with creator, Poképaste link, replica code and a rich-text overview, plus an edit
    mode that also edits the name and the paste (with a live preview).
  - Sharing as a private or public link with an open or closed team sheet, on a public
    `/shared/[teamId]` page.
  - Strategy tab with two columns (common combinations and notes), and a breadcrumb title.
- Team Report calcs and matchups (benchmark calcs, per-opponent prep pages), built but hidden while
  on hold.

### Changed
- My Teams rows: the menu only has Archive and Remove. Name and paste are edited on the team's page.

### Fixed
- Z Mega abilities: Mega Garchomp Z now has Levitate, Mega Absol Z Sharpness, Mega Lucario Z Aura
  Guard.

## 2026-10-11

### Fixed
- Opponent team sort order.

## 2026-09-15

### Added
- More admin functions and feature flags per section.

### Changed
- Theme update.

## 2026-09-08

### Added
- **My Teams** and **Tournaments** sections.
- **Speed Tiers** page, with numeric speed search and a grouped view.

## 2026-09-01

### Fixed
- Matchup Planner styles and layout on mobile and tablet.

## 2026-08-23

### Added
- Support for multiple regulations.
- My Team section.

## 2026-08-22

### Added
- Firebase: Google sign-in, with teams and opponents synced across devices through Firestore.

### Changed
- Damage calculator hidden from the nav while its known issues are worked out.

## 2026-08-20 – 2026-08-21

### Added
- Damage calculator, reworked to match Game Freak's damage formula.

### Fixed
- Importing into the damage calculator, and its layout.

## 2026-08-12

### Added
- Opponent search.
- Onboarding and missing sprites.

### Fixed
- Team selection in the mobile header, the lead/back picker interaction, and sprite sizes.

## 2026-08-11

### Changed
- Calculation updates, hover card design, and stats calculation.

## 2026-08-10

### Changed
- Design and experience updates.
- Smaller build: removed the Material Symbols library and serve Pokémon sprites unoptimized.

## 2026-08-09

### Added
- The app's own Pokémon sprites, team display and selection in the header, and stats calculation.

## 2026-08-08

### Added
- **First version: the Matchup Planner.** Paste your team, paste opponents, plan leads and backs.
- Deployment setup.
