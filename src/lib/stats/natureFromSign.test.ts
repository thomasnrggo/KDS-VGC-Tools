import { describe, expect, it } from "vitest";
import { natureFromSign } from "./natureFromSign";

// A special attacker (Sp. Atk above Attack), like Raichu.
const SPECIAL = { hp: 60, atk: 90, def: 55, spa: 120, spd: 80, spe: 110 };
const PHYSICAL = { ...SPECIAL, atk: 120, spa: 60 };

describe("natureFromSign", () => {
  it("keeps the other side of the current nature", () => {
    expect(natureFromSign("adamant", "spe", "+", PHYSICAL)).toBe("jolly");
    expect(natureFromSign("timid", "atk", "-", SPECIAL)).toBe("timid");
    expect(natureFromSign("modest", "spe", "-", SPECIAL)).toBe("quiet");
  });

  it("swaps when raising the lowered stat", () => {
    expect(natureFromSign("adamant", "spa", "+", PHYSICAL)).toBe("modest");
    expect(natureFromSign("Adamant", "atk", "-", PHYSICAL)).toBe("modest");
  });

  it("guesses the other side from a neutral nature", () => {
    expect(natureFromSign("Hardy", "spe", "+", PHYSICAL)).toBe("jolly");
    expect(natureFromSign("hardy", "spe", "+", SPECIAL)).toBe("timid");
    expect(natureFromSign("serious", "spe", "-", PHYSICAL)).toBe("brave");
    expect(natureFromSign("serious", "atk", "+", PHYSICAL)).toBe("adamant");
    expect(natureFromSign("serious", "atk", "-", PHYSICAL)).toBe("modest");
  });

  it("ignores HP", () => {
    expect(natureFromSign("adamant", "hp", "+", PHYSICAL)).toBeNull();
  });
});
