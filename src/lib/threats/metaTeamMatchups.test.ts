import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { aggregateCombinations, aggregateOfficialMeta } from "@/lib/meta/aggregateMeta";
import { parseOfficialEvent } from "@/lib/meta/officialTournament";
import { parseTeam } from "@/lib/parseTeam";
import { comboSets, metaTeamMatchups, withSpread } from ".";

const FIXTURES = path.join(__dirname, "../meta/__fixtures__");
const event = parseOfficialEvent(
  JSON.parse(readFileSync(path.join(FIXTURES, "puebla-2026-roster.json"), "utf8")),
  JSON.parse(readFileSync(path.join(FIXTURES, "puebla-2026-masters-standings.json"), "utf8")),
);
const meta = aggregateOfficialMeta([event]);
const combos = aggregateCombinations([event]);

const team = parseTeam(`Charizard @ Charizardite Y
Ability: Blaze
Modest Nature
- Heat Wave
- Solar Beam
- Weather Ball
- Protect

Garchomp @ Clear Amulet
Ability: Rough Skin
Jolly Nature
- Earthquake
- Dragon Claw
- Rock Slide
- Protect

Incineroar @ Sitrus Berry
Ability: Intimidate
Careful Nature
- Fake Out
- Flare Blitz
- Knock Off
- Parting Shot`).map((mon) => withSpread(mon).pokemon);

describe("comboSets", () => {
  it("builds each Pokémon's most common set, its Mega included", () => {
    const sets = comboSets(["Charizard", "Garchomp"], meta.pokemon);
    expect(sets).toHaveLength(2);
    for (const set of sets) {
      expect(set.pokemon.moves?.length).toBeGreaterThan(0);
      expect(set.pokemon.evs).toBeTruthy();
    }
  });

  it("leaves out a Pokémon with no metagame entry", () => {
    expect(comboSets(["Not-A-Pokemon"], meta.pokemon)).toEqual([]);
  });
});

describe("metaTeamMatchups", () => {
  const report = metaTeamMatchups(team, combos, meta.pokemon);

  it("scores every team, best for you first", () => {
    expect(report.teams.length).toBe(combos.teams.length);
    const scores = report.teams.map((m) => m.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const matchup of report.teams) {
      expect(Number.isFinite(matchup.score)).toBe(true);
      expect(matchup.yours).toHaveLength(team.length);
    }
  });

  it("drops cores that repeat 3+ Pokémon of a more common one", () => {
    const cores = report.cores.map((m) => m.combo.species);
    for (const [i, a] of cores.entries()) {
      for (const b of cores.slice(i + 1)) {
        expect(a.filter((s) => b.includes(s)).length).toBeLessThan(3);
      }
    }
  });

  it("explains with indexes into both teams", () => {
    for (const matchup of report.teams) {
      for (const mon of matchup.their) {
        for (const index of [...mon.ohkos, ...mon.answeredBy]) {
          expect(index).toBeLessThan(team.length);
        }
      }
      for (const mon of matchup.yours) {
        for (const index of mon.ohkos) expect(index).toBeLessThan(matchup.their.length);
      }
    }
  });
});
