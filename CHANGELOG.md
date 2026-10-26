# Changelog

What shipped and when — a record of the project's progress, not a public release notes page.
Newest first, grouped by version (0.1.0 is grouped by date inside, from before versioning started). [PLANNING.md](./PLANNING.md)
holds the reasoning behind each change; this file is the short "what and when".

Format loosely follows [Keep a Changelog](https://keepachangelog.com): **Added**, **Changed**,
**Fixed**, **Removed** under each version. New entries go under "Unreleased"; every push to main
(or merge request) becomes the next patch version (0.2.0, 0.2.1, 0.2.2, …): "Unreleased" is
renamed to that version and date, `package.json`'s version is bumped to match, and the commit is
tagged `vX.Y.Z`. The minor or major number only changes when the project owner says so.

## Unreleased

0.2 is about making the existing features better and more stable rather than adding new ones —
starting with the experience on a phone.

### Added
- Footer: "Enjoying this project?" with a Buy me a coffee button (buymeacoffee.com/thomasnrggo, opens
  in a new tab), on the same line as the credit (wrapping under it on phones).

### Changed
- Sliders (Stat Points and current HP, in the calculator and the Team Builder) are green: a light
  track filled in green up to the value, with a round green knob, the same in every browser and
  in both themes.
- Damage Calculator on wide screens: the Field panel between the two Pokémon has a slightly darker
  background (its unpressed options stay white), so the middle of the page has some contrast. The
  right side's conditions label is right-aligned, mirroring the left.
- Damage Calculator: Fairy Aura turns on by itself when Mega Floette comes onto either side (picked,
  switched to in the roster, loaded with a team, or Mega toggled on), like weather abilities set
  the weather. Turning Mega off clears it again unless the other side's Pokémon has Fairy Aura too;
  it can still be switched off by hand.
- Damage Calculator on wide screens: smaller "X vs Y" sprites at the top of the result card (48px,
  down from 80px).
- The calculator's menu link reads "Damage Calculator" ("Calculadora de daño") instead of "Damage
  Calc".
- Damage Calculator on desktop: a set can be filled in from the keyboard alone. The item, ability,
  nature and move lists take the arrow keys (starting on the current pick) and Enter picks the
  highlighted row; Escape closes a list and Tab moves on with it closed. Picking with Enter moves
  the focus to the next field and opens its list, in the order Pokémon → item → ability → the six
  Stat Points boxes (Enter steps through them; typing replaces the number) → nature → moves 1–4.
  Picking with the mouse doesn't move the focus.
- Damage Calculator's Load Team: a search box (by Pokémon, item, tag or team name, every word has to
  match, like the Opponents list) and a small preview of each team's Pokémon with their items on
  the same line as its name, instead of just the name and "6 Pokémon". It can list your own opponents
  or any of your prep groups', starting on whichever the Matchup Planner last showed, and teams whose
  paste had no Stat Points are flagged under their name ("No Stat Points: loads as 0 in every
  stat", or how many of the six are missing them).
- Damage Calculator: import is split into Import Pokémon (adds one to the side's roster) and Import
  Team (replaces it), and the import/export dialogs and toasts no longer name the side ("Export
  Team", not "Export Attacker Team"). On phones the row of links is one "Import & export" button
  that opens a bottom sheet, and the dialogs open full screen with the text box filling the space
  (the keyboard no longer pops up over the import box before you paste). On wider screens the
  row is Load Team on the left (when there are saved opponents) and "Import" (one Pokémon) and
  "Export" (the current set) on the right, with Import Team and Export Team in a "⋯" menu.
- Damage Calculator: the result card is highlighted in soft amber once there's a calc (a faint warm
  tint in dark mode), so the line you came for stands out from the panels around it. In the line,
  the percentage and the KO chance are bold instead of the HP range, and the percentage never
  breaks across lines. The copy/save buttons moved down beside the damage rolls (now just the rolls in
  parentheses, like Showdown's calc), so the calc line uses the card's full width.
- Damage Calculator: the picker sheets and field labels name the Pokémon instead of the side
  ("Garchomp move 4", "Garchomp item" rather than "Defender move 4"), since either side can be the
  attacker.
- Site header on phones and tablets: the header row is just the logo and the menu button. The menu
  opens as its own full screen under the header (the page's sticky bars no longer show through and
  the page behind it doesn't scroll): your account at the top, then the pages, then Language (a
  sub-screen for the app and Pokémon-name languages), a Dark mode switch and Sign out at the
  bottom. Wide screens are unchanged.
- Damage Calculator on phones: the Pokémon/set, item, ability, nature and move pickers open as a
  full-screen search sheet sized to the space above the keyboard, with larger rows and the current
  pick checked, instead of a dropdown the keyboard covered. Short lists (abilities, natures) open
  without raising the keyboard. Saved sets' rename/delete buttons are always visible on touch
  screens.
- Damage Calculator on phones and tablets: the pinned bar at the top is one row — each side's
  Pokémon as a square sprite button (no name) with a wide Field button between them — and one line under it showing what's set under
  each button: the first modifier and a "+N" for the rest, so the bar stays the same height however
  many are on. Tapping that line opens the field setup too.
- Damage Calculator on phones and tablets: the move list has a switch with both Pokémon's sprites,
  so you can see the other side's moves (and pick one to calc) without leaving the Pokémon you're
  editing. The side tabs at the top still switch both.
- Damage Calculator on phones: less padding around the page and inside the panels, so the fields
  and stat table get about 30px more width.
- Stat table on phones (Damage Calculator and Team Builder): the base stat sits in small text under
  the stat's name instead of in its own column, so the Stat Points slider is noticeably
  wider and easier to drag; the number box stays for typing an exact value.
- Damage Calculator on phones: Nature and Status sit side by side under the stat table with their
  labels on top, like Item and Ability, and the current-HP slider gets the full width.
- Damage Calculator on phones: the four move fields are a 2×2 grid; a long name wraps onto a
  second line instead of being cut off. Removing a move is a "Remove …" row at the top of its
  picker, which frees the field's width for the name.
- Damage Calculator: each side's panel no longer shows an "Attacker"/"Defender" heading or the
  "Regulation: Regulation M-C" line. Either side can attack, so the panels go by their Pokémon
  (the side tabs, "X's moves"); Export/Import move up to the top.

- Damage Calculator: Status uses the app's own picker, like Nature and Item, instead of the
  browser's native dropdown (on phones, the same full-screen sheet).

### Fixed
- Damage Calculator field effects, checked against the games:
  - a critical hit now ignores Reflect, Light Screen and Aurora Veil (it used to be reduced by them);
  - Rising Voltage doubles against a grounded target in Electric Terrain; Misty Explosion (grounded
    user, Misty Terrain) and Psyblade (Electric Terrain) get ×1.5;
  - Hydro Steam is boosted ×1.5 in Sun instead of halved;
  - Utility Umbrella: a holder takes no Sun/Rain damage change, and its own Weather Ball, Solar
    Beam and Hydro Steam ignore Sun/Rain.
- Mega Floette written as "Floette-Eternal" (how Showdown exports it) got its base ability instead
  of Fairy Aura in the calculator and Speed Tiers.
- Faster loading without lists swapping: My Teams, the Matchup Planner, Tournaments and the
  header's team show the copy saved on this device right away and sync with the cloud in the
  background, updating only if something changed (a spinner shows only on a device with nothing
  saved yet). The Matchup Planner no longer shows your own opponents first and then switches to the
  prep group it was left on. Firestore now keeps a local cache, so a prep group's list shows in
  about 0.4s on a reload instead of 1–2s.
- Damage Calculator on tablets and touch screens: tapping a move, item or ability field no longer
  opens the device's text menu (iPadOS's Cut/Copy/Look Up bar, or the right-click menu in Chrome's
  iPad emulation) along with the list. On touch the field empties for a fresh search, with the
  current pick shown faintly until you type, and comes back if you close without picking. Mouse and
  keyboard still select the text so you can type over it.
- Notifications (e.g. "Copied calculation to clipboard") appear above the bar fixed to the bottom
  of the screen — the Damage Calculator's Pokémon bar, the Matchup Planner's team bar — instead of
  covering it.
- Damage Calculator on phones and tablets: the page no longer scrolls past the last panel into an
  empty gap with the footer hidden behind the roster bar. The page ends just above the bar, and
  the footer is hidden there (it still shows on wide screens and on the other pages).
- On phones, the pinned header no longer flashes white while scrolling (removed an unneeded blur
  effect, and the calculator's bar now pins exactly under the header with no hairline gap).
- On phones, iOS no longer zooms the page in when a field (Stat Points, stage, …) is tapped.

## 0.1.0 — 2026-08-08 to 2026-10-23

The first version: paste a team and its opponents, plan leads and backs, damage calculator, speed
tiers, tournaments, groups and the team page's saved calcs.

### 2026-10-23

#### Added
- Damage Calculator: an "Unburden active" toggle next to Status for a Pokémon with Unburden; on, it
  doubles the Speed shown in the panel (for once its item is gone).

#### Fixed
- Female Indeedee is available in Regulation M-C (the Damage Calculator's Pokémon search and
  anywhere else the regulation's Pokémon are listed); only the male form was there.

### 2026-10-22

#### Added
- A "Clear all calcs" button on the team page's Calcs tab removes every saved calc from the team,
  after a confirmation.

### 2026-10-21

#### Added
- A search box on the team page's Calcs tab: type a Pokémon (e.g. "Gholdengo") to see, under each
  of your Pokémon, only its calcs against that one. Works with the Pokémon names in either language.
- Damage Calculator: saving a calc that's already saved on that Pokémon does nothing; the save
  button shows a check ("Already saved on your team") instead.

#### Fixed
- Damage Calculator: against Focus Sash or Sturdy the damage rolls show the move's real damage
  (they were all capped at the target's HP minus 1); the verdict accounts for the save and says so
  ("guaranteed 2HKO (Focus Sash)").
- Damage Calculator: Life Orb's recoil rounds down (a tenth of max HP, rounded down), like the
  games; it was rounded up (e.g. 10.1% instead of 9.5%).

### 2026-10-19

#### Changed
- The Damage Calculator's calc line names what else changed the damage, like Showdown's: an ability
  that mattered ("Tough Claws Mega Metagross", "… Multiscale Dragonite"), "burned" when a burn
  halved the hit, and "Fairy Aura boosted" before a Fairy move.
- The team page's Calcs tab shows one Pokémon per row on phones (two from 640px), so the calc
  lists have room.

#### Fixed
- The Damage Calculator's calc line now says "in Electric Terrain", "in Sun" (or "in Sun and
  Electric Terrain") when the field's weather or terrain changed the damage, like Showdown's. A
  Mega-evolved Pokémon is written as its form ("Mega Staraptor") instead of "Staraptite Staraptor".

### 2026-10-15

#### Added
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

#### Changed
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

#### Fixed
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

### 2026-10-14

#### Added
- **Prep groups (collaborative Matchup Planner):** a shared opponent list for an event. Members add,
  edit, tag, group and order opponents together, live; each player's picks and notes stay private.
  Invite by link, several groups (one per event), archive, leave, owner removes members. Only the
  group's owner or whoever added an opponent can remove it. Copy opponents between your list and a
  group. See [docs/prep-groups.md](./docs/prep-groups.md).

### 2026-10-13

#### Added
- **Localization: English and Spanish.** A language menu in the header with two separate settings:
  the app's own text (English / Español) and the official Pokémon names (English, Spain Spanish or
  Latin-American Spanish) for Pokémon, forms, moves, items, abilities, types and natures. Saved
  data, pastes and exports stay in English. Search matches names in both languages, ignoring
  accents. See [docs/localization.md](./docs/localization.md).
- `npm run generate:names` to regenerate the localized name data from PokeAPI.

#### Changed
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

#### Fixed
- The Pokémon hover/click card and the tournament round's opponent cards show the Mega form's
  ability (Mega Raichu X: Electric Surge), not the pasted base ability.
- Only one Pokémon card is open at a time: hovering a lead/back pick closes an opponent card opened
  by click, and the other way round.
- Navigating between pages no longer makes the header's team (and the signed-in avatar) disappear
  and reappear: the signed-in user, teams, opponents and tournaments stay in memory between pages
  and refresh in the background.
- Opening a lead/back picker (or a Pokémon card) no longer makes the page jump: for one frame the
  dropdown sat in the page flow, pushing the rows below it down and back.

### 2026-10-12

#### Added
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

#### Changed
- My Teams rows: the menu only has Archive and Remove. Name and paste are edited on the team's page.

#### Fixed
- Z Mega abilities: Mega Garchomp Z now has Levitate, Mega Absol Z Sharpness, Mega Lucario Z Aura
  Guard.

### 2026-10-11

#### Fixed
- Opponent team sort order.

### 2026-09-15

#### Added
- More admin functions and feature flags per section.

#### Changed
- Theme update.

### 2026-09-08

#### Added
- **My Teams** and **Tournaments** sections.
- **Speed Tiers** page, with numeric speed search and a grouped view.

### 2026-09-01

#### Fixed
- Matchup Planner styles and layout on mobile and tablet.

### 2026-08-23

#### Added
- Support for multiple regulations.
- My Team section.

### 2026-08-22

#### Added
- Firebase: Google sign-in, with teams and opponents synced across devices through Firestore.

#### Changed
- Damage calculator hidden from the nav while its known issues are worked out.

### 2026-08-20 – 2026-08-21

#### Added
- Damage calculator, reworked to match Game Freak's damage formula.

#### Fixed
- Importing into the damage calculator, and its layout.

### 2026-08-12

#### Added
- Opponent search.
- Onboarding and missing sprites.

#### Fixed
- Team selection in the mobile header, the lead/back picker interaction, and sprite sizes.

### 2026-08-11

#### Changed
- Calculation updates, hover card design, and stats calculation.

### 2026-08-10

#### Changed
- Design and experience updates.
- Smaller build: removed the Material Symbols library and serve Pokémon sprites unoptimized.

### 2026-08-09

#### Added
- The app's own Pokémon sprites, team display and selection in the header, and stats calculation.

### 2026-08-08

#### Added
- **First version: the Matchup Planner.** Paste your team, paste opponents, plan leads and backs.
- Deployment setup.
