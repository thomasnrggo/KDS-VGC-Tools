import { hasRichText } from "./richText";
import { compareOpponentOrder, createOpponent, getPlanForTeam } from "./opponent";
import { buildMatchupRows, sameTeamKey, type MatchupSource } from "./matchupList";
import { formatTeamPaste } from "./formatPokemonPaste";
import type {
  Opponent,
  ParsedPokemon,
  ShareSection,
  SharedMatchup,
  SharedTeam,
  Team,
  TeamShare,
} from "@/types";

/** Every section a share can add, in the Share dialog's order. */
export const SHARE_SECTIONS: ShareSection[] = ["strategy", "calcs", "matchups"];

/**
 * Whether `share` includes `section` (a share made before sections existed
 * has none). Only a closed sheet shares sections: calcs and plans would give
 * away the Stat Points and nature an open sheet hides. The ticked sections
 * stay saved while the sheet is open, so switching back restores them.
 */
export function sharesSection(share: TeamShare | undefined, section: ShareSection): boolean {
  return share?.sheet === "closed" && !!share.sections?.includes(section);
}

/** Drops what an open team sheet doesn't reveal: Stat Points and nature. */
function toOpenSheetPokemon(pokemon: ParsedPokemon): ParsedPokemon {
  const rest = { ...pokemon };
  delete rest.evs;
  delete rest.nature;
  return rest;
}

/**
 * The public copy of a shared team's report (see SharedTeam). The roster,
 * the team's own details and its overview always go out; its notes and
 * combinations only with the "strategy" section, its calcs only with "calcs"
 * (matchups are their own docs — see toSharedMatchup). An open sheet also
 * drops each Pokémon's Stat Points and nature, and the Poképaste link, since
 * the paste would show them anyway.
 */
export function toSharedTeam(
  team: Team,
  share: TeamShare,
  ownerUid: string,
  now: string = new Date().toISOString(),
): SharedTeam {
  const isOpen = share.sheet === "open";
  const sections = SHARE_SECTIONS.filter((section) => sharesSection(share, section));
  const strategy = sections.includes("strategy");
  return {
    id: team.id,
    ownerUid,
    name: team.name,
    creator: team.creator?.trim() || undefined,
    pokepasteUrl: isOpen ? undefined : team.pokepasteUrl?.trim() || undefined,
    replicaCode: team.replicaCode?.trim() || undefined,
    overview: hasRichText(team.overview) ? team.overview : undefined,
    sheet: share.sheet,
    pokemon: isOpen ? team.pokemon.map(toOpenSheetPokemon) : team.pokemon,
    regulationIds: team.regulationIds,
    sections,
    notes: strategy && hasRichText(team.notes) ? team.notes : undefined,
    combinations: strategy && team.combinations?.length ? team.combinations : undefined,
    calcs: sections.includes("calcs") && team.calcs?.length ? team.calcs : undefined,
    updatedAt: now,
  };
}

/** The public copy of one matchup of a shared team: the opponent and the owner's plan for `teamId`. */
export function toSharedMatchup(
  opponent: Opponent,
  teamId: string,
  now: string = new Date().toISOString(),
): SharedMatchup {
  return {
    id: opponent.id,
    label: opponent.label,
    regulationId: opponent.regulationId,
    pokemon: opponent.team.pokemon,
    pokepasteUrl: opponent.pokepasteUrl?.trim() || undefined,
    tags: opponent.tags,
    variantOf: opponent.variantOf,
    sortOrder: opponent.sortOrder,
    plan: getPlanForTeam(opponent, teamId),
    updatedAt: now,
  };
}

/**
 * The opponents a shared team's matchups come from — the same ones its Team
 * Report's Matchups tab lists (see buildMatchupRows): prepped, in the
 * team's regulations, the same team in several lists once.
 */
export function opponentsToShare(
  team: Team,
  lists: { source: MatchupSource; opponents: Opponent[] }[],
): Opponent[] {
  return buildMatchupRows(team, lists).map((row) => row.primary.opponent);
}

/**
 * A shared team as a Team, so the components the owner's report uses can
 * show it — read only (nothing of it is ever saved).
 */
export function sharedTeamAsTeam(shared: SharedTeam): Team {
  return {
    id: shared.id,
    name: shared.name,
    rawPaste: "",
    pokemon: shared.pokemon,
    regulationIds: shared.regulationIds ?? [],
    notes: shared.notes,
    combinations: shared.combinations,
    calcs: shared.calcs,
    overview: shared.overview,
    creator: shared.creator,
    pokepasteUrl: shared.pokepasteUrl,
    replicaCode: shared.replicaCode,
    sortOrder: 0,
    updatedAt: shared.updatedAt,
  };
}

