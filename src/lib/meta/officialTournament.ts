import type { ParsedPokemon } from "@/types";

/**
 * Official tournaments (Regionals, Internationals, Worlds) as published by
 * pokedata.ovh, which mirrors RK9's team lists — see PLANNING.md's "Metagame
 * data". These are the raw shapes of its two files per event; the parser
 * below turns them into anonymous players (placing, record, team, rounds),
 * never keeping a name.
 */

/** One Pokémon on a team sheet: [dex number, form code, nature, tera, ability, species, item, moves]. */
export type PokedataPokemon = [
  string,
  string,
  string | null,
  string | null,
  string | null,
  string,
  string | null,
  string[],
];

/** One player in `RosterData/{id}.json` — every division together. */
export interface PokedataRosterEntry {
  /** Player name — only used to double-check the join, never kept. */
  n: string;
  /** Division: "M" Masters, "S" Seniors, "J" Juniors. */
  d: string;
  /** Final placing in their division, as a string ("1"). */
  "#": string;
  /** The team sheet. */
  tl: PokedataPokemon[];
}

export interface PokedataStandingsPlayer {
  n: string;
  /** [wins, losses, ties], top cut included. */
  s: [number, number, number];
  /** The round they dropped after, or null. */
  d: number | null;
  /** Their id, which round entries refer to. */
  i: number;
  /** Rounds: [opponent id (−1 for a bye), result (3 win, 0 loss, 1 tie), …]. */
  r: [number, number, ...unknown[]][];
  /** Seed in the top cut bracket, or null for a player who didn't make it. */
  top_cut_seed: number | null;
}

/** `standings/{id}_{division}.json` — players in final order. */
export interface PokedataStandings {
  tournament: { title: string; date: string };
  standings: { division: string; players: PokedataStandingsPlayer[] };
}

export type RoundResult = "win" | "loss" | "tie" | "bye";

export interface OfficialPlayer {
  placing: number;
  record: { wins: number; losses: number; ties: number };
  madeTopCut: boolean;
  dropped: boolean;
  team: ParsedPokemon[];
  /** Each round's opponent (by placing — null for a bye) and result. */
  rounds: { opponentPlacing: number | null; result: RoundResult }[];
}

export interface OfficialEvent {
  title: string;
  date: string;
  division: string;
  players: OfficialPlayer[];
}

/** The game's own form names, which carry no "-Form" suffix of their own, in Showdown's spelling. */
const FORM_SPECIES: Record<string, string> = {
  "Floette [Eternal Flower]": "Floette-Eternal",
  "Maushold [Family of Four]": "Maushold-Four",
  "Maushold [Family of Three]": "Maushold",
  // Cosmetic: same stats, types and moves.
  "Sinistcha [Masterpiece Form]": "Sinistcha",
  "Sinistcha [Unremarkable Form]": "Sinistcha",
  "Poltchageist [Artisan Form]": "Poltchageist",
  "Poltchageist [Counterfeit Form]": "Poltchageist",
  "Lycanroc [Midday Form]": "Lycanroc",
  "Lycanroc [Midnight Form]": "Lycanroc-Midnight",
  "Lycanroc [Dusk Form]": "Lycanroc-Dusk",
};

const REGIONAL_SUFFIX: Record<string, string> = {
  Alolan: "Alola",
  Galarian: "Galar",
  Hisuian: "Hisui",
  Paldean: "Paldea",
};

/**
 * The game's species-with-form name ("Basculegion [Female]", "Arcanine
 * [Hisuian Form]", "Tauros [Paldean Form - Blaze Breed]", "Rotom [Wash
 * Rotom]") in Showdown's spelling, which the rest of the app resolves
 * ("Basculegion-F", "Arcanine-Hisui", "Tauros-Paldea-Blaze", "Rotom-Wash").
 * A name without a bracket is returned as is.
 */
export function officialSpeciesName(name: string): string {
  const known = FORM_SPECIES[name];
  if (known) return known;
  const match = /^(.+?) \[(.+)\]$/.exec(name);
  if (!match) return name;
  const [, base, form] = match;
  if (form === "Female") return `${base}-F`;
  if (form === "Male") return base;
  const regional = /^(Alolan|Galarian|Hisuian|Paldean) Form(?: - (\w+) Breed)?$/.exec(form);
  if (regional) {
    const suffix = REGIONAL_SUFFIX[regional[1]];
    return regional[2] ? `${base}-${suffix}-${regional[2]}` : `${base}-${suffix}`;
  }
  // Rotom's appliance forms: "Rotom [Wash Rotom]".
  const rotom = new RegExp(`^(\\w+) ${base}$`).exec(form);
  if (rotom) return `${base}-${rotom[1]}`;
  // Anything else ("[X Form]"): the form's first word, the usual Showdown suffix.
  return `${base}-${form.replace(/ Form$/, "").split(" ")[0]}`;
}

function toParsedPokemon([
  ,
  ,
  nature,
  ,
  ability,
  species,
  item,
  moves,
]: PokedataPokemon): ParsedPokemon {
  return {
    species: officialSpeciesName(species),
    ...(item ? { item } : {}),
    ...(ability ? { ability } : {}),
    ...(nature ? { nature } : {}),
    moves: moves.filter(Boolean),
  };
}

const RESULTS: Record<number, RoundResult> = { 3: "win", 0: "loss", 1: "tie" };

/**
 * One division of an official event: the standings joined to the roster on
 * the roster's `#` (the final placing — names aren't unique), anonymous.
 * Players without a team sheet are left out. Throws if a placing's name
 * doesn't match between the files, rather than pairing the wrong team with
 * a result.
 */
export function parseOfficialEvent(
  roster: PokedataRosterEntry[],
  standings: PokedataStandings,
  divisionCode = "M",
): OfficialEvent {
  const sheetsByPlacing = new Map(
    roster.filter((entry) => entry.d === divisionCode).map((entry) => [Number(entry["#"]), entry]),
  );
  const players = standings.standings.players;
  const placingById = new Map(players.map((player, index) => [player.i, index + 1]));

  const parsed = players.flatMap((player, index): OfficialPlayer[] => {
    const placing = index + 1;
    const sheet = sheetsByPlacing.get(placing);
    if (!sheet || sheet.tl.length === 0) return [];
    if (sheet.n !== player.n) {
      throw new Error(`Placing ${placing}: roster has "${sheet.n}", standings "${player.n}"`);
    }
    const [wins, losses, ties] = player.s;
    return [
      {
        placing,
        record: { wins, losses, ties },
        madeTopCut: player.top_cut_seed !== null,
        dropped: player.d !== null,
        team: sheet.tl.map(toParsedPokemon),
        rounds: player.r.map(([opponent, result]) =>
          opponent === -1
            ? { opponentPlacing: null, result: "bye" as const }
            : {
                opponentPlacing: placingById.get(opponent) ?? null,
                result: RESULTS[result] ?? "loss",
              },
        ),
      },
    ];
  });

  return {
    title: standings.tournament.title,
    date: standings.tournament.date,
    division: standings.standings.division,
    players: parsed,
  };
}
