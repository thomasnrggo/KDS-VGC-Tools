import { describe, expect, it } from "vitest";
import {
  analyzeImport,
  buildImport,
  defaultDecision,
  importNeedsReview,
  type ImportDecision,
} from "./opponentImport";
import { createOpponent } from "./opponent";
import { REGULATIONS } from "@/data/regulations";
import type { MatchupPlan } from "@/types";

const REG_ID = REGULATIONS[0].id;

const PERISH_KOMMOO = [
  "Vivillon @ Focus Sash",
  "Politoed @ Sitrus Berry",
  "Gengar @ Gengarite",
  "Incineroar @ Passho Berry",
  "Rillaboom @ Occa Berry",
  "Kommo-o @ Leftovers",
].join("\n\n");
const PERISH_ARCHA = [
  "Politoed @ Sitrus Berry",
  "Raichu @ Raichunite Y",
  "Rillaboom @ Eject Button",
  "Gengar @ Gengarite",
  "Incineroar @ Chople Berry",
  "Archaludon @ Leftovers",
].join("\n\n");
// Shares 4 with Perish - Archa incl. the Gengar Mega, but only 3 with Kommoo.
const PERISH_THIRD = [
  "Politoed @ Sitrus Berry",
  "Raichu @ Raichunite Y",
  "Gengar @ Gengarite",
  "Archaludon @ Leftovers",
  "Sinistcha @ Colbur Berry",
  "Kingambit @ Life Orb",
].join("\n\n");
const UNRELATED = "Ditto @ Choice Scarf";

const PLAN: MatchupPlan = {
  leadPair: [0, 1],
  backPair: [2, 3],
  leadMega: [true, true],
  backMega: [true, true],
  notes: "perish trap them",
};

const defaults = (rows: ReturnType<typeof analyzeImport>) => rows.map(defaultDecision);

describe("analyzeImport", () => {
  it("offers a team in the same paste as a variant group (the Perish pair)", () => {
    const rows = analyzeImport(
      [
        { label: "Perish - Kommoo", rawPaste: PERISH_KOMMOO },
        { label: "Perish - Archa", rawPaste: PERISH_ARCHA },
      ],
      [],
    );
    expect(rows[0].candidates).toEqual([]);
    expect(rows[1].candidates.map((c) => [c.label, c.target])).toEqual([
      ["Perish - Kommoo", { kind: "entry", index: 0 }],
    ]);
    expect(importNeedsReview(rows)).toBe(true);
  });

  it("offers a saved opponent's group", () => {
    const saved = createOpponent("Perish - Kommoo", PERISH_KOMMOO, REG_ID);
    const [row] = analyzeImport([{ label: "Perish - Archa", rawPaste: PERISH_ARCHA }], [saved]);
    expect(row.candidates[0].target).toEqual({ kind: "existing", opponent: saved });
  });

  it("flags exact duplicates of saved teams and of earlier teams in the paste, and errors", () => {
    const saved = createOpponent("Saved", UNRELATED, REG_ID);
    const rows = analyzeImport(
      [
        { label: "Copy of saved", rawPaste: UNRELATED },
        { label: "First", rawPaste: PERISH_KOMMOO },
        { label: "Second", rawPaste: PERISH_KOMMOO },
        { label: "Empty", rawPaste: "\n\n" },
      ],
      [saved],
    );
    expect(rows.map((row) => row.duplicateOf)).toEqual(["Saved", undefined, "First", undefined]);
    expect(rows[3].error).toBeTruthy();
    expect(defaults(rows).map((d) => d.action)).toEqual(["skip", "new", "skip", "skip"]);
    expect(importNeedsReview(rows)).toBe(false);
  });
});

describe("buildImport", () => {
  it("creates a same-paste variant pair as one group", () => {
    const rows = analyzeImport(
      [
        { label: "Perish - Kommoo", rawPaste: PERISH_KOMMOO },
        { label: "Perish - Archa", rawPaste: PERISH_ARCHA },
      ],
      [],
    );
    const { created, result } = buildImport(rows, defaults(rows), [], REG_ID);
    expect(created[1].variantOf).toBe(created[0].id);
    expect(created[0].variantOf).toBeUndefined();
    expect(result).toEqual({ importedCount: 2, variantCount: 1, skipped: [] });
  });

  it("keeps groups one level deep — a variant of a variant joins the main", () => {
    const rows = analyzeImport(
      [
        { label: "Kommoo", rawPaste: PERISH_KOMMOO },
        { label: "Archa", rawPaste: PERISH_ARCHA },
        { label: "Third", rawPaste: PERISH_THIRD },
      ],
      [],
    );
    // Third only matches Archa (an earlier entry), which itself joins Kommoo.
    expect(rows[2].candidates.map((c) => c.label)).toEqual(["Archa"]);
    const { created } = buildImport(rows, defaults(rows), [], REG_ID);
    expect(created[2].variantOf).toBe(created[0].id);
  });

  it("adds a team as new when the entry it would have joined was skipped", () => {
    const rows = analyzeImport(
      [
        { label: "Kommoo", rawPaste: PERISH_KOMMOO },
        { label: "Archa", rawPaste: PERISH_ARCHA },
      ],
      [],
    );
    const decisions: ImportDecision[] = [{ action: "skip" }, defaultDecision(rows[1])];
    const { created, result } = buildImport(rows, decisions, [], REG_ID);
    expect(created.map((o) => [o.label, o.variantOf])).toEqual([["Archa", undefined]]);
    expect(result.variantCount).toBe(0);
    expect(result.skipped).toEqual(["Kommoo: skipped"]);
  });

  it("copies the saved main's plans into a new variant and flags them as copied", () => {
    const saved = {
      ...createOpponent("Perish - Kommoo", PERISH_KOMMOO, REG_ID),
      plansByTeamId: { "my-team": PLAN },
    };
    const rows = analyzeImport([{ label: "Perish - Archa", rawPaste: PERISH_ARCHA }], [saved]);
    const [variant] = buildImport(rows, defaults(rows), [saved], REG_ID).created;
    expect(variant.variantOf).toBe(saved.id);
    expect(variant.plansByTeamId["my-team"]).toEqual(PLAN);
    expect(variant.copiedPlanFrom).toEqual({ "my-team": saved.id });
  });

  it("puts imported teams above existing ones, in paste order", () => {
    const saved = { ...createOpponent("Saved", UNRELATED, REG_ID), sortOrder: 100 };
    const rows = analyzeImport(
      [
        { label: "A", rawPaste: PERISH_KOMMOO },
        { label: "B", rawPaste: "Torkoal @ Charcoal" },
      ],
      [saved],
    );
    const { created } = buildImport(rows, defaults(rows), [saved], REG_ID);
    expect(created[0].sortOrder).toBeGreaterThan(created[1].sortOrder);
    expect(created[1].sortOrder).toBeGreaterThan(saved.sortOrder);
  });
});
