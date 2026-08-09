export interface ParsedPokemon {
  /** Canonical Showdown species name, e.g. "Landorus-Therian" — used to resolve the sprite. */
  species: string;
  item?: string;
  /** Display-only in the hover card — never validated or computed on. */
  ability?: string;
  moves?: string[];
  /**
   * These two are shown as pasted, but are also fed into calculateFinalStats
   * (see src/lib/stats/) to compute Level 50 stats for the hover card. A
   * missing evs line defaults to 0 per stat there. There's no ivs field — this
   * app targets Pokémon Champions, which removed IVs entirely (every Pokémon
   * is always 31 in every stat), so nothing would ever populate it.
   */
  nature?: string;
  /**
   * Raw EVs line as pasted, e.g. "32 HP / 4 SpD / 32 Spe". In Pokémon Champions
   * these values are Stat Points (0-32 per stat, 66 total), not classic 0-252
   * EVs, despite the paste still labeling the line "EVs:" — calculateFinalStats
   * converts (1 SP = 8 EV) before applying the stat formula.
   */
  evs?: string;
}

export interface Team {
  id: string;
  name: string;
  rawPaste: string;
  pokemon: ParsedPokemon[];
  updatedAt: string;
}
