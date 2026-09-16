import { describe, expect, it } from "vitest";
import { getRegulationLegalityIssues, isTeamLegalUnderRegulation } from "./regulationLegality";
import { REGULATIONS } from "@/data/regulations";
import type { ParsedPokemon } from "@/types";

const M_A = REGULATIONS.find((r) => r.id === "regulation-m-a")!;
const M_B = REGULATIONS.find((r) => r.id === "regulation-m-b")!;
const M_C = REGULATIONS.find((r) => r.id === "regulation-m-c")!;

describe("isTeamLegalUnderRegulation", () => {
  it("passes a roster with no held items that's legal under both regulations", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Ditto" }, { species: "Alakazam" }];
    expect(isTeamLegalUnderRegulation(pokemon, M_A)).toBe(true);
    expect(isTeamLegalUnderRegulation(pokemon, M_B)).toBe(true);
  });

  it("fails a roster with a species M-A doesn't have but M-B does (Vileplume)", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Vileplume" }];
    expect(isTeamLegalUnderRegulation(pokemon, M_A)).toBe(false);
    expect(isTeamLegalUnderRegulation(pokemon, M_B)).toBe(true);
  });

  it("fails a roster holding an item M-A banned but M-B legalized (Life Orb)", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Ditto", item: "Life Orb" }];
    expect(isTeamLegalUnderRegulation(pokemon, M_A)).toBe(false);
    expect(isTeamLegalUnderRegulation(pokemon, M_B)).toBe(true);
  });

  it("fails a roster holding a Mega Stone M-A doesn't grant but M-B does (Raichunite X)", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Raichu", item: "Raichunite X" }];
    expect(isTeamLegalUnderRegulation(pokemon, M_A)).toBe(false);
    expect(isTeamLegalUnderRegulation(pokemon, M_B)).toBe(true);
  });

  it("passes a Mega Stone that is legal for its species under the regulation", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Absol", item: "Absolite" }];
    expect(isTeamLegalUnderRegulation(pokemon, M_A)).toBe(true);
  });
});

describe("getRegulationLegalityIssues", () => {
  it("returns no issues for a fully legal roster", () => {
    expect(getRegulationLegalityIssues([{ species: "Ditto" }], M_B)).toEqual([]);
  });

  it("reports the offending index and species for an illegal species", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Ditto" }, { species: "Vileplume" }];
    const issues = getRegulationLegalityIssues(pokemon, M_A);
    expect(issues).toHaveLength(1);
    expect(issues[0].index).toBe(1);
    expect(issues[0].species).toBe("Vileplume");
    expect(issues[0].reason).toContain("Vileplume");
  });

  it("reports an illegal held item without also flagging the species", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Ditto", item: "Life Orb" }];
    const issues = getRegulationLegalityIssues(pokemon, M_A);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toContain("Life Orb");
  });
});

describe("cosmetic-only forms", () => {
  it("treats Floette-Eternal as legal wherever plain Floette is (M-A, M-B, M-C all list only 'floette')", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Floette-Eternal" }];
    expect(isTeamLegalUnderRegulation(pokemon, M_A)).toBe(true);
    expect(isTeamLegalUnderRegulation(pokemon, M_B)).toBe(true);
    expect(isTeamLegalUnderRegulation(pokemon, M_C)).toBe(true);
  });

  it("checks a Floette-Eternal's held Mega Stone against 'floette', not 'floette-eternal'", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Floette-Eternal", item: "Floettite" }];
    expect(isTeamLegalUnderRegulation(pokemon, M_A)).toBe(true);
  });

  it("treats a Squawkabilly plumage color as legal wherever plain Squawkabilly is (M-C only lists the base key)", () => {
    const pokemon: ParsedPokemon[] = [{ species: "Squawkabilly-Blue-Plumage" }];
    expect(isTeamLegalUnderRegulation(pokemon, M_C)).toBe(true);
  });
});
