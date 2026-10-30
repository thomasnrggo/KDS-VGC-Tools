import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isFinished,
  isVgcEvent,
  parseEventDates,
  parseEventIndex,
  regulationForDate,
} from "./pokedataIndex";

const indexHtml = readFileSync(path.join(__dirname, "__fixtures__/pokedata-index.html"), "utf8");

describe("parseEventDates", () => {
  it("reads one-day, two-day and month-spanning events", () => {
    expect(parseEventDates("October 24-25, 2026")).toEqual({
      startDate: "2026-10-24",
      endDate: "2026-10-25",
    });
    expect(parseEventDates("October 31-November 1, 2026")).toEqual({
      startDate: "2026-10-31",
      endDate: "2026-11-01",
    });
    expect(parseEventDates("November 7, 2026")).toEqual({
      startDate: "2026-11-07",
      endDate: "2026-11-07",
    });
  });

  it("returns null for anything else", () => {
    expect(parseEventDates("sometime soon")).toBeNull();
    expect(parseEventDates("Octember 3, 2026")).toBeNull();
  });
});

describe("parseEventIndex", () => {
  const events = parseEventIndex(indexHtml);

  it("reads every event block on the real page", () => {
    expect(events.map((event) => event.id)).toEqual([
      "1000079",
      "1000080",
      "1000077",
      "1000078",
      "1000034",
      "1000035",
      "1000036",
      "1000049",
      "1000059",
    ]);
    expect(events[3]).toEqual({
      id: "1000078",
      title: "2027 Puebla Pokémon VGC Regional Championships",
      kind: "vg",
      startDate: "2026-10-24",
      endDate: "2026-10-25",
    });
    // Month-spanning dates and accented names.
    expect(events[7]).toMatchObject({ startDate: "2026-02-27", endDate: "2026-03-01" });
    expect(events[8].title).toBe("2026 Gdańsk Pokémon VGC Regional Championships");
  });

  it("keeps finished VGC events in a known regulation", () => {
    const ready = events.filter(
      (event) =>
        isVgcEvent(event) && isFinished(event, "2026-10-30") && regulationForDate(event.startDate),
    );
    // Not the TCG ones, not Gdansk (ends November 1), not events before Champions.
    expect(ready.map((event) => [event.id, regulationForDate(event.startDate)])).toEqual([
      ["1000078", "regulation-m-c"],
      ["1000034", "regulation-m-c"],
      ["1000035", "regulation-m-b"],
      ["1000036", "regulation-m-a"],
    ]);
  });

  it("waits a day after an event ends", () => {
    const puebla = events[3];
    expect(isFinished(puebla, "2026-10-26")).toBe(false);
    expect(isFinished(puebla, "2026-10-27")).toBe(true);
  });
});

describe("regulationForDate", () => {
  it("places events in the regulation in play on their start date", () => {
    expect(regulationForDate("2026-10-24")).toBe("regulation-m-c");
    expect(regulationForDate("2026-09-09")).toBe("regulation-m-c");
    expect(regulationForDate("2026-09-08")).toBe("regulation-m-b");
    expect(regulationForDate("2026-06-12")).toBe("regulation-m-a");
    expect(regulationForDate("2026-01-01")).toBeNull();
  });
});
