import { describe, expect, it } from "vitest";
import { groupTeams, rosterKey } from "./groupTeams";
import type { LibraryTeam } from "./parseTeamLibrary";

function team(id: string, pokemon: string[], items: string[]): LibraryTeam {
  return { id, description: id, creator: "", pokemon, items, hasStatPoints: true };
}

describe("groupTeams", () => {
  const a1 = team("MC3", ["Garchomp", "Incineroar"], ["Choice Scarf", "Sitrus Berry"]);
  const b = team("MC2", ["Garchomp", "Incineroar"], ["Life Orb", "Sitrus Berry"]);
  const a2 = team("MC1", ["Incineroar", "Garchomp"], ["Sitrus Berry", "Choice Scarf"]);

  it("keys a roster by its Pokémon and items in any slot order", () => {
    expect(rosterKey(a1)).toBe(rosterKey(a2));
    expect(rosterKey(a1)).not.toBe(rosterKey(b));
  });

  it("groups the same roster under its first team, keeping the list's order", () => {
    expect(groupTeams([a1, b, a2]).map((group) => group.teams.map((t) => t.id))).toEqual([
      ["MC3", "MC1"],
      ["MC2"],
    ]);
  });
});
