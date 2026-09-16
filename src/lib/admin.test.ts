import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminUid } from "./admin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAdminUid", () => {
  it("is true when the uid matches NEXT_PUBLIC_ADMIN_UID", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_UID", "admin-123");
    expect(isAdminUid("admin-123")).toBe(true);
  });

  it("is false when the uid doesn't match", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_UID", "admin-123");
    expect(isAdminUid("someone-else")).toBe(false);
  });

  it("is false for a null or undefined uid", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_UID", "admin-123");
    expect(isAdminUid(null)).toBe(false);
    expect(isAdminUid(undefined)).toBe(false);
  });

  it("is false when NEXT_PUBLIC_ADMIN_UID isn't set, even for an empty-string uid", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_UID", "");
    expect(isAdminUid("")).toBe(false);
    expect(isAdminUid("anything")).toBe(false);
  });
});
