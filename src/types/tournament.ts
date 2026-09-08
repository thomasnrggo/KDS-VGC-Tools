import type { ParsedPokemon } from "./team";
import type { TeamPokemonSlot } from "./team";

/** A single Bo3 game within a Round. Picks are indices — opponentPicks into that Round's opponentTeam, myPicks into the Tournament's own team roster — both fixed at 4 slots (VGC brings 4 of 6 per game), left null until picked. */
export interface TournamentGame {
  id: string;
  result: "win" | "loss" | null;
  opponentPicks: [TeamPokemonSlot, TeamPokemonSlot, TeamPokemonSlot, TeamPokemonSlot];
  myPicks: [TeamPokemonSlot, TeamPokemonSlot, TeamPokemonSlot, TeamPokemonSlot];
  notes: string;
}

/**
 * One Swiss round — a single opponent, up to 3 games (Bo3; the 3rd is
 * simply left unplayed/null if the round ends 2-0). The opponent's roster
 * is deliberately a simplified team — a real tournament team sheet rarely
 * reveals Stat Points, so `opponentTeam`/`opponentRawPaste` reuse the exact
 * same ParsedPokemon/parseTeam path every other pasted team in this app
 * uses, which already tolerates a block missing its EVs line.
 */
export interface TournamentRound {
  id: string;
  label: string;
  opponentRawPaste: string;
  opponentTeam: ParsedPokemon[];
  /** Per-opponent-Pokémon notes, keyed by index into opponentTeam — e.g. "always leads with this." */
  opponentPokemonNotes?: Record<number, string>;
  games: [TournamentGame, TournamentGame, TournamentGame];
}

/** A tournament run with one of your saved Teams — see src/lib/tournament.ts for the round/game-result derivation helpers and the usage-stats rollup shown on that team's Report page. */
export interface Tournament {
  id: string;
  name: string;
  teamId: string;
  regulationId: string;
  rounds: TournamentRound[];
  createdAt: string;
  updatedAt: string;
}
