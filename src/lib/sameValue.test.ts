import { describe, expect, it } from "vitest";
import { sameValue } from "./sameValue";

describe("sameValue", () => {
  it("ignores key order and undefined keys", () => {
    expect(sameValue({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 })).toBe(
      true,
    );
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });

  it("still sees real differences", () => {
    expect(sameValue({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameValue({ a: null }, { a: undefined })).toBe(false);
    expect(sameValue({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    expect(sameValue([1], { 0: 1 })).toBe(false);
  });
});
