import type { ParsedPokemon } from "./team";
import type { TeamPokemonSlot } from "./team";

/**
 * A single Bo3 game within a Round. Picks are indices — opponentPicks into
 * that Round's opponentTeam, myPicks into the Tournament's own team roster
 * — both fixed at 4 slots (VGC brings 4 of 6 per game), left null until
 * picked. `"tie"` is a double-knockout draw (both sides' last Pokémon faint
 * the same turn) — rare, but a real ruling, not a data-entry mistake.
 */
export interface TournamentGame {
  id: string;
  result: "win" | "loss" | "tie" | null;
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
  /**
   * A win awarded without playing any games — either "walkover" (the
   * opponent was paired but didn't show up; `opponentTeam` may still be
   * filled in from a submitted sheet) or "bye" (an odd-player-count Swiss
   * artifact — there was no opponent to face at all). Both always resolve
   * to a win in getRoundResult, which checks this before counting `games`;
   * the games stay unplayed (null) and don't count toward
   * computeTeamUsageStats, same as any other round that ended before all 3
   * were logged.
   */
  roundOutcome?: "walkover" | "bye";
}

/** A tournament run with one of your saved Teams — see src/lib/tournament.ts for the round/game-result derivation helpers and the usage-stats rollup shown on that team's Report page. */
export interface Tournament {
  id: string;
  name: string;
  teamId: string;
  regulationId: string;
  rounds: TournamentRound[];
  /** Total entrants at this event, if known — purely informational. */
  participantCount?: number;
  /** Final standing, e.g. 5 for "5th place" — purely informational. */
  placement?: number;
  /** Link to the event's official page/bracket, if any. */
  tournamentUrl?: string;
  /** ISO timestamp of when this tournament was marked completed, or absent/undefined while it's still ongoing. Reversible (see completeTournament/reopenTournament in src/lib/tournament.ts) — same archivedAt pattern Team uses. Rounds can't be added to a completed tournament. */
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
