import { describe, expect, it } from "vitest";
import { toSharedTeam } from "./sharedTeam";
import { createTeam } from "./team";
import { REGULATIONS } from "@/data/regulations";
import type { Team } from "@/types";

const PASTE = `Incineroar @ Sitrus Berry
Ability: Intimidate
EVs: 32 HP / 20 Def / 14 SpD
Impish Nature
- Fake Out
- Flare Blitz`;

const TEAM: Team = {
  ...createTeam(PASTE, "Chompy Z bascu", REGULATIONS[0].id),
  creator: " Anthos ",
  pokepasteUrl: "https://pokepast.es/abc",
  replicaCode: "ABC123",
  notes: "secret plan",
  overview: "<p>Sun with <strong>Mega Charizard Y</strong></p>",
};

describe("toSharedTeam", () => {
  it("keeps everything the report shows for a closed sheet", () => {
    const shared = toSharedTeam(TEAM, { sheet: "closed" }, "uid-1", "now");
    expect(shared).toMatchObject({
      id: TEAM.id,
      ownerUid: "uid-1",
      name: "Chompy Z bascu",
      creator: "Anthos",
      pokepasteUrl: "https://pokepast.es/abc",
      replicaCode: "ABC123",
      overview: "<p>Sun with <strong>Mega Charizard Y</strong></p>",
      sheet: "closed",
      updatedAt: "now",
    });
    expect(shared.pokemon[0]).toMatchObject({ evs: "32 HP / 20 Def / 14 SpD", nature: "Impish" });
  });

  it("drops Stat Points, nature and the Poképaste link for an open sheet", () => {
    const shared = toSharedTeam(TEAM, { sheet: "open" }, "uid-1");
    expect(shared.pokepasteUrl).toBeUndefined();
    expect(shared.replicaCode).toBe("ABC123");
    expect(shared.pokemon[0]).toEqual({
      species: "Incineroar",
      item: "Sitrus Berry",
      ability: "Intimidate",
      moves: ["Fake Out", "Flare Blitz"],
    });
  });

  it("leaves out an empty overview", () => {
    const shared = toSharedTeam({ ...TEAM, overview: "<p></p>" }, { sheet: "open" }, "uid-1");
    expect(shared.overview).toBeUndefined();
  });

  it("never includes the owner's notes", () => {
    expect(JSON.stringify(toSharedTeam(TEAM, { sheet: "closed" }, "uid-1"))).not.toContain(
      "secret plan",
    );
  });
});
