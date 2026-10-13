# Changelog

What shipped and when — a record of the project's progress, not a public release notes page.
Newest first. The app isn't versioned, so entries are grouped by date. [PLANNING.md](./PLANNING.md)
holds the reasoning behind each change; this file is the short "what and when".

Format loosely follows [Keep a Changelog](https://keepachangelog.com): **Added**, **Changed**,
**Fixed**, **Removed** under each date.

## Unreleased

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
