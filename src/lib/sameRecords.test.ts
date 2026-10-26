import { describe, expect, it } from "vitest";
import { sameRecords } from "./sameRecords";

const r = (id: string, updatedAt = "2026-10-01") => ({ id, updatedAt });

describe("sameRecords", () => {
  it("ignores order", () => {
    expect(sameRecords([r("a"), r("b")], [r("b"), r("a")])).toBe(true);
  });

  it("notices an edit, an addition or a removal", () => {
    expect(sameRecords([r("a")], [r("a", "2026-10-02")])).toBe(false);
    expect(sameRecords([r("a")], [r("a"), r("b")])).toBe(false);
    expect(sameRecords([r("a"), r("b")], [r("a"), r("c")])).toBe(false);
  });
});
