import { describe, expect, it } from "vitest";
import { parseTeamFolder } from "@/lib/teamFolder";
import { parseTeam } from "@/lib/parseTeam";
import { REGULATION_M_B_M_4_RAW } from "./regulationMbM4";

describe("REGULATION_M_B_M_4_RAW", () => {
  it("parses into 13 teams of 6 Pokémon each", () => {
    const entries = parseTeamFolder(REGULATION_M_B_M_4_RAW);
    expect(entries).toHaveLength(13);
    for (const entry of entries) {
      expect(parseTeam(entry.rawPaste)).toHaveLength(6);
    }
  });

  it("labels every team distinctly", () => {
    const labels = parseTeamFolder(REGULATION_M_B_M_4_RAW).map((entry) => entry.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
