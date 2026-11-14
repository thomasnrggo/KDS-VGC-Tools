import { formatTeamPaste } from "./formatPokemonPaste";
import type { LeadBackPicks } from "./slotPicks";
import type { MatchupPlan, PokemonSlot, Team, Tournament } from "@/types";

/**
 * Everything that picks from a team's roster saves positions (lead/back
 * picks, per-Pokémon notes, logged games). When the roster changes — a
 * Pokémon removed, or one moved to another place — each of those is
 * remapped with a SlotMap, so it keeps pointing at the same Pokémon; a pick
 * of a removed Pokémon is cleared.
 */
export type SlotMap = (slot: number) => PokemonSlot;

/** Removing the Pokémon at `removed`: later ones shift down a place, it's cleared. */
export function removalMap(removed: number): SlotMap {
  return (slot) => (slot === removed ? null : slot > removed ? slot - 1 : slot);
}

/** Moving the Pokémon at `from` to `to`: it lands there, the ones between shift a place. */
export function moveMap(from: number, to: number): SlotMap {
  return (slot) => {
    if (slot === from) return to;
    if (from < to && slot > from && slot <= to) return slot - 1;
    if (to < from && slot >= to && slot < from) return slot + 1;
    return slot;
  };
}

function remapSlot(slot: PokemonSlot | undefined, map: SlotMap): PokemonSlot {
  return slot === null || slot === undefined ? null : map(slot);
}

export function shiftSlot(slot: PokemonSlot | undefined, removed: number): PokemonSlot {
  return remapSlot(slot, removalMap(removed));
}

/** Lead/back picks, remapped (see SlotMap). */
export function remapPicks<T extends LeadBackPicks>(picks: T, map: SlotMap): T {
  const remap = (slot: PokemonSlot) => remapSlot(slot, map);
  return {
    ...picks,
    leadPair: [remap(picks.leadPair[0]), remap(picks.leadPair[1])],
    backPair: [remap(picks.backPair[0]), remap(picks.backPair[1])],
    ...(picks.backAlt !== undefined && { backAlt: remapSlot(picks.backAlt, map) }),
  };
}

/** Notes keyed by roster position, re-keyed (a removed Pokémon's are dropped). */
export function remapNotes(
  notes: Record<number, string> | undefined,
  map: SlotMap,
): Record<number, string> | undefined {
  if (!notes) return notes;
  const next: Record<number, string> = {};
  for (const [key, value] of Object.entries(notes)) {
    const slot = map(Number(key));
    if (slot !== null) next[slot] = value;
  }
  return next;
}

/** Your side of a matchup's plans (Plan A and Plans B+); their picks point at their roster, so stay. */
export function remapMatchupPlan(plan: MatchupPlan, map: SlotMap): MatchupPlan {
  return {
    ...remapPicks(plan, map),
    ...(plan.morePlans && {
      morePlans: plan.morePlans.map((more) => remapPicks(more, map)),
    }),
  };
}

/** A tournament's logged games, with your picks remapped — only when it was played with this team. */
export function remapTournament(tournament: Tournament, teamId: string, map: SlotMap): Tournament {
  if (tournament.teamId !== teamId) return tournament;
  return {
    ...tournament,
    rounds: tournament.rounds.map((round) => ({
      ...round,
      games: round.games.map((game) => ({
        ...game,
        myPicks: game.myPicks.map((slot) => remapSlot(slot, map)) as typeof game.myPicks,
      })) as typeof round.games,
    })),
  };
}

/** A team's own slot references — per-Pokémon notes and combinations — remapped. */
function remapTeamSlots(team: Team, pokemon: Team["pokemon"], map: SlotMap): Team {
  return {
    ...team,
    pokemon,
    rawPaste: formatTeamPaste(pokemon),
    pokemonNotes: remapNotes(team.pokemonNotes, map),
    ...(team.combinations && {
      combinations: team.combinations.map((combination) => remapPicks(combination, map)),
    }),
  };
}

/** The team without its Pokémon at `removed`: roster, paste, per-Pokémon notes and combinations. */
export function teamWithoutSlot(team: Team, removed: number): Team {
  const pokemon = team.pokemon.filter((_, index) => index !== removed);
  return remapTeamSlots(team, pokemon, removalMap(removed));
}

/** The team with its Pokémon at `from` moved to `to` (the ones between shift a place). */
export function teamWithPokemonMoved(team: Team, from: number, to: number): Team {
  if (from === to || !team.pokemon[from] || to < 0 || to >= team.pokemon.length) return team;
  const pokemon = [...team.pokemon];
  const [moved] = pokemon.splice(from, 1);
  pokemon.splice(to, 0, moved);
  return remapTeamSlots(team, pokemon, moveMap(from, to));
}

/** Lead/back picks with the removed Pokémon's slot cleared and later ones shifted. */
export function picksWithoutSlot<T extends LeadBackPicks>(picks: T, removed: number): T {
  return remapPicks(picks, removalMap(removed));
}

export function notesWithoutSlot(
  notes: Record<number, string> | undefined,
  removed: number,
): Record<number, string> | undefined {
  return remapNotes(notes, removalMap(removed));
}

export function matchupPlanWithoutSlot(plan: MatchupPlan, removed: number): MatchupPlan {
  return remapMatchupPlan(plan, removalMap(removed));
}

export function tournamentWithoutSlot(
  tournament: Tournament,
  teamId: string,
  removed: number,
): Tournament {
  return remapTournament(tournament, teamId, removalMap(removed));
}
