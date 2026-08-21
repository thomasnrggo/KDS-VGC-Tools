import {
  REGULATION_M_B_SPECIES_KEYS,
  REGULATION_M_B_HELD_ITEMS,
  REGULATION_M_B_BERRIES,
} from "./regulationMB";

export interface Regulation {
  id: string;
  label: string;
  /** src/data/species.json keys legal to add under this regulation. */
  speciesKeys: string[];
  /** Legal non-Mega-Stone held items (regular held items + Berries) — Mega Stones are handled separately per-species, see regulationMB.ts's megaStoneItemsForSpecies. */
  items: string[];
}

/**
 * Registry of every regulation the "add any Pokémon" picker can filter by —
 * one entry today, following the same one-file-per-entry + index pattern
 * already established for src/data/presets/. A future regulation is a new
 * `regulationMC.ts` (etc.) plus one more entry here, no other code changes.
 */
export const REGULATIONS: Regulation[] = [
  {
    id: "regulation-m-b",
    label: "Regulation M-B",
    speciesKeys: REGULATION_M_B_SPECIES_KEYS,
    items: [...REGULATION_M_B_HELD_ITEMS, ...REGULATION_M_B_BERRIES],
  },
];

export { megaStoneItemsForSpecies } from "./regulationMB";
