import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { ENGLISH_POKEMON_TEXT } from "@/lib/i18n/pokemonNames";
import { birthDateParts, fillTeamList, type TeamListPlayer } from "./fillTeamList";
import { EMPTY_PLAYER_PROFILE } from "@/lib/playerProfile";
import { teamListRows } from "./teamListRows";

const template = readFileSync(
  join(process.cwd(), "public/team-list/play-pokemon-vg-team-list.pdf"),
);

const player: TeamListPlayer = {
  ...EMPTY_PLAYER_PROFILE,
  battleTeam: "3 / Rain",
  playerName: "Test Player",
  division: "masters",
  playerId: "1234567",
  birthDate: "2000-01-31",
};

describe("teamListRows", () => {
  it("capitalizes the nature and prints the summary-screen Speed (no Choice Scarf)", () => {
    const [row] = teamListRows(
      [
        {
          species: "Incineroar",
          nature: "jolly",
          ability: "Intimidate",
          item: "Choice Scarf",
          evs: "0 HP / 0 Atk / 0 Def / 0 SpA / 0 SpD / 32 Spe",
          moves: ["Fake Out", "", "Flare Blitz"],
        },
      ],
      ENGLISH_POKEMON_TEXT,
    );
    expect(row.nature).toBe("Jolly");
    expect(row.item).toBe("Choice Scarf");
    expect(row.moves).toEqual(["Fake Out", "Flare Blitz"]);
    // Base 60 Speed, 32 Stat Points, Jolly: 123 on the summary screen (184 with the Scarf in battle).
    expect(row.stats?.[5]).toBe(123);
  });

  it("only takes six Pokémon", () => {
    const mons = Array.from({ length: 7 }, () => ({ species: "Ditto" }));
    expect(teamListRows(mons, ENGLISH_POKEMON_TEXT)).toHaveLength(6);
  });
});

describe("birthDateParts", () => {
  it("splits a date input's value into month / day / year", () => {
    expect(birthDateParts("2000-01-31")).toEqual(["01", "31", "2000"]);
    expect(birthDateParts("")).toBeNull();
  });
});

describe("fillTeamList", () => {
  const team = teamListRows(
    [{ species: "Flutter Mane", nature: "Timid", ability: "Protosynthesis", moves: ["Moonblast"] }],
    ENGLISH_POKEMON_TEXT,
  );

  it.each([
    ["opponents", 1],
    ["staff", 1],
    ["both", 2],
  ] as const)("returns the %s page(s)", async (pages, count) => {
    const bytes = await fillTeamList(template, { pages, player, team });
    const filled = await PDFDocument.load(bytes);
    expect(filled.getPageCount()).toBe(count);
  });

  it("skips text the built-in font can't draw instead of failing", async () => {
    const bytes = await fillTeamList(template, {
      pages: "both",
      player: { ...player, playerName: "テスト" },
      team,
    });
    expect(bytes.length).toBeGreaterThan(0);
  });
});
