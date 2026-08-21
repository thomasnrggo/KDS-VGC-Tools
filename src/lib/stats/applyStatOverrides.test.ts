import { describe, expect, it } from "vitest";
import { applyStatOverrides } from "./applyStatOverrides";
import { calculateFinalStats } from "./calculateFinalStats";

describe("applyStatOverrides", () => {
  const garchomp = { species: "Garchomp", nature: "Jolly", evs: "32 Atk / 2 Def / 32 Spe" };

  it("returns the Pokémon unchanged when there are no overrides", () => {
    expect(applyStatOverrides(garchomp, undefined)).toBe(garchomp);
    expect(applyStatOverrides(garchomp, {})).toBe(garchomp);
  });

  it("overrides a single stat's SP while leaving the rest at their pasted values", () => {
    const overridden = applyStatOverrides(garchomp, { sp: { spa: 32 } });
    const finalStats = calculateFinalStats(overridden);
    const originalFinalStats = calculateFinalStats(garchomp);

    // SpA was 0 SP in the paste — boosting it to 32 SP should raise SpA...
    expect(finalStats!.spa).toBeGreaterThan(originalFinalStats!.spa);
    // ...but leave Atk/Def/Spe (not touched by the override) exactly as pasted.
    expect(finalStats!.atk).toBe(originalFinalStats!.atk);
    expect(finalStats!.def).toBe(originalFinalStats!.def);
    expect(finalStats!.spe).toBe(originalFinalStats!.spe);
  });

  it("allows a total SP spread beyond the normal 66-point cap", () => {
    // 32 in every stat = 192 total, well beyond the legal 66-point cap — a
    // damage calculator should allow exploring this, not enforce team legality.
    const overridden = applyStatOverrides(garchomp, {
      sp: { hp: 32, atk: 32, def: 32, spa: 32, spd: 32, spe: 32 },
    });
    expect(overridden.evs).toBe("32 HP / 32 Atk / 32 Def / 32 SpA / 32 SpD / 32 Spe");
  });

  it("overrides nature, which changes the final stats via a different boost/cut pair", () => {
    const asJolly = calculateFinalStats(applyStatOverrides(garchomp, { nature: "Jolly" }));
    const asAdamant = calculateFinalStats(applyStatOverrides(garchomp, { nature: "Adamant" }));

    // Jolly = +Spe/-SpA, Adamant = +Atk/-SpA — switching should raise Atk and lower Spe.
    expect(asAdamant!.atk).toBeGreaterThan(asJolly!.atk);
    expect(asAdamant!.spe).toBeLessThan(asJolly!.spe);
  });
});
