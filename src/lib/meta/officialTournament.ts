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
  /** Player name — only used for the join, never kept. */
  n: string;
  /** Country code — part of the join. */
  c?: string | null;
  /** Division: "M" Masters, "S" Seniors, "J" Juniors. */
  d: string;
  /** A placing — but not always today's final one (standings get re-sorted), so it only breaks ties between players with the same name. */
  "#": string;
  /** The team sheet. */
  tl: PokedataPokemon[];
}

export interface PokedataStandingsPlayer {
  n: string;
  c?: string | null;
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
  /** How the join went — counts only, so a bad file can be spotted without keeping names. */
  join: {
    /** Team sheets in this division. */
    sheets: number;
    /** Players in the standings. */
    standings: number;
    /** Standings players matched to a sheet. */
    matched: number;
  };
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

function joinKey(name: string, country: string | null | undefined): string {
  return `${name.trim().toLowerCase()}|${country ?? ""}`;
}

/**
 * One division of an official event: the standings joined to the roster by
 * name and country (name alone if one file lacks the country), anonymous. The roster's `#` isn't reliably the final
 * placing (pokedata re-sorts standings), so it only decides between players
 * who share a name — the one whose `#` is nearest. Players without a team
 * sheet are left out; `join` reports how many matched.
 */
export function parseOfficialEvent(
  roster: PokedataRosterEntry[],
  standings: PokedataStandings,
  divisionCode = "M",
): OfficialEvent {
  const sheets = roster.filter((entry) => entry.d === divisionCode && entry.tl?.length > 0);
  // By name and country, and by name alone for when one file lacks the country.
  const sheetsByKey = new Map<string, PokedataRosterEntry[]>();
  const sheetsByName = new Map<string, PokedataRosterEntry[]>();
  for (const sheet of sheets) {
    for (const [map, key] of [
      [sheetsByKey, joinKey(sheet.n, sheet.c)],
      [sheetsByName, joinKey(sheet.n, null)],
    ] as const) {
      map.set(key, [...(map.get(key) ?? []), sheet]);
    }
  }
  const used = new Set<PokedataRosterEntry>();
  const players = standings.standings.players;
  const placingById = new Map(players.map((player, index) => [player.i, index + 1]));

  const parsed = players.flatMap((player, index): OfficialPlayer[] => {
    const placing = index + 1;
    const unused = (list: PokedataRosterEntry[] | undefined) =>
      (list ?? []).filter((sheet) => !used.has(sheet));
    let candidates = unused(sheetsByKey.get(joinKey(player.n, player.c)));
    if (candidates.length === 0) candidates = unused(sheetsByName.get(joinKey(player.n, null)));
    if (candidates.length === 0) return [];
    // Several with the same name: the one whose # is nearest this placing.
    const sheet = candidates.reduce((best, candidate) =>
      Math.abs(Number(candidate["#"]) - placing) < Math.abs(Number(best["#"]) - placing)
        ? candidate
        : best,
    );
    used.add(sheet);
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
    join: { sheets: sheets.length, standings: players.length, matched: parsed.length },
  };
}
