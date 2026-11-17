import { describe, expect, it } from "vitest";
import {
  MAX_SNAPSHOTS,
  createSnapshot,
  matchesSnapshot,
  restoreSlotMap,
  restoreSnapshot,
  snapshotChanges,
  snapshotData,
  teamFromSnapshot,
  withSnapshot,
  withoutSnapshot,
} from "./teamSnapshots";
import { duplicateTeam } from "./team";
import type { Team } from "@/types";

const team: Team = {
  id: "t1",
  name: "Sun",
  rawPaste: "Charizard @ Charizardite Y",
  pokemon: [
    {
      species: "Charizard",
      item: "Charizardite Y",
      ability: "Solar Power",
      nature: "Timid",
      evs: "2 HP / 32 SpA / 32 Spe",
      moves: ["Heat Wave", "Solar Beam", "Protect", "Overheat"],
    },
    { species: "Venusaur", item: "Life Orb", moves: ["Sleep Powder", "Protect"] },
  ],
  regulationIds: ["regulation-m-c"],
  notes: "<p>Lead Zard + Venu</p>",
  combinations: [{ id: "c1", name: "Default", lead: [0, 1], back: [null, null] }] as never,
  share: { sheet: "closed" } as never,
  sortOrder: 1,
  updatedAt: "2026-11-01T00:00:00.000Z",
};

describe("snapshots", () => {
  it("keep the build and strategy, not the team's identity", () => {
    const data = snapshotData(team) as unknown as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(["combinations", "notes", "pokemon", "rawPaste"]);
  });

  it("restore the build, save the current one first, and keep the identity", () => {
    const saved = createSnapshot(team, "Before Puebla", { now: "2026-11-02T00:00:00.000Z" });
    const edited: Team = {
      ...withSnapshot(team, saved),
      name: "Sun v2",
      pokemon: [{ ...team.pokemon[0], item: "Choice Specs" }, team.pokemon[1]],
      notes: undefined,
    };
    const restored = restoreSnapshot(edited, saved, "Before restoring", {
      now: "2026-11-03T00:00:00.000Z",
    });
    expect(restored.pokemon[0].item).toBe("Charizardite Y");
    expect(restored.notes).toBe(team.notes);
    expect(restored.name).toBe("Sun v2");
    expect(restored.share).toEqual(team.share);
    expect(restored.snapshots?.map((s) => [s.name, s.auto])).toEqual([
      ["Before restoring", "beforeRestore"],
      ["Before Puebla", undefined],
    ]);
    expect(restored.snapshots?.[0].data.pokemon[0].item).toBe("Choice Specs");
    expect(matchesSnapshot(restored, saved)).toBe(true);
  });

  it("don't save the current team again when a snapshot already has it", () => {
    const saved = createSnapshot(team, "A");
    const other = createSnapshot({ ...team, notes: "<p>old</p>" }, "B");
    const restored = restoreSnapshot(withSnapshot(withSnapshot(team, other), saved), other, "Auto");
    expect(restored.snapshots?.map((s) => s.name)).toEqual(["A", "B"]);
  });

  it("drop the oldest past the cap, an automatic one first", () => {
    let current: Team = withSnapshot(team, {
      ...createSnapshot(team, "auto"),
      auto: "beforeRestore",
    });
    for (let i = 0; i < MAX_SNAPSHOTS; i++)
      current = withSnapshot(current, createSnapshot(team, `#${i}`));
    expect(current.snapshots).toHaveLength(MAX_SNAPSHOTS);
    expect(current.snapshots?.some((s) => s.auto)).toBe(false);
    current = withSnapshot(current, createSnapshot(team, "newest"));
    expect(current.snapshots?.[0].name).toBe("newest");
    expect(current.snapshots?.at(-1)?.name).toBe("#1");
  });

  it("remove one, and the field when none is left", () => {
    const saved = createSnapshot(team, "A");
    expect("snapshots" in withoutSnapshot(withSnapshot(team, saved), saved.id)).toBe(false);
  });

  it("aren't copied with the team", () => {
    const withOne = withSnapshot(team, createSnapshot(team, "A"));
    expect(duplicateTeam(withOne, "Copy").snapshots).toBeUndefined();
    expect(teamFromSnapshot(withOne, withOne.snapshots![0]).snapshots).toBeUndefined();
  });
});

describe("snapshotChanges", () => {
  it("lists what changed since the snapshot", () => {
    const saved = snapshotData(team);
    const now: Team = {
      ...team,
      pokemon: [
        {
          ...team.pokemon[0],
          item: "Choice Specs",
          evs: "2 HP / 32 SpA / 24 Spe / 8 SpD",
          moves: ["Heat Wave", "Solar Beam", "Protect", "Air Slash"],
        },
        { species: "Torkoal", item: "Charcoal" },
      ],
      combinations: [],
    };
    expect(snapshotChanges(saved, now)).toEqual([
      { kind: "removed", species: "Venusaur" },
      {
        kind: "changed",
        species: "Charizard",
        item: ["Charizardite Y", "Choice Specs"],
        movesAdded: ["Air Slash"],
        movesRemoved: ["Overheat"],
        points: [
          { stat: "spd", delta: 8 },
          { stat: "spe", delta: -8 },
        ],
      },
      { kind: "added", species: "Torkoal" },
      { kind: "strategy", parts: ["combinations"] },
    ]);
  });

  it("is empty when nothing changed, reordering included", () => {
    const saved = snapshotData(team);
    expect(snapshotChanges(saved, { ...team, pokemon: [...team.pokemon].reverse() })).toEqual([]);
  });
});

describe("restoreSlotMap", () => {
  const mon = (species: string) => ({ species });
  it("follows each Pokémon to its place in the restored roster, clearing the ones it lacks", () => {
    const map = restoreSlotMap(
      [mon("Charizard"), mon("Torkoal"), mon("Venusaur")],
      [mon("Venusaur"), mon("Charizard-Mega-Y"), mon("Kingambit")],
    )!;
    expect([0, 1, 2].map(map)).toEqual([1, null, 0]);
  });
  it("is null when nothing moves", () => {
    expect(restoreSlotMap([mon("A"), mon("B")], [mon("A"), mon("B")])).toBeNull();
  });
});
