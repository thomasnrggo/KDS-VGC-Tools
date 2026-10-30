import { describe, expect, it } from "vitest";
import { shortTournamentName } from "./metaDocument";

describe("shortTournamentName", () => {
  it("keeps the place, enough to label a chart", () => {
    expect(shortTournamentName("2027 Puebla Pokémon VGC Regional Championships")).toBe("Puebla");
    expect(shortTournamentName("2026 Gdańsk Pokémon VGC Regional Championships")).toBe("Gdańsk");
    expect(shortTournamentName("2026 North America Pokémon VGC International Championships")).toBe(
      "North America IC",
    );
    expect(shortTournamentName("2026 Turin Pokémon VGC Special Championships")).toBe("Turin SPE");
    expect(shortTournamentName("2026 Pokémon VGC World Championship")).toBe("Worlds");
  });
});
