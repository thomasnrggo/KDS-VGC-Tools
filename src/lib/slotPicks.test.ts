import { describe, expect, it } from "vitest";
import {
  duplicateSlots,
  effectiveMegas,
  groupToLeadBack,
  leadBackToGroup,
  pickIntoSlot,
  toggleSlotMega,
  usedInOtherSlots,
  type SlotPicks,
} from "./slotPicks";
import { EMPTY_PLAN } from "@/constants";
import type { ParsedPokemon } from "@/types";

const ROSTER: ParsedPokemon[] = [
  { species: "Gengar", item: "Gengarite" },
  { species: "Charizard", item: "Charizardite Y" },
  { species: "Incineroar", item: "Sitrus Berry" },
  { species: "Rillaboom", item: "Miracle Seed" },
  { species: "Garchomp-Mega-Z" },
];

function group(picks: (number | null)[], megas = picks.map(() => true)): SlotPicks {
  return { picks, megas };
}

describe("pickIntoSlot", () => {
  it("fills an empty slot", () => {
    expect(pickIntoSlot(group([null, null, null, null]), 2, 3, ROSTER).picks).toEqual([
      null,
      null,
      3,
      null,
    ]);
  });

  it("swaps when the Pokémon is already in another slot", () => {
    const next = pickIntoSlot(group([2, 3, null, null]), 3, 2, ROSTER);
    expect(next.picks).toEqual([null, 3, null, 2]);
    const swapped = pickIntoSlot(group([2, 3, 0, null]), 2, 3, ROSTER);
    expect(swapped.picks).toEqual([2, 0, 3, null]);
  });

  it("moves a Mega flag with its Pokémon", () => {
    const next = pickIntoSlot(group([0, 2, null, null], [true, true, true, true]), 3, 0, ROSTER);
    expect(next.picks).toEqual([null, 2, null, 0]);
    expect(next.megas[3]).toBe(true);
  });

  it("starts a second Mega-capable pick in its base form", () => {
    const next = pickIntoSlot(group([0, null, null, null]), 1, 1, ROSTER);
    expect(next.megas).toEqual([true, false, true, true]);
    // A pasted Mega form counts too.
    expect(pickIntoSlot(group([0, null, null, null]), 2, 4, ROSTER).megas[2]).toBe(false);
  });

  it("can start new picks with their Mega off", () => {
    expect(pickIntoSlot(group([null, null], [false, false]), 0, 0, ROSTER, false).megas).toEqual([
      false,
      false,
    ]);
  });

  it("clears a slot", () => {
    expect(pickIntoSlot(group([0, 1, null, null], [true, false, true, true]), 1, null, ROSTER)).toEqual(
      group([0, null, null, null]),
    );
  });
});

describe("toggleSlotMega", () => {
  it("turning one Mega on turns the others off", () => {
    expect(toggleSlotMega(group([0, 1, null, null], [true, false, true, true]), 1).megas).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("turning a Mega off leaves the rest", () => {
    expect(toggleSlotMega(group([0, 1], [true, false]), 0).megas).toEqual([false, false]);
  });
});

describe("effectiveMegas", () => {
  it("keeps only the first active Mega from older data", () => {
    expect(effectiveMegas(group([2, 0, 1, null]), ROSTER)).toEqual([true, true, false, true]);
  });
});

describe("duplicateSlots", () => {
  it("flags repeats after the first", () => {
    expect([...duplicateSlots([2, 3, 2, 3])]).toEqual([2, 3]);
    expect(duplicateSlots([null, null, 1, 0]).size).toBe(0);
  });
});

describe("leadBackToGroup / groupToLeadBack", () => {
  it("round-trips a plan", () => {
    const plan = { ...EMPTY_PLAN, leadPair: [0, 1] as [number, number], backMega: [false, true] as [boolean, boolean] };
    expect(groupToLeadBack(plan, leadBackToGroup(plan))).toEqual(plan);
  });
});

describe("usedInOtherSlots", () => {
  it("maps Pokémon in the other slots to those slots' tags", () => {
    const tags = ["L1", "L2", "B1", "B2"].map((tag) => ({ label: tag, tag }));
    expect(usedInOtherSlots([2, 3, null, 2], 1, tags)).toEqual({ 2: tags[0] });
  });
});
