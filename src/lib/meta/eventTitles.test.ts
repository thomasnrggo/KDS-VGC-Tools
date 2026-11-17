import { describe, expect, it } from "vitest";
import { eventTitle, titlesNeedRebuild, type EventTitles } from "./eventTitles";

const titles: EventTitles = {
  a: { title: "2027 Buenos Aires Special Championships", renamedAt: "", renamedBy: "" },
};
const saved = new Map([
  ["a", "Buenos Aires"],
  ["b", "2027 Nice Regional"],
]);

describe("eventTitle", () => {
  it("uses the admin's title, else the event's own", () => {
    expect(eventTitle({ id: "a", title: "Buenos Aires" }, titles)).toBe(
      "2027 Buenos Aires Special Championships",
    );
    expect(eventTitle({ id: "b", title: "2027 Nice Regional" }, titles)).toBe("2027 Nice Regional");
    expect(
      eventTitle({ id: "c", title: "Own" }, { c: { title: "  ", renamedAt: "", renamedBy: "" } }),
    ).toBe("Own");
  });
});

describe("titlesNeedRebuild", () => {
  it("rebuilds when a renamed event is published under its old title", () => {
    expect(titlesNeedRebuild([{ id: "a", title: "Buenos Aires" }], saved, titles)).toBe(true);
  });
  it("rebuilds when a rename is undone", () => {
    expect(
      titlesNeedRebuild([{ id: "a", title: "2027 Buenos Aires Special Championships" }], saved, {}),
    ).toBe(true);
  });
  it("leaves a summary in step alone", () => {
    expect(
      titlesNeedRebuild(
        [
          { id: "a", title: "2027 Buenos Aires Special Championships" },
          { id: "b", title: "2027 Nice Regional" },
        ],
        saved,
        titles,
      ),
    ).toBe(false);
  });
});
