import type { PokemonText } from "@/lib/i18n/pokemonNames";
import { megaDisplayName, speciesNamesMegaForm } from "./megaForm";

/**
 * A species as the metagame pages show it: "Mega Charizard Y" for a Mega
 * form (the Pokémon-name language's own when it has one), the translated
 * name otherwise.
 */
export function speciesLabel(text: PokemonText, species: string): string {
  const translated = text.species(species);
  if (!speciesNamesMegaForm(species) || translated !== species) return translated;
  return megaDisplayName(species) ?? species;
}
