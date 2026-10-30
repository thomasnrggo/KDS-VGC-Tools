import type { MetaCombos, MetaPokemon } from "./aggregateMeta";

/** How many of the newest events make up the "recent" metagame. */
export const RECENT_EVENTS = 4;

export interface MetaSlice {
  teams: number;
  /** Teams in the top 32 of their event. */
  topTeams: number;
  /** Most-used first. */
  pokemon: MetaPokemon[];
  /** Pairs, trios, quads and full teams — absent in documents written before they existed. */
  combos?: MetaCombos;
}

/**
 * `meta/{regulationId}` in Firestore — what the metagame job
 * (scripts/update-meta.mjs) writes and the app reads through useMeta. See
 * PLANNING.md's "Metagame data". Keep the two in step: the job is plain
 * JavaScript, so this type is the only check on the shape.
 */
export interface MetaDocument {
  regulationId: string;
  /** ISO timestamp of the job run that wrote it. */
  updatedAt: string;
  /** Official tournaments (Regionals, Internationals, Worlds). */
  official: {
    /** Credit line, e.g. "pokedata.ovh (RK9 team lists)". */
    source: string;
    division: string;
    /** Oldest first — each Pokémon's `history` follows this order. */
    tournaments: MetaTournament[];
    /** The whole regulation (teams, topTeams, pokemon). */
    teams: number;
    topTeams: number;
    pokemon: MetaPokemon[];
    combos?: MetaCombos;
    /** The newest RECENT_EVENTS events only — absent in documents written before it existed. */
    recent?: MetaSlice & { tournamentIds: string[] };
  };
}

/** `meta/{regulationId}/tournaments/{id}` — one event on its own, for the page's tournament chips. */
export interface MetaTournamentDocument extends MetaSlice {
  regulationId: string;
  updatedAt: string;
  tournament: MetaTournament;
}

export interface MetaTournament {
  id: string;
  title: string;
  /** ISO dates. */
  startDate: string;
  endDate: string;
  teams: number;
}

/** "2027 Puebla Pokémon VGC Regional Championships" → "Puebla"; "2026 Pokémon VGC World Championship" → "Worlds". */
export function shortTournamentName(title: string): string {
  if (/World Championship/i.test(title)) return "Worlds";
  return (
    title
      .replace(/^\d{4}\s+/, "")
      .replace(/\s*Pokémon VGC\s*/i, " ")
      .replace(/\s*(Regional|International|Special) Championships?\s*$/i, (match) =>
        /International/i.test(match) ? " IC" : /Special/i.test(match) ? " SPE" : "",
      )
      .trim() || title
  );
}
