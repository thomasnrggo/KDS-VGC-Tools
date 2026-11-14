import { describe, expect, it } from "vitest";
import { joinIsGood, metaImportId, parseStandingsDate } from "./metaImport";

describe("parseStandingsDate", () => {
  it("reads the standings file's date line", () => {
    expect(parseStandingsDate("October 24-25, 2026")).toEqual({
      startDate: "2026-10-24",
      endDate: "2026-10-25",
    });
    expect(parseStandingsDate("October 31 - November 1, 2026")).toEqual({
      startDate: "2026-10-31",
      endDate: "2026-11-01",
    });
    expect(parseStandingsDate("June 7, 2026")).toEqual({
      startDate: "2026-06-07",
      endDate: "2026-06-07",
    });
  });

  it("is null for anything else", () => {
    expect(parseStandingsDate("next weekend")).toBeNull();
  });
});

describe("metaImportId", () => {
  it("uses the pokedata.ovh id when given, else the title and date", () => {
    expect(metaImportId(" 1000078 ", "Puebla", "2026-10-24")).toBe("1000078");
    expect(metaImportId("", "2027 Pokémon Puebla Regional!", "2026-10-24")).toBe(
      "manual-2027-pokemon-puebla-regional-2026-10-24",
    );
  });
});

describe("joinIsGood", () => {
  it("needs 90% of the players matched to a sheet", () => {
    expect(joinIsGood({ sheets: 100, standings: 100, matched: 95 })).toBe(true);
    expect(joinIsGood({ sheets: 100, standings: 100, matched: 80 })).toBe(false);
    expect(joinIsGood({ sheets: 0, standings: 0, matched: 0 })).toBe(false);
  });
});
