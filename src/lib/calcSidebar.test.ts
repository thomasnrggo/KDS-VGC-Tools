import { describe, expect, it } from "vitest";
import { ensureSidebarSelection, removeSidebarEntry } from "./calcSidebar";

const entry = (species: string) => ({ pokemon: { species } });
const fallback = () => entry("Default");
const a = entry("A");
const b = entry("B");
const c = entry("C");

describe("removeSidebarEntry", () => {
  it("replaces the last remaining entry with the fallback", () => {
    expect(removeSidebarEntry([a], 0, 0, fallback)).toEqual({
      sidebar: [fallback()],
      selectedIndex: 0,
      selectionChanged: true,
    });
  });

  it("opens the next entry when the open one is removed", () => {
    expect(removeSidebarEntry([a, b, c], 1, 1, fallback)).toMatchObject({
      sidebar: [a, c],
      selectedIndex: 1,
      selectionChanged: true,
    });
  });

  it("opens the previous entry when the open last one is removed", () => {
    expect(removeSidebarEntry([a, b, c], 2, 2, fallback)).toMatchObject({
      sidebar: [a, b],
      selectedIndex: 1,
      selectionChanged: true,
    });
  });

  it("keeps the same Pokémon open when another one is removed", () => {
    expect(removeSidebarEntry([a, b, c], 2, 0, fallback)).toMatchObject({
      sidebar: [b, c],
      selectedIndex: 1,
      selectionChanged: false,
    });
  });
});

describe("ensureSidebarSelection", () => {
  it("fills an empty sidebar with the fallback", () => {
    expect(ensureSidebarSelection([], null, fallback)).toEqual({ sidebar: [fallback()], selectedIndex: 0 });
  });

  it("selects the first entry when nothing (or something out of range) is selected", () => {
    expect(ensureSidebarSelection([a, b], null, fallback).selectedIndex).toBe(0);
    expect(ensureSidebarSelection([a, b], 5, fallback).selectedIndex).toBe(0);
  });

  it("keeps a valid selection", () => {
    expect(ensureSidebarSelection([a, b], 1, fallback)).toEqual({ sidebar: [a, b], selectedIndex: 1 });
  });
});
