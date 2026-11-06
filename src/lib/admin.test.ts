import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminRole, isOwnerUid, isStaffRole, parseRole } from "./admin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isOwnerUid", () => {
  it("is true when the uid matches NEXT_PUBLIC_ADMIN_UID", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_UID", "admin-123");
    expect(isOwnerUid("admin-123")).toBe(true);
  });

  it("is false when the uid doesn't match", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_UID", "admin-123");
    expect(isOwnerUid("someone-else")).toBe(false);
  });

  it("is false for a null or undefined uid", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_UID", "admin-123");
    expect(isOwnerUid(null)).toBe(false);
    expect(isOwnerUid(undefined)).toBe(false);
  });

  it("is false when NEXT_PUBLIC_ADMIN_UID isn't set, even for an empty-string uid", () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_UID", "");
    expect(isOwnerUid("")).toBe(false);
    expect(isOwnerUid("anything")).toBe(false);
  });
});

describe("roles", () => {
  it("reads a role doc's value, anything unknown as a regular user", () => {
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("moderator")).toBe("moderator");
    expect(parseRole("Admin")).toBe("user");
    expect(parseRole(undefined)).toBe("user");
  });

  it("lets moderators and admins keep the data, only admins manage flags and roles", () => {
    expect([isStaffRole("admin"), isStaffRole("moderator"), isStaffRole("user")]).toEqual([
      true,
      true,
      false,
    ]);
    expect([isAdminRole("admin"), isAdminRole("moderator"), isAdminRole("user")]).toEqual([
      true,
      false,
      false,
    ]);
  });
});