/** A shared matchup as an Opponent whose only plan is for the shared team `teamId` — read only, like sharedTeamAsTeam. */
export function sharedMatchupAsOpponent(matchup: SharedMatchup, teamId: string): Opponent {
  return {
    id: matchup.id,
    label: matchup.label,
    team: {
      id: matchup.id,
      name: matchup.label,
      rawPaste: "",
      pokemon: matchup.pokemon,
      regulationIds: [matchup.regulationId],
      sortOrder: 0,
      updatedAt: matchup.updatedAt,
    },
    pokepasteUrl: matchup.pokepasteUrl,
    regulationId: matchup.regulationId,
    plansByTeamId: { [teamId]: matchup.plan },
    sortOrder: matchup.sortOrder,
    tags: matchup.tags ?? [],
    variantOf: matchup.variantOf,
    createdAt: matchup.updatedAt,
    updatedAt: matchup.updatedAt,
  };
}

/** The link to one matchup of a shared team. */
export function sharedMatchupPath(teamId: string, opponentId: string): string {
  return `${sharedTeamPath(teamId)}/matchups/${opponentId}`;
}

/** The link anyone can open to see a shared team's report. */
export function sharedTeamPath(teamId: string): string {
  return `/shared/${teamId}`;
}

/** The roster in one line, for a shared team's link preview: "Glimmora, Toxapex, … · by Rey". */
export function sharedTeamSummary(team: Pick<SharedTeam, "pokemon" | "creator">): string {
  const roster = team.pokemon.map((mon) => mon.species).join(", ");
  const creator = team.creator?.trim();
  return creator ? `${roster} · by ${creator}` : roster;
}

/**
 * A shared team's matchups as a list, the way its Team Report lists them:
 * the owner's list order, the same team once (a personal and a prep group
 * copy can both be published).
 */
export function sharedMatchupsAsOpponents(matchups: SharedMatchup[], teamId: string): Opponent[] {
  const seen = new Set<string>();
  const opponents = matchups.map((m) => sharedMatchupAsOpponent(m, teamId));
  return opponents.sort(compareOpponentOrder).filter((opponent) => {
    const key = sameTeamKey(opponent);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * "Add everything": a shared team's matchups filed under my copy of it
 * (`teamId`). An opponent I already have (same regulation, Pokémon and
 * items — sameTeamKey) gets the plan unless it already has one for that
 * team; the rest are added as new opponents, variants kept with their main
 * when it's added too. Returns what to add and what to replace.
 */
export function importSharedMatchups({
  matchups,
  teamId,
  myOpponents,
  now = Date.now(),
}: {
  matchups: Opponent[];
  teamId: string;
  myOpponents: Opponent[];
  now?: number;
}): { added: Opponent[]; updated: Opponent[] } {
  const mineByKey = new Map(myOpponents.map((opponent) => [sameTeamKey(opponent), opponent]));
  const added: { source: Opponent; opponent: Opponent }[] = [];
  const updated: Opponent[] = [];
  matchups.forEach((source, index) => {
    const plan = Object.values(source.plansByTeamId)[0];
    const mine = mineByKey.get(sameTeamKey(source));
    if (mine) {
      if (!mine.plansByTeamId[teamId] && plan) {
        updated.push({ ...mine, plansByTeamId: { ...mine.plansByTeamId, [teamId]: plan } });
      }
      return;
    }
    const opponent: Opponent = {
      ...createOpponent(
        source.label,
        formatTeamPaste(source.team.pokemon),
        source.regulationId,
        source.pokepasteUrl,
        // Above everything already in the list, in the shared order.
        now + matchups.length - index,
      ),
      tags: source.tags,
      plansByTeamId: plan ? { [teamId]: plan } : {},
    };
    added.push({ source, opponent });
  });
  // A variant stays one only when its main came along.
  const newIdFor = new Map(added.map(({ source, opponent }) => [source.id, opponent.id]));
  return {
    added: added.map(({ source, opponent }) => {
      const mainId = source.variantOf && newIdFor.get(source.variantOf);
      return mainId ? { ...opponent, variantOf: mainId } : opponent;
    }),
    updated,
  };
}
