# Team archetypes

Status: **engine built** (2026-11-15) as `src/lib/archetypes/`, pure and unit-tested, and shown
as a **preview badge on the team page** (below). The admin page, the Firestore storage and the v2
matchup analysis are planned, but not built.

## Why

The Threats tab (PLANNING.md §7, `src/lib/threats/`) compares a team one Pokémon against one
Pokémon. The owner (2026-11-14): "a one to one comparative is not really useful on a VGC context
where we focus on a team composition". The goal is to know which **archetypes** a team struggles
with, using the real metagame teams and their round results.

Archetypes change during a season and have variants. Double weather (Charizard-Y + Pelipper) rose
this season, and Psyspam can be Trick Room or hyper offense. So archetypes are **defined as data**
that an admin can add to and refine, not hard-coded.

## The taxonomy (the owner's draft, 2026-11-15)

Three separate ideas:

1. **Archetype**: the team's engine, detected from its sheet: Sun, Psyspam · Trick Room, Hard
   setup, and so on.
2. **Tempo**: a simple concept that **describes an archetype**, the owner's colors. It is not a
   category, and teams aren't scored on it (owner, 2026-11-15: "the tempo is not a category, we
   should treat it as a simple concept"). Each archetype may carry one; a variant without one
   takes its nearest ancestor's (`archetypeTempo`); none (black) means no fixed tempo.

   | Tempo         | The owner's name     | Color | Archetypes                                                        |
   | ------------- | -------------------- | ----- | ----------------------------------------------------------------- |
   | `offense`     | "blow it up"         | red   | Tailwind, Trick Room, Sun · Chlorophyll, Sun · Fire spam, Psyspam |
   | `positioning` | "wait until perfect" | blue  | Sun, Rain, Rain · Screens                                         |
   | `patient`     | "take your time"     | green | Hard setup, Balance setup, Stall, Screens                         |
   | none          | —                    | black | Tail/room, Double weather, Sand, Snow, Electric, Perish trap      |

3. **Player style**: "adapt to all". It describes the player, not a team, so no team is
   classified as it. It could become a profile preference that shapes advice later.

