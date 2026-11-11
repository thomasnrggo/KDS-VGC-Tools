import { describe, expect, it } from "vitest";
import { timeAgo } from "./timeAgo";

const NOW = new Date("2026-11-11T12:00:00Z").getTime();

describe("timeAgo", () => {
  it("uses the largest unit that fits", () => {
    expect(timeAgo("2026-11-11T11:55:00Z", "en", NOW)).toBe("5 minutes ago");
    expect(timeAgo("2026-11-11T09:00:00Z", "en", NOW)).toBe("3 hours ago");
    expect(timeAgo("2026-11-10T12:00:00Z", "en", NOW)).toBe("yesterday");
  });

  it("says now under a minute, and follows the language", () => {
    expect(timeAgo("2026-11-11T11:59:40Z", "en", NOW)).toBe("now");
    expect(timeAgo("2026-11-11T11:55:00Z", "es", NOW)).toBe("hace 5 minutos");
  });
});
