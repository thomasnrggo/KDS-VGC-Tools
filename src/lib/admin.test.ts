import { describe, expect, it } from "vitest";
import { isAdminRole, isStaffRole, parseRole } from "./admin";

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
