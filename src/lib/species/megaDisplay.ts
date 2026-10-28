import { candidateFormKeys } from "./candidateFormKeys";
import { speciesNamesMegaForm, stripMegaSuffix } from "./megaForm";
import type { ParsedPokemon } from "@/types";

/**
 * Whether a Pokémon has a Mega form, and how to show it with the Mega
 * toggled on or off. A Mega shows up in a paste two ways: base species + its
 * Mega Stone, or a species that already names the Mega ("Golisopod-Mega");
 * toggled off, both revert to the base species with no item.
 */
export function megaDisplay(
  pokemon: ParsedPokemon,
  showMega: boolean,
): { hasMegaForm: boolean; displayPokemon: ParsedPokemon } {
  const speciesIsMegaForm = speciesNamesMegaForm(pokemon.species);
  const hasMegaForm =
    speciesIsMegaForm || candidateFormKeys(pokemon.species, pokemon.item).length > 1;
  const baseSpecies = speciesIsMegaForm ? stripMegaSuffix(pokemon.species) : pokemon.species;
  return {
    hasMegaForm,
    displayPokemon:
      hasMegaForm && !showMega ? { ...pokemon, species: baseSpecies, item: undefined } : pokemon,
  };
}
