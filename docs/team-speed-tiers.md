# Speed Tiers: My team

Status: **built** (2026-11-13), not yet released.

For beginners: your team as a turn order — who moves before each of your Pokémon and who after —
without having to know any Speed numbers. (Asked for after building a team for someone new to VGC.)

## Decisions (2026-11-13)

| Question       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where          | A "My team" tab on Speed Tiers, with a team picker (defaults to the active team); and a Speed tab on the team page (`?tab=speed`, `hideTeamPicker`, the team's first regulation)                                                                                                                                                                                                                                                                                                                     |
| Order          | Base Speed (a Mega as its Mega) — simplest for a beginner; your Pokémon carry their actual Speed as a badge                                                                                                                                                                                                                                                                                                                                                                                          |
| Rows           | Base Speed bands of 10 (120–111, 110–101…) only where your Pokémon are; everything faster in one row (151–121 above a 120 Sneasler) and everything slower in one, labeled with the fastest / slowest there is. Inside, fastest on the left; dividers only around your Pokémon's base Speed (yours first, then those tying it)                                                                                                                                                                        |
| Who's listed   | The 12 most used per row (tournament usage); "+N" opens the rest, unseen Pokémon included; a band with none of yours and only unseen Pokémon is left out                                                                                                                                                                                                                                                                                                                                             |
| Trick Room     | Always the last row: base 50 and slower (`TRICK_ROOM_TOP`), apart from the "slower than your team" row, with its own 12 spots                                                                                                                                                                                                                                                                                                                                                                        |
| Expanding      | "+N" opens a row; "Show less" folds it back to the cap                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Adding Pokémon | "Add a Pokémon…" pins one so it always shows in its row, saved with the team (`Team.speedPins`)                                                                                                                                                                                                                                                                                                                                                                                                      |
| Megas          | A Pokémon holding its stone counts as its Mega                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Text           | A tips banner above the team picker (PageTips, id "speed-team"): what the table is, plus three tips (your number is its real Speed — training and Choice Scarf; others can move rows — training, Scarf, Speed abilities, Tailwind, Trick Room; Add a Pokémon). Its ✕ hides it for good on this device, the "?" beside Add a Pokémon brings it back. The legend sits behind an info icon in the table header (a popover: your Pokémon, the dividers, added by you, +N). Names and numbers in tooltips |

Tried and dropped the same day: ordering by actual Speed — yours by their real Speed, others first
at the Speed their most common nature suggests (it put Dragapult ahead of the base 151 Megas),
then at their fastest; the user went back to base Speed as simpler for a beginner. Rows were
first your Pokémon and the gaps between them (ranges like 110–101, 116 alone) — replaced by fixed
bands of 10, which read more evenly; a split at base 50 for Trick Room went with them. Also dropped: a
row per base Speed ("Detailed"), a Show all toggle, row labels and notes.

## How it works

- `src/lib/stats/teamSpeedTiers.ts` (tested): `fieldFormKey` (the form on the field —
  "gardevoir-mega" for Gardevoir @ Gardevoirite), `metaByRow` (each Speed Tiers row's metagame
  entry, matched by form: the metagame lists Megas as their own, e.g. "Charizard-Mega-Y"),
  `bandOf` / `teamSpeedBands` (each band's members and others) and
  `visibleOthers` (pinned, then the most used, up to `SHOWN_PER_ROW`).
- `src/components/TeamSpeedTiers`: team picker, Add a Pokémon (a pinned one has a dashed outline
  and an × on hover), and the card. Your Pokémon's tiles are highlighted with their Speed as a
  badge. Tooltips: the name, then "Base Speed 120 · Speed 126–189" (min–max) — on yours, "Base
  Speed 120 · Your Speed: 160". A row's aria-label says "Base Speed 120 to 111".
- No tournament data for the regulation: every legal Pokémon counts, with a note.
- Shared: a "speed" ShareSection (closed sheet only — the badges give away Stat Points and
  nature). The public copy carries `speedPins`; the shared page's Speed tab is read only (no
  `updateTeam`: no Add a Pokémon, no ×, no "Missing a matchup?" tip).
- `Team.speedPins` holds SpeedTierRow ids. On a collaborative team it's a shared field like the
  name (and logs as "the Speed Tiers picks").
