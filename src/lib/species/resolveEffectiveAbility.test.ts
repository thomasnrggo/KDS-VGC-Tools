import { describe, expect, it } from "vitest";
import { resolveEffectiveAbility } from "./resolveEffectiveAbility";

describe("resolveEffectiveAbility", () => {
  it("gives the Z Megas their own abilities (Regulation M-C)", () => {
    expect(resolveEffectiveAbility("Garchomp", "Garchompite Z", "Rough Skin")).toBe("Levitate");
    expect(resolveEffectiveAbility("Absol", "Absolite Z", "Super Luck")).toBe("Sharpness");
    expect(resolveEffectiveAbility("Lucario", "Lucarionite Z", "Inner Focus")).toBe("Aura Guard");
  });

  it("keeps the regular Mega and the base form apart", () => {
    expect(resolveEffectiveAbility("Garchomp", "Garchompite", "Rough Skin")).toBe("Sand Force");
    expect(resolveEffectiveAbility("Garchomp", undefined, "Rough Skin")).toBe("Rough Skin");
  });
});
