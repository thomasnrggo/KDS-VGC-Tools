import {
  REGULATION_M_B_SPECIES_KEYS,
  REGULATION_M_B_HELD_ITEMS,
  REGULATION_M_B_BERRIES,
  megaStoneItemsForSpecies as megaStoneItemsForSpeciesMB,
} from "./regulationMB";
import {
  REGULATION_M_A_SPECIES_KEYS,
  REGULATION_M_A_HELD_ITEMS,
  REGULATION_M_A_BERRIES,
  megaStoneItemsForSpeciesMA,
} from "./regulationMA";

export interface Regulation {
  id: string;
  label: string;
  /** src/data/species.json keys legal to add under this regulation. */
  speciesKeys: string[];
  /** Legal non-Mega-Stone held items (regular held items + Berries) — Mega Stones are handled separately per-species, see megaStoneItemsForSpecies below. */
  items: string[];
  /** Legal Mega Stone display name(s) for a species.json key under this regulation (e.g. "charizard" -> ["Charizardite X", "Charizardite Y"]); empty if that species has no legal Mega form here. */
  megaStoneItemsForSpecies: (speciesKey: string) => string[];
}

/**
 * Registry of every regulation the "add any Pokémon" picker can filter by —
 * one file per regulation + one entry here (regulationMB.ts, regulationMA.ts,
 * a future regulationMC.ts, ...), same pattern src/data/seasons/ uses for its
 * own per-season data files. Order matters: index 0 is treated as "the
 * current regulation" everywhere else in the app (RosterPokemonPicker's
 * species/item pickers, normalizeOpponent's backfill default, the
 * Opponents section's default filter) — M-B stays first since it's still
 * current; M-A (2026-04-08–2026-06-17, already ended) is registered after
 * it for reference/theorycrafting against past-season opponent data, not as
 * something new opponents default to.
 */
export const REGULATIONS: Regulation[] = [
  {
    id: "regulation-m-b",
    label: "Regulation M-B",
    speciesKeys: REGULATION_M_B_SPECIES_KEYS,
    items: [...REGULATION_M_B_HELD_ITEMS, ...REGULATION_M_B_BERRIES],
    megaStoneItemsForSpecies: megaStoneItemsForSpeciesMB,
  },
  {
    id: "regulation-m-a",
    label: "Regulation M-A",
    speciesKeys: REGULATION_M_A_SPECIES_KEYS,
    items: [...REGULATION_M_A_HELD_ITEMS, ...REGULATION_M_A_BERRIES],
    megaStoneItemsForSpecies: megaStoneItemsForSpeciesMA,
  },
];

export { megaStoneItemsForSpecies } from "./regulationMB";
export { megaStoneItemsForSpeciesMA } from "./regulationMA";
