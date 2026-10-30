import { formatTeamPaste } from "./formatPokemonPaste";
import type { LeadBackPicks } from "./slotPicks";
import type { MatchupPlan, PokemonSlot, Team, Tournament } from "@/types";

/**
 * Removing a Pokémon from a team shifts every later Pokémon down one place,
 * and everything that picks from the roster saves positions (lead/back
 * picks, per-Pokémon notes, logged games) — so each of those is shifted the
 * same way here, and a pick of the removed Pokémon is cleared.
 */
export function shiftSlot(slot: PokemonSlot | undefined, removed: number): PokemonSlot {
  if (slot === null || slot === undefined) return null;
  if (slot === removed) return null;
  return slot > removed ? slot - 1 : slot;
}

/** Lead/back picks with the removed Pokémon's slot cleared and later ones shifted. */
export function picksWithoutSlot<T extends LeadBackPicks>(picks: T, removed: number): T {
  const shift = (slot: PokemonSlot) => shiftSlot(slot, removed);
  return {
    ...picks,
    leadPair: [shift(picks.leadPair[0]), shift(picks.leadPair[1])],
    backPair: [shift(picks.backPair[0]), shift(picks.backPair[1])],
    ...(picks.backAlt !== undefined && { backAlt: shiftSlot(picks.backAlt, removed) }),
  };
}

/** Notes keyed by roster position, re-keyed after a removal (the removed one's are dropped). */
export function notesWithoutSlot(
  notes: Record<number, string> | undefined,
  removed: number,
): Record<number, string> | undefined {
  if (!notes) return notes;
  const next: Record<number, string> = {};
  for (const [key, value] of Object.entries(notes)) {
    const slot = shiftSlot(Number(key), removed);
    if (slot !== null) next[slot] = value;
  }
  return next;
}

/** Your side of a matchup's plans (Plan A and Plans B+); their picks point at their roster, so stay. */
export function matchupPlanWithoutSlot(plan: MatchupPlan, removed: number): MatchupPlan {
  return {
    ...picksWithoutSlot(plan, removed),
    ...(plan.morePlans && {
      morePlans: plan.morePlans.map((more) => picksWithoutSlot(more, removed)),
    }),
  };
}

/** The team without its Pokémon at `removed`: roster, paste, per-Pokémon notes and combinations. */
export function teamWithoutSlot(team: Team, removed: number): Team {
  const pokemon = team.pokemon.filter((_, index) => index !== removed);
  return {
    ...team,
    pokemon,
    rawPaste: formatTeamPaste(pokemon),
    pokemonNotes: notesWithoutSlot(team.pokemonNotes, removed),
    ...(team.combinations && {
      combinations: team.combinations.map((combination) => picksWithoutSlot(combination, removed)),
    }),
  };
}

/** A tournament's logged games, with your picks shifted — only when it was played with this team. */
export function tournamentWithoutSlot(
  tournament: Tournament,
  teamId: string,
  removed: number,
): Tournament {
  if (tournament.teamId !== teamId) return tournament;
  return {
    ...tournament,
    rounds: tournament.rounds.map((round) => ({
      ...round,
      games: round.games.map((game) => ({
        ...game,
        myPicks: game.myPicks.map((slot) => shiftSlot(slot, removed)) as typeof game.myPicks,
      })) as typeof round.games,
    })),
  };
}
