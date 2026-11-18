import { describe, expect, it } from "vitest";
import { fieldChange, fieldDirection } from "./fieldChange";
import type { Duel, Hit } from "./analyzeThreats";

const hit = (move: string, applied: Partial<Hit> = {}): Hit => ({
  move,
  minPercent: 50,
  maxPercent: 60,
  accuracy: 1,
  priority: 0,
  ...applied,
});
const duel = (theirs: Hit | null, yours: Hit | null): Duel => ({
  theirs,
  yours,
  theyMoveFirst: false,
  ko: null,
  answer: null,
});

describe("fieldDirection", () => {
  it("knows what the weather and terrain power up and weaken", () => {
    expect(fieldDirection({ weather: "Sun" }, "Flare Blitz")).toBe("up");
    expect(fieldDirection({ weather: "Sun" }, "Wave Crash")).toBe("down");
    expect(fieldDirection({ weather: "Sun" }, "Weather Ball")).toBe("changed");
    expect(fieldDirection({ terrain: "Grassy" }, "Wood Hammer")).toBe("up");
    expect(fieldDirection({ terrain: "Grassy" }, "Earthquake")).toBe("down");
    expect(fieldDirection({ terrain: "Misty" }, "Draco Meteor")).toBe("down");
  });
});

describe("fieldChange", () => {
  it("lists the moves it changed on each side, once each", () => {
    const sun = { weatherApplied: true };
    const change = fieldChange(
      [
        duel(hit("Flare Blitz", sun), hit("Focus Blast")),
        duel(hit("Flare Blitz", sun), hit("Wave Crash", sun)),
      ],
      { weather: "Sun" },
    );
    expect(change).toEqual({
      its: { up: ["Flare Blitz"], down: [], changed: [] },
      yours: { up: [], down: ["Wave Crash"], changed: [] },
    });
  });

  it("is null when it changed no hit", () => {
    expect(fieldChange([duel(hit("Flare Blitz"), null)], { weather: "Sun" })).toBeNull();
  });
});
