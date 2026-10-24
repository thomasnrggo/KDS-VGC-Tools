import { describe, expect, it } from "vitest";
import { computeBattleStat, type BattleStatContext } from "./battleStats";
import { calculateFinalStats } from "./calculateFinalStats";
import type { ParsedPokemon } from "@/types";

function context(pokemon: ParsedPokemon, patch: Partial<BattleStatContext> = {}): BattleStatContext {
  const stats = calculateFinalStats(pokemon);
  if (!stats) throw new Error(`No stats for ${pokemon.species}`);
  return {
    stats,
    stages: {},
    item: pokemon.item,
    ability: pokemon.ability,
    types: [],
    statused: false,
    paralyzed: false,
    ...patch,
  };
}

// Jolly Garchomp, 32 Spe: Speed 169 on the stat screen.
const garchomp: ParsedPokemon = { species: "Garchomp", nature: "Jolly", evs: "32 Atk / 32 Spe" };

describe("computeBattleStat", () => {
  it("equals the stat screen with nothing applied", () => {
    expect(computeBattleStat("spe", context(garchomp))).toEqual({ value: 169, sources: [] });
  });

  it("applies Choice Scarf and a +2 stage to Speed together", () => {
    const result = computeBattleStat(
      "spe",
      context({ ...garchomp, item: "Choice Scarf" }, { stages: { spe: 2 } }),
    );
    // 169 × 2 (stage) = 338, × 1.5 (Scarf) = 507.
    expect(result.value).toBe(507);
    expect(result.sources).toEqual([
      { kind: "stage", stage: 2 },
      { kind: "item", name: "Choice Scarf" },
    ]);
  });

  it("doubles Speed in Tailwind and with a weather Speed ability, and halves it when paralyzed", () => {
    expect(computeBattleStat("spe", context(garchomp, { tailwind: true })).value).toBe(338);
    expect(
      computeBattleStat(
        "spe",
        context({ ...garchomp, ability: "Swift Swim" }, { weather: "Rain" }),
      ).value,
    ).toBe(338);
    expect(computeBattleStat("spe", context(garchomp, { paralyzed: true })).value).toBe(84);
  });

  it("doubles Speed for Unburden only once it's marked active", () => {
    const unburden = { ...garchomp, ability: "Unburden" };
    expect(computeBattleStat("spe", context(unburden)).value).toBe(169);
    const active = computeBattleStat("spe", context(unburden, { abilityActive: true }));
    expect(active.value).toBe(338);
    expect(active.sources).toEqual([{ kind: "ability", name: "Unburden" }]);
    // The toggle does nothing for an ability it doesn't apply to.
    expect(computeBattleStat("spe", context(garchomp, { abilityActive: true })).value).toBe(169);
  });

  it("applies Choice Band to Attack only", () => {
    const banded = context({ ...garchomp, item: "Choice Band" });
    expect(computeBattleStat("atk", banded).value).toBe(Math.floor((182 * 3) / 2));
    expect(computeBattleStat("spa", banded).sources).toEqual([]);
  });

  it("applies Assault Vest to Sp. Def and Sand to a Rock type's Sp. Def", () => {
    const vest = computeBattleStat("spd", context({ ...garchomp, item: "Assault Vest" }));
    expect(vest.value).toBe(Math.floor((105 * 3) / 2));
    const sand = computeBattleStat("spd", context(garchomp, { weather: "Sand", types: ["Rock"] }));
    expect(sand.value).toBe(Math.floor((105 * 3) / 2));
    expect(sand.sources).toEqual([{ kind: "weather", weather: "Sand" }]);
  });

  it("boosts Attack with Guts only while statused, and lowers it with a negative stage", () => {
    const guts = { ...garchomp, ability: "Guts" };
    expect(computeBattleStat("atk", context(guts)).value).toBe(182);
    expect(computeBattleStat("atk", context(guts, { statused: true })).value).toBe(273);
    expect(computeBattleStat("atk", context(garchomp, { stages: { atk: -1 } })).value).toBe(121);
  });
});
