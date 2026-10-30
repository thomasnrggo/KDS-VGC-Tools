import { describe, expect, it } from "vitest";
import { computePokemonBuild } from "./computePokemonBuild";
import type { ParsedPokemon } from "@/types";

const basculegion: ParsedPokemon = {
  species: "Basculegion-F",
  item: "Focus Sash",
  ability: "Swift Swim",
  nature: "Modest",
  moves: ["Muddy Water"],
};

describe("computePokemonBuild", () => {
  it("resolves a Showdown form name through the aliases", () => {
    // Showdown's "Basculegion-F" is species.json's "basculegion-female".
    const build = computePokemonBuild(basculegion, false, {});
    expect(build.types).toEqual(["Water", "Ghost"]);
    expect(build.abilitySelectOptions.map((option) => option.id)).toEqual([
      "Swift Swim",
      "Adaptability",
      "Mold Breaker",
    ]);
  });
});
