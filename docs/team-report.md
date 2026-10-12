# Team Report: calcs and matchups

Status: **on hold** (2026-10-12). Steps 1–4 were built, then the entry points were hidden — opponent
info (who they are, what they bring) and matchup prep (your picks and notes against them) may need to
be separate things, and the design needs rethinking before this ships. `TEAM_REPORT_PREP_ENABLED` in
`src/constants/teamReportPrep.ts` (currently `false`) hides the Calcs and Matchups tabs and the Matchup
Planner's "Matchup report" menu item; the code, the matchup page route, and any saved data stay in
place.

The Team Report (`/teams/[teamId]`) describes a team from its **owner's** perspective. Today that means
the roster with notes, common combinations, and tournament stats. Tournament prep needs two more
things, modelled on a real prep document (a pokepaste link followed by damage calcs grouped per own
Pokémon, split into Offensive / Defensive):

1. **Calcs** — benchmark damage calcs for each of your Pokémon, against the meta in general.
2. **Matchups** — one prep page per opponent team: their roster with notes, your lead/back and game
   plan, and the calcs that involve their Pokémon.

## Decisions

- **The owner-team perspective.** Calcs belong to *your* team (`Team.calcs`), not to an opponent. A
  calc names one of your Pokémon and one other Pokémon (the threat).
- **Matchup data is the Matchup Planner's plan.** `Opponent.plansByTeamId[teamId]` already links an
  opponent to your team. The matchup page edits that same `MatchupPlan` (no copy), so the planner row
  and the matchup page always agree. It gains two optional free-text fields; see Data.
- **Matchup detail is a separate page**, `/teams/[teamId]/matchups/[opponentId]`, not an expanding
  row.
- **Calcs are paste-only first.** A "Save to team" button in the Damage Calculator comes later.

## Calcs

### Paste format

A block of lines, parsed leniently; nothing pasted is ever dropped:

| Line | Meaning |
|---|---|
| A species name on its own (`Charizard`) | Starts the section for that Pokémon of yours |
| `Offensive` / `Defensive` | Sets the side for the following calcs |
| Contains ` vs. ` | A calc line |
| A URL | Ignored (the pokepaste link at the top) |
| Anything else | Kept as a free-text entry in the current section (e.g. a comment) |

A calc line is Showdown-calc output:

```
32+ Atk Tough Claws Lycanroc-Dusk Accelerock vs. 16 HP / 18 Def Mega Charizard Y: 192-228 (113.6 - 134.9%) -- guaranteed OHKO
```

From it we read the **attacker species** (before ` vs. `), the **defender species** (between ` vs. `
and `:`), the **% range** and the **KO verdict** (after ` -- `). Species are found by matching words
against the species data (longest match, so `Lycanroc-Dusk` beats `Lycanroc`; `Mega Charizard Y`
resolves to Charizard). The rest of the line is shown as pasted.

When a line has no section header, the Pokémon and side are inferred: whichever side of the calc is on
your roster is yours (attacker → Offensive, defender → Defensive).

### Data

```ts
interface TeamCalc {
  id: string;
  /** The line as pasted — the source of truth; everything else is derived when shown. */
  text: string;
  /** speciesIdentity of the Pokémon of yours this calc is filed under, or null if unknown. */
  species: string | null;
  side: "offensive" | "defensive" | null;
}
Team.calcs?: TeamCalc[];
```

Filing by species (not roster index) keeps calcs attached to the right Pokémon if the paste is
re-ordered. Parsed fields aren't stored, so parser improvements apply to existing calcs.

### UI (new "Calcs" tab)

- Grouped per Pokémon of yours in roster order, then Offensive / Defensive; anything not on the
  roster under "Other".
- Each calc: the threat's sprite, the line, and the % range + KO verdict pulled out on the right. An
  OHKO verdict is green when you deal it (Offensive) and red when you take it (Defensive). Delete per
  line. Free-text entries show in italics under "Notes".
- "Add calcs" opens a paste box; the result reports how many calcs were added.

## Matchups

### Matchups tab

**Only opponents with a matchup report** — a report is optional extra prep, so the tab doesn't list
every opponent you've planned against. A plan counts as a report once it has content only the matchup
page writes: "What they do" or a note on one of their Pokémon (`hasMatchupReport`). Lead/back and the
game plan don't count, since the Matchup Planner fills those in everyday use. Emptying those fields
takes the opponent off the list again. A report is started from the Matchup Planner (⋮ → "Matchup
report"); the empty state says so.

Rows follow Matchup Planner order, a variant right after its main and marked "Variant" (each is
filtered on its own — a variant can have a report its main doesn't). Each row: label, roster, your
lead/back if picked, tags, and how many of your calcs involve that team.
Click → the matchup page. The report's tab is kept in the URL (`?tab=matchups`), so the matchup
page's back link and a reload return to it.

### Matchup page

`/teams/[teamId]/matchups/[opponentId]`:

- **Their roster**, each with a free-text note ("always leads Sneasler", "Scarf").
- **Your lead/back and game plan** — the same plan as the Matchup Planner row.
- **What they do** — free text: likely leads, common plays.
- **Relevant calcs** — your calcs whose threat is on their roster (by `speciesIdentity`), grouped
  per Pokémon of yours.

Linked from each Matchup Planner row's ⋮ menu ("Matchup report") when a team is selected.

### Data

```ts
MatchupPlan.pokemonNotes?: Record<number, string>; // keyed by index into the opponent's roster
MatchupPlan.scoutingNotes?: string;                 // "What they do"
```

## Implementation order

1. [x] Calc parser + `Team.calcs` + Calcs tab (paste, list, delete).
2. [x] Matchups tab.
3. [x] Matchup page + the new `MatchupPlan` fields.
4. [x] "Matchup report" link from the Matchup Planner.
5. [ ] Later: "Save to team" from the Damage Calculator.
