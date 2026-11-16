import { describe, expect, it } from "vitest";
import { DEFAULT_ARCHETYPE_SET as SET, describeCheck, describeCondition } from ".";

describe("describeCheck", () => {
  it("reads like a sentence", () => {
    expect(describeCheck({ move: ["Follow Me", "Rage Powder"] })).toBe(
      "knows one of: Follow Me, Rage Powder",
    );
    expect(
      describeCheck({
        allOf: [
          { computed: "attacker" },
          { anyOf: [{ baseStat: { spe: { max: 60 } } }, { natureLowers: "spe" }] },
        ],
      }),
    ).toBe(
      "an attacker (2+ damaging moves, base offense 90+) and (base Speed ≤ 60 or nature lowers Speed)",
    );
    expect(describeCheck({ not: { item: ["Choice Scarf"] } })).toBe("not holds Choice Scarf");
  });
});

describe("describeCondition", () => {
  it("names roles with their counts", () => {
    expect(describeCondition({ role: "tr-attacker", min: 2 }, SET)).toBe("2+ Trick Room attacker");
    expect(describeCondition({ role: "independent-attacker", min: 0, max: 2 }, SET)).toBe(
      "at most 2 Attacker without setup",
    );
    expect(describeCondition({ anyOf: [{ role: "redirection" }, { role: "fake-out" }] }, SET)).toBe(
      "1+ Redirection or 1+ Fake Out",
    );
    expect(describeCondition({ pokemon: { species: ["Pyroar-Mega"] } }, SET)).toBe(
      "1+ Pokémon that is Pyroar-Mega",
    );
  });
});
