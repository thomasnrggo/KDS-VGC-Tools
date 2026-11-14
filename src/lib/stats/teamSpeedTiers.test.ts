import { describe, expect, it } from "vitest";
import { computeSpeedTierRows } from "./computeSpeedTiers";
import {
  SHOWN_PER_ROW,
  metaByRow,
  bandOf,
  teamSpeedBands,
  visibleOthers,
  type TeamSpeedOther,
} from "./teamSpeedTiers";
import { parseTeam } from "@/lib/parseTeam";
import type { MetaPokemon } from "@/lib/meta/aggregateMeta";

const STONES: Record<string, string[]> = {
  gardevoir: ["Gardevoirite"],
  charizard: ["Charizardite X", "Charizardite Y"],
};
const ROWS = computeSpeedTierRows(
  ["gardevoir", "charizard", "garchomp", "kingambit", "incineroar", "amoonguss", "dragapult"],
  (key) => STONES[key] ?? [],
);
const row = (id: string) => ROWS.find((r) => r.id === id)!;

const meta = (species: string, usage: number, nature?: string) =>
  ({
    species,
    usage,
    natures: nature ? [{ name: nature, share: 1 }] : [],
  }) as unknown as MetaPokemon;

// Mega Gardevoir: Timid, 32 Speed → 167. Kingambit: Adamant, no Speed → 70.
const TEAM = parseTeam(`Gardevoir @ Gardevoirite
Ability: Synchronize
EVs: 32 Spe
Timid Nature
- Moonblast

Kingambit @ Black Glasses
Adamant Nature
- Kowtow Cleave`);

describe("metaByRow", () => {
  it("matches each row by its field form — the metagame lists Megas as their own", () => {
    const byRow = metaByRow(ROWS, [meta("Charizard-Mega-Y", 0.3), meta("Garchomp", 0.2)]);
    expect(byRow.get("charizard-charizardite-y")?.usage).toBe(0.3);
    expect(byRow.has("charizard")).toBe(false);
    expect(byRow.get("garchomp")?.usage).toBe(0.2);
  });
});

describe("bandOf", () => {
  it("cuts base Speed into bands of 10, fastest first", () => {
    expect(bandOf(120)).toEqual({ top: 120, bottom: 111 });
    expect(bandOf(111)).toEqual({ top: 120, bottom: 111 });
    expect(bandOf(101)).toEqual({ top: 110, bottom: 101 });
    expect(bandOf(100)).toEqual({ top: 100, bottom: 91 });
    expect(bandOf(5)).toEqual({ top: 10, bottom: 1 });
  });
});

describe("teamSpeedBands", () => {
  const byRow = metaByRow(ROWS, [meta("Charizard-Mega-Y", 0.4), meta("Garchomp", 0.2)]);

  it("puts your Pokémon among the others in their base Speed band", () => {
    const bands = teamSpeedBands({ team: TEAM, rows: ROWS, meta: byRow, pinned: [] });
    // Bands of 10 from Mega Gardevoir's (100) to Kingambit's (50); everything
    // faster in one row up to Dragapult's 142; Amoonguss (30) in the Trick Room
    // row, always last.
    expect(bands.map((band) => [band.top, band.bottom])).toEqual([
      [142, 101],
      [100, 91],
      [80, 71],
      [60, 51],
      [50, 41],
      [30, 30],
    ]);
    // Mega Gardevoir at its Mega's 100 (badged with its actual 167), with the
    // base 100 Charizards; plain Gardevoir (80) is another form, so it's listed.
    const hundred = bands.find((band) => band.top === 100)!;
    expect(hundred.members.map((m) => [m.pokemon.species, m.baseSpe, m.speed])).toEqual([
      ["Gardevoir", 100, 167],
    ]);
    expect(hundred.others.map((o) => o.row.id)).toContain("charizard-charizardite-y");
    // Kingambit (50) and slower bands keep the Trick Room Pokémon apart.
    expect(bands.find((band) => band.top === 50)!.members[0].pokemon.species).toBe("Kingambit");
    expect(bands.find((band) => band.top === 30)!.others.map((o) => o.row.id)).toEqual([
      "amoonguss",
    ]);
    // Never the team's own forms again.
    expect(bands.flatMap((b) => b.others.map((o) => o.row.id))).not.toContain(
      "gardevoir-gardevoirite",
    );
  });
});

describe("the Trick Room row", () => {
  it("always ends the table with base 50 and slower, apart from the rest", () => {
    const rows = computeSpeedTierRows(["torkoal", "amoonguss", "pelipper", "kingambit"], () => []);
    const bands = teamSpeedBands({
      team: parseTeam(`Dragapult
- Protect`),
      rows,
      meta: new Map(),
      pinned: [],
    });
    expect(bands.map((band) => [band.top, band.bottom, band.others.map((o) => o.row.id)])).toEqual([
      [150, 141, []],
      [140, 65, ["pelipper"]],
      [50, 20, ["kingambit", "amoonguss", "torkoal"]],
    ]);
  });
});

describe("visibleOthers", () => {
  const other = (id: string, usage: number, pinned = false): TeamSpeedOther => ({
    row: { ...row("garchomp"), id },
    baseSpe: 100,
    usage,
    pinned,
  });

  it("keeps the most used and anything pinned, leaving the unseen for +N", () => {
    const many = Array.from({ length: SHOWN_PER_ROW + 4 }, (_, i) => other(`m${i}`, (i + 1) / 100));
    const shown = visibleOthers([...many, other("unseen", 0), other("pin", 0, true)], true);
    expect(shown).toHaveLength(SHOWN_PER_ROW);
    expect(shown.map((o) => o.row.id)).toContain("pin");
    expect(shown.map((o) => o.row.id)).toContain(`m${SHOWN_PER_ROW + 3}`);
    expect(shown.map((o) => o.row.id)).not.toContain("unseen");
  });
});