"Hyper offense" is a style, not a category (the owner: "use powerful but fragile Pokémon, go
straight to attack and look for OHKO over endurance"). Sun teams tend to be hyper offense.

A measured tempo score (points per Pokémon for Choice items, Fake Out, setup, …) was tried on
2026-11-15 and dropped the same day: it read 62% of M-C teams as offense and 2% as patient, and
tempo isn't meant to classify teams anyway.

### Families and archetypes

| Family        | Archetype (· variant)         | Detected by                                                                                                                                                                 |
| ------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speed control | Tailwind                      | a Tailwind setter, no Trick Room                                                                                                                                            |
|               | Trick Room                    | a Trick Room setter + 2 slow attackers, no Tailwind                                                                                                                         |
|               | Tail/room                     | both setters                                                                                                                                                                |
| Weather       | Sun                           | a Sun setter (Drought, including Mega Charizard Y, or Sunny Day)                                                                                                            |
|               | Sun · Chlorophyll             | + a Chlorophyll user (doubles its Speed in Sun, often spreads sleep with Sleep Powder)                                                                                      |
|               | Sun · Fire spam               | + **Mega Pyroar**: Fire Mane ×1.5 with Sun ×1.5 hurts even Fire resists. Limited to Pyroar                                                                                  |
|               | Rain                          | a Rain setter. "Reduce damage" (Fire halved in Rain) is a trait of Rain used in matchups, not a variant                                                                     |
|               | Rain · Screens                | Rain + Reflect / Light Screen (two parents: Rain and Screens)                                                                                                               |
|               | Double weather                | Sun **and** Rain setters (two parents)                                                                                                                                      |
|               | Sand / Snow                   | the setter                                                                                                                                                                  |
| Terrain       | Psyspam · Trick Room / · HO   | Psychic Terrain setter + Expanding Force; · Trick Room also has a Trick Room mode (parents: Psyspam and Trick Room), · HO doesn't (Trick Room only as a backup is still HO) |
|               | Grassy control                | **set aside** (a `draft`): Rillaboom, abusing the field's healing. Rule still open                                                                                          |
|               | Electric counter attack       | Electric Terrain setter, mainly Mega Raichu X (Electric Surge)                                                                                                              |
| Setup         | Hard setup                    | redirection **or Fake Out** + setup, and the team depends on it: a setup user with one attack at most, or two or fewer attackers without setup                              |
|               | Balance setup                 | redirection or Fake Out + setup + **3 or more attackers without setup**: setup is a mode, the team works without it                                                         |
| Stall         | Stall · Poison / · Leech Seed | 2 damage-over-time users + recovery                                                                                                                                         |
| Screens       | Screens                       | Reflect + Light Screen, or Aurora Veil                                                                                                                                      |
| Perish trap   | Perish trap                   | Perish Song + a trapper (Shadow Tag, Arena Trap, Mean Look, …)                                                                                                              |
| —             | Balance                       | **no match** (1.5% of M-C teams)                                                                                                                                            |

Left out: Dondozo + Tatsugiri (Commander), which isn't in the regulation. Definitions can carry
`regulations`, so it can come back where it's legal.

## The structure: three layers

Most new archetypes are data only. Code changes only for a new kind of check.

### 1. Checks: code (`checks.ts`)

These are questions about **one Pokémon** on a sheet. `pokemonFacts()` reduces a `ParsedPokemon` to
slugs and numbers first. Mega forms count as the Mega: species, ability via
`resolveEffectiveAbility`, and base stats.

| Check                           | Example                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `species`                       | `["Pyroar-Mega"]`; a base name (`"charizard"`) matches its Megas too                |
| `ability`                       | `["Drought"]`, the ability in battle                                                |
| `move`, `item`                  | `["Tailwind"]`, `["Choice Specs"]`                                                  |
| `baseStat`                      | `{ spe: { max: 60 } }`; also `offense` (higher attack) and `bulk` (mean HP/Def/SpD) |
| `natureLowers` / `natureRaises` | `"spe"`                                                                             |
| `computed`                      | `attacker`, `fragileAttacker`, `spreadAttacker`, `fewAttacks`                       |
| `allOf` / `anyOf` / `not`       | combinations                                                                        |

Names are compared as slugs, so `"Heat Wave"` and `"heat-wave"` both work.

**Adding a kind of check** means adding it to the `Check` union (`types.ts`) and to `matchesCheck`
(and, later, to the admin's editor).

### 2. Roles: data (`RoleDefinition`)

A role is a named check: a job one Pokémon does. A Pokémon can hold several roles.

```ts
{ id: "sun-setter", name: "Sun setter",
  match: { anyOf: [{ ability: ["Drought"] }, { move: ["Sunny Day"] }] } }

{ id: "tr-attacker", name: "Trick Room attacker",
  match: { allOf: [{ computed: "attacker" },
                   { anyOf: [{ baseStat: { spe: { max: 60 } } }, { natureLowers: "spe" }] }] } }
```

When a new setter enters a regulation, edit the role. Every archetype using it follows.

### 3. Archetypes: data (`ArchetypeDefinition`)

An archetype is a recipe of **team conditions**: how many Pokémon hold a role (`{ role, min?,
max? }`) or pass an inline check (`{ pokemon: Check, min?, max? }`), combinable with `allOf` and
`anyOf`.

```ts
{
  id: "sun-fire-spam", name: "Sun · Fire spam", family: "weather",
  parents: ["sun"],                                   // inherits Sun's requires
  description: "Mega Pyroar's Fire Mane plus Sun …",
  requires: [{ pokemon: { species: ["Pyroar-Mega"] } }],
  excludes: [],                                        // none may pass
  boosts: [{ condition: { role: "fire-spread", min: 2 }, weight: 1 }],
  priority: 3,
  tempo: "offense",                                    // optional; a description, see Tempo
  regulations: undefined,                              // every regulation
  status: "active",                                    // or "draft"
}
```

- **`parents`**: a child inherits its ancestors' `requires`, but **not their `excludes`**, so
  Tail/room isn't blocked by Tailwind's "no Trick Room". Several parents are allowed, so this is a
  graph rather than a tree: Double weather → Sun + Rain, Rain · Screens → Rain + Screens. A child
  can have `requires: []` and still need everything its parents need.
- **`boosts`**: strengthen a match without being needed, such as signature Pokémon or typical
  partners.
- **`priority`**: settles which unrelated match is primary. Strategy (weather, terrain, stall,
  perish trap) is 4, Balance setup 3, speed control 2, Hard setup and screens 1. Setup is last because Fake Out and a
  Swords Dance user are on most teams: a Tailwind team with them is "Tailwind + Hard setup".
  Balance setup is above speed control (owner, 2026-11-15): it's the team's identity, with speed
  control as its mode, so it reads "Balance setup + Tailwind", like the draft's "Balance w/ Tailwind".

`validateArchetypeSet()` catches unknown roles, unknown parents, cycles, and an archetype that
requires nothing. Run it before saving a set. The tests run it over the defaults.

## Classification (`classify.ts`)

`classifyTeam(team, set, regulation)`:

1. Tags each Pokémon with its roles.
2. Tests every **active** archetype for the regulation. All of its `requires` must pass, its
   ancestors' included; none of its `excludes` may pass.
3. Ranks matches by **priority**, then **specificity** (how many conditions it needed, so a variant
   beats its parent), then **boost** total, then definition order.
4. Drops matches that another match refines: Sun is dropped when Sun · Fire spam matched, and
   Trick Room when Psyspam · Trick Room did.
5. Keeps **one archetype per family**. The best remaining match is the **primary**; the best of
   each other family is a **tag**; same-family matches go to **`folded`**. A Double weather
   team that also matches Sun · Chlorophyll and Rain · Screens is Double weather, with those as
   pieces. No match means `primary: null`, shown as **Balance**.
6. **`speedMode`** is the speed-control archetype among primary and tags.

`classificationLabel()` is the name people use: the primary plus one more engine, its speed mode
("Sun + Tail/room"), or, when the primary _is_ the speed mode, its next tag ("Tailwind + Hard
setup"). The speed mode belongs in the name because it changes results: Sun + Tail/room wins 56.9%,
Sun + Trick Room 45.4%.

The seed set is `DEFAULT_ARCHETYPE_SET` (`defaultArchetypes.ts`), version 1. Move and ability lists
the roles use are in `moveLists.ts`.

## Adding an archetype

1. **Spot it.** The report's "Balance cores" (and, later, the admin's suggestions) list the most
   common cores among teams nothing matched.
2. **Define it.** If its roles exist, add an archetype. If not, add the role first.
3. **Check it.** Run the report and look at the team count, win rate, per-event trend, and
   signature Pokémon (does the list look like the strategy?). Add a unit test with a typical team.
4. **Activate it.** For now, edit `defaultArchetypes.ts`. Once stored in Firestore, save it as
   `draft`, check it, then make it `active`, and the job reclassifies stored events on its next run.

## In the app: the team page (2026-11-15)

The owner: "I want to apply this to my teams, not all the teams". Tournament teams are classified
only to compute matchups later (counts per archetype, never a label on a team). Labels appear only
on the user's own teams.

- **Where:** the team page's Overview, on the actions row, left of Copy team / Edit
  (`src/components/TeamArchetype`).
- **What:** a pill showing "Archetype", a tempo-colored dot (red, blue or green; grey for none) and
  `classificationLabel` ("Sun + Tailwind"). It opens a floating panel with the primary's game plan,
  its tempo, "Also has" (other tags), "Includes" (folded variants) and a preview note.
- **Who sees it:** behind the `teamArchetype` feature flag, off by default and switched on in
  /admin/features. Staff always see it, like the Threats tab.
- Archetype names are English data for now; the surrounding text is translated (en/es).

## In the metagame job (2026-11-15)

Each run that rebuilds a regulation's summary also classifies every tournament team and writes
`meta/{regulationId}/archetypes/summary` (`aggregateArchetypes`, `src/lib/archetypes/aggregateArchetypes.ts`):

- **Counts only**, never a team or a player (owner: "I want to apply this to my teams, not all the
  teams"; tournament teams are classified for the data only).
- **`labels`**: per `classificationKey` (archetype ids joined by `+`, e.g.
  `balance-setup+tailwind`, or `balance`): teams, top cuts, wins / losses / ties (byes left out),
  and teams per event (`byEvent`, aligned with `eventTeams` and `tournamentIds`) for the trend.
- **`matchups`**: games between two labels, stored once per pairing from `a`'s side (`a` ≤ `b`);
  swap wins and losses to read it from `b`'s side. A mirror counts each game from both sides. The
  app can sum labels up to their primary archetype when a label has too few games.
- **`version`**: the archetype set's version (`DEFAULT_ARCHETYPE_SET.version`). The job rebuilds a
  regulation whose stored version differs, so **bump `version` whenever the definitions change**
  and the next run reclassifies every event.
- Its own document (~150 KB for M-C's five events: 102 labels, 1,765 pairings) rather than inside
  `meta/{regulationId}`, which every Metagame visit downloads. Readable by everyone, written only by
  the job (firestore.rules).
- Ids, not names, so names can be translated in the app.

## Planned (not built)

- **Storage:** `archetypeRoles/{id}` and `archetypes/{id}`, edited by admins. The metagame job
  publishes a versioned snapshot in `meta/{regulationId}`, so the app and the job classify with
  the same set. `version` bumps on every change, so stale classifications can be detected.
- **Admin page:**
  - a recipe editor with a live preview against real teams: matches, share, win rate, top cuts,
    sample teams and near-misses (teams that miss one condition);
  - unclassified-core suggestions with a "rising" trend;
  - a per-event trend chart.
- **v2 analysis** on a new route, with v1 Threats untouched until v2 is preferred:
  - your team's archetype (and its tempo), and the roles it's missing compared with the archetype's
    typical teams;
  - real matchups by archetype and variant;
  - a game plan per matchup, from the roles on both sides.

## First results: Regulation M-C (2026-11-15)

These cover 2,496 Masters teams from 5 events (Brisbane, Recife, Nice, Puebla, Gdansk) and 20,368
games from round records, using the rules above (Grassy control set aside, the Balance setup / Hard setup split, Balance
setup above speed control, one archetype per family).

| Primary                 | Teams | Share | Win rate | Top cut | Share by event (Bri / Rec / Nic / Pue / Gda) |
| ----------------------- | ----: | ----: | -------: | ------: | -------------------------------------------- |
| Balance setup           |   716 | 28.7% |    50.1% |      15 | 27.9 / 30.0 / 31.2 / 27.3 / 26.3             |
| Sun                     |   289 | 11.6% |    52.4% |      14 | 6.4 / 9.1 / 9.6 / 12.6 / 16.3                |
| Psyspam · HO            |   230 |  9.2% |    47.1% |       4 | 16.0 / 14.1 / 7.7 / 7.2 / 7.5                |
| Double weather          |   188 |  7.5% |    52.2% |       3 | 5.2 / 8.6 / 8.7 / 7.5 / 6.9                  |
| Rain                    |   138 |  5.5% |    47.3% |       1 | 9.5 / 5.0 / 5.0 / 5.4 / 4.6                  |
| Sun · Chlorophyll       |   131 |  5.2% |    53.3% |       4 | 0.9 / 1.8 / 7.0 / 8.7 / 4.6                  |
| Electric counter attack |   118 |  4.7% |    51.1% |       2 | 0.9 / 0.5 / 3.0 / 11.7 / 6.5                 |
| Snow                    |   109 |  4.4% |    48.9% |       1 | 6.4 / 3.2 / 4.8 / 2.1 / 4.4                  |
| Sand                    |   103 |  4.1% |    50.6% |       4 | 4.3 / 5.9 / 2.8 / 2.7 / 5.7                  |
| Perish trap             |   100 |  4.0% |    54.9% |       2 | 4.9 / 3.6 / 5.1 / 1.8 / 3.4                  |
| Trick Room              |    86 |  3.4% |    52.3% |       3 |                                              |
| Tailwind                |    72 |  2.9% |    44.2% |       1 |                                              |
| Rain · Screens          |    54 |  2.2% |    45.8% |       0 |                                              |
| Psyspam · Trick Room    |    51 |  2.0% |    40.3% |       0 |                                              |
| Balance (no match)      |    38 |  1.5% |    42.1% |       0 |                                              |
| Hard setup              |    30 |  1.2% |    51.7% |       0 |                                              |
| Sun · Fire spam         |    23 |  0.9% |    50.5% |       0 |                                              |
| Tail/room               |    19 |  0.8% |    40.0% |       0 |                                              |
| Screens                 |     1 |  0.0% |     0.0% |       0 |                                              |

**As people would say it** (`classificationLabel`), the most common:

| Label                          | Teams | Win rate | Top cut |
| ------------------------------ | ----: | -------: | ------: |
| Balance setup + Tailwind       |   401 |    49.9% |       9 |
| Balance setup                  |   238 |    49.9% |       5 |
| Double weather + Tailwind      |   147 |    52.9% |       2 |
| Trick Room + Hard setup        |    70 |    54.2% |       3 |
| Balance setup + Trick Room     |    67 |    52.0% |       1 |
| Sun + Tailwind                 |   130 |    55.2% |      10 |
| Electric counter attack + Rain |    71 |    53.6% |       2 |
| Sun + Trick Room               |    70 |    45.4% |       1 |
| Snow + Balance setup           |    63 |    45.3% |       0 |
| Sand + Tailwind                |    63 |    54.1% |       3 |
| Psyspam · HO + Sand            |    60 |    47.3% |       0 |
| Sun + Tail/room                |    60 |    56.9% |       3 |
| Psyspam · HO + Tail/room       |    59 |    48.2% |       2 |
| Perish trap + Hard setup       |    21 |    61.8% |       1 |

**Matchups** (archetype vs archetype, at least 40 games; measured on the first run's rules):

- Double weather beats Rain 75.8% (66 games) and Psyspam TR 62.4% (101).
- Sun · Chlorophyll beats Double weather 64.9% (94) and Rain 67.3% (49).
- Sand beats Psyspam TR 69.2% (78).

**Signature Pokémon** (share of the archetype's teams; lift against the whole field) confirm the
recipes:

- Balance setup: Rillaboom, Incineroar, Raichu, Garchomp, Floette, Volcarona.
- Hard setup (30 teams): Incineroar 83%, Delphox 70%, Sinistcha 67%, Shell Smash Blastoise, Maushold.
- Double weather: Grimmsnarl 88%, Venusaur, Pelipper, Archaludon, Charizard.
- Sun · Chlorophyll: Venusaur 99%.
- Electric: Raichu 96%, Basculegion-F.
- Snow: Froslass.
- Sand: Tyranitar + Excadrill.
- Trick Room: Camerupt, Farigiraf.

### How the rules got here (2026-11-15)

- **Grassy control set aside** (owner: "let's ignore grass control for now"). Rillaboom is on ~45%
  of teams; as an archetype it took 24% of primaries, swallowing Tailwind teams. It stays as a
  `draft`, never matched, until there's a rule for "abusing the field's healing".
- **"No match" was one combination** (owner: "the matched nothing is a combination maybe"). With
  Grassy set aside, 251 teams matched nothing. They were one core: Rillaboom, Incineroar, Raichu,
  Garchomp, Volcarona, Floette, Basculegion, with Fake Out (99%), a committed setup user (85%),
  and no speed control or redirection. The owner: "it's hard setup with fake out". Now 38 remain.
- **Fake Out made Hard setup too broad** at first (33% of teams), because Fake Out and Swords
  Dance users are everywhere. Ranking speed control above setup fixed it: those teams read
  "Tailwind + Hard setup".
- **Same-family matches fold** into one: Double weather used to show as four pieces (Double
  weather + Sun · Chlorophyll + Rain · Screens + Tailwind).
- **Psyspam · Trick Room has two parents** (Psyspam, Trick Room), so it no longer reads "Psyspam ·
  Trick Room + Trick Room". It now needs a real Trick Room mode (the setter and two slow
  attackers). Indeedee often carries Trick Room only as a backup, and those teams are HO.

- **Balance setup vs Hard setup, revised** (owner, on their Rillaboom / Raichu / Volcarona /
  Sneasler SD / Floette CM / Basculegion team, labeled "Tailwind + Hard setup": "I consider this
  more a balance team with a setup mode, the team has a lot of support and coverage, it can work
  without setup"). Swords Dance + two attacks + Protect is a normal full set, not a commitment.
  Now `committed-setup` is a setup move with one attack at most, and the split is the number of
  `independent-attacker`s (attackers without a setup move): 3+ is Balance setup, 2 or fewer is
  Hard setup. Hard setup drops from 267 primaries to 30. The owner's team is a test case. Their
  bulky builds (Stat Points) aren't used: tournament sheets have no Stat Points, and both must
  classify the same way.

### Open

- **Grassy control's rule.**
- **Psyspam · HO overlaps Sand**: "Psyspam · HO + Sand" is 60 teams (Tyranitar + Excadrill). It
  could be a variant with two parents.
- **Rerun the matchups** on the current rules, as archetype × archetype by label.

### Rerunning the report

The script isn't in the repo. Copy `archetypeReport.explore.test.ts` (kept outside the repo; it
reads pokedata.ovh's `RosterData/{id}.json` and `standings/{id}_Masters.json` from a local folder)
into `src/__explore__/`, run `npx vitest run src/__explore__`, then delete it. It prints:

- shares, win rates and per-event trend per primary;
- matches including tags;
- archetype × archetype;
- the cores of unmatched teams (`unmatched.explore.test.ts`, kept with it, adds the unmatched
  teams' roles; `labels.explore.test.ts` prints the primary and label tables above);
- signature Pokémon.

Download events gently (one request every few seconds), as the metagame job does.

## Decisions

| Date       | Decision                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-14 | Matchups by archetype from real results + calcs. Built as v2 on a new route; v1 Threats stays until replaced                                          |
| 2026-11-15 | Archetypes are data (roles + recipes), editable later from an admin page; checks are code                                                             |
| 2026-11-15 | Tempo is a simple descriptive concept on each archetype, not a category or a team score; "hyper offense" is a tempo; "adapt to all" is a player style |
| 2026-11-15 | Sun · Fire spam = Mega Pyroar only; Rain's damage reduction is a trait, not a variant; Dondozo left out                                               |
| 2026-11-15 | Hard setup = redirection **or Fake Out** + a committed setup user; Balance setup = support + setup + attackers without it                             |
| 2026-11-15 | Multi-parent variants; children inherit `requires`, not `excludes`                                                                                    |
| 2026-11-15 | Grassy control set aside (a draft) until its rule is known                                                                                            |
| 2026-11-15 | One archetype per family (the rest fold); priority strategy > speed control > setup; a team's name is primary + speed mode (`classificationLabel`)    |
| 2026-11-15 | Balance setup outranks speed control ("Balance setup + Tailwind"); Hard setup stays below it ("Trick Room + Hard setup")                              |
