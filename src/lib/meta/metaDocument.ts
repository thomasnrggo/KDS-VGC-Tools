import type { MetaPokemon } from "./aggregateMeta";

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
    tournaments: MetaTournament[];
    teams: number;
    /** Teams in the top 32 of their event. */
    topTeams: number;
    /** Most-used first. */
    pokemon: MetaPokemon[];
  };
}

export interface MetaTournament {
  id: string;
  title: string;
  /** ISO dates. */
  startDate: string;
  endDate: string;
  teams: number;
}
