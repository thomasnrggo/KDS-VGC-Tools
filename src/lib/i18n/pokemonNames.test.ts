import { describe, expect, it } from "vitest";
import es from "@/data/names/es.json";
import esLatam from "@/data/names/es-419.json";
import { createPokemonText, ENGLISH_POKEMON_TEXT } from "./pokemonNames";

describe("createPokemonText", () => {
  const text = createPokemonText("es", es);
  const latam = createPokemonText("es-419", esLatam);

  it("translates the English names the app stores", () => {
    expect(text.move("Swords Dance")).toBe("Danza Espada");
    expect(latam.move("Swords Dance")).toBe("Danza de Espadas");
    expect(text.item("Choice Scarf")).toBe("Pañuelo Elección");
    expect(text.ability("Dragon's Maw")).toBe("Mandíbula Dragón");
    expect(text.ability("As One")).toBe("Unidad Ecuestre");
    expect(text.type("Fighting")).toBe("Lucha");
    expect(latam.type("Fighting")).toBe("Pelea");
    expect(text.nature("Adamant")).toBe("Firme");
  });

  it("names forms, including ones PokeAPI hasn't translated", () => {
    expect(text.species("Charizard-Mega-Y")).toBe("Mega-Charizard Y");
    expect(text.species("Garchomp-Mega-Z")).toBe("Mega-Garchomp Z");
    expect(text.species("Raichu-Alola")).toBe("Raichu (Forma de Alola)");
    expect(text.species("Indeedee-F")).toBe("Indeedee (Hembra)");
    expect(text.speciesForm("Charizard", "Charizardite Y", "Mega Charizard Y")).toBe(
      "Mega-Charizard Y",
    );
    expect(ENGLISH_POKEMON_TEXT.speciesForm("Charizard", "Charizardite Y", "Mega Charizard Y")).toBe(
      "Mega Charizard Y",
    );
  });

  it("borrows Spain's names for items Latin-American data lacks", () => {
    expect(latam.item("Booster Energy")).toBe(text.item("Booster Energy"));
    expect(latam.item("Booster Energy")).not.toBe("Booster Energy");
  });

  it("falls back to the English name", () => {
    expect(text.move("Not A Real Move")).toBe("Not A Real Move");
    expect(text.item("")).toBe("");
    expect(ENGLISH_POKEMON_TEXT.species("Garchomp-Mega-Z")).toBe("Garchomp-Mega-Z");
  });
});
