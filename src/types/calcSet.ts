import type { ParsedPokemon } from "./team";

/**
 * A saved Damage Calculator build: species, item, ability, nature, Stat
 * Points and moves (HP, status, stat stages and field stay per calc). Two
 * kinds share this shape — a user's own sets (IndexedDB, synced to
 * `users/{uid}/calcSets` when signed in, see src/lib/storage/db.ts) and the
 * admin's public sets (Firestore `publicSets`, readable by everyone, see
 * src/lib/firebase/publicSets.ts). Not tied to a regulation.
 */
export interface CalcSet {
  id: string;
  /** Shown under the species in the calc's set picker, e.g. "Choice Scarf". */
  name: string;
  pokemon: ParsedPokemon;
  updatedAt: string;
}
