import { getPlanForTeam } from "./opponent";
import { groupOpponents } from "./opponentVariants";
import { hasMatchupPrep } from "./matchupPlans";
import { normalizeSpeciesKey } from "./species/normalize";
import type { Opponent, Team } from "@/types";

/** Where an opponent lives: your own list, or a prep group's. */
export type MatchupSource = { kind: "mine" } | { kind: "group"; id: string; name: string };

export interface MatchupCopy {
  opponent: Opponent;
  source: MatchupSource;
  /** Set on a variant: its main's label. */
  mainLabel?: string;
  hasPrep: boolean;
}

export interface MatchupRow {
  /** The copy the row opens — the first one with prep (yours before a group's). */
  primary: MatchupCopy;
  /** Every list the same team is in, primary first — more than one when it was copied between lists. */
  copies: MatchupCopy[];
}

/**
 * Identifies a team regardless of which list it's in: the regulation plus
 * each Pokémon's species and item, in any order. A team copied into a prep
 * group (or back to your list) gets a new id but keeps these.
 */
export function sameTeamKey(opponent: Opponent): string {
  const mons = opponent.team.pokemon
    .map((mon) => `${normalizeSpeciesKey(mon.species)}@${normalizeSpeciesKey(mon.item ?? "")}`)
    .sort();
  return `${opponent.regulationId}|${mons.join(",")}`;
}

/**
 * The Team Report's Matchups tab: every opponent in the team's regulations
 * you've prepped (see hasMatchupPrep), from your list and every prep group,
 * in list order (variants after their main). The same team in several
 * lists is one row, opening the copy you prepped — the others stay
 * reachable from the row.
 */
export function buildMatchupRows(
  team: Team,
  lists: { source: MatchupSource; opponents: Opponent[] }[],
): MatchupRow[] {
  const rows = new Map<string, MatchupRow>();
  for (const { source, opponents } of lists) {
    const inRegulation = opponents.filter((o) => team.regulationIds.includes(o.regulationId));
    for (const group of groupOpponents(inRegulation)) {
      const entries = [
        { opponent: group.main, mainLabel: undefined },
        ...group.variants.map((variant) => ({ opponent: variant, mainLabel: group.main.label })),
      ];
      for (const { opponent, mainLabel } of entries) {
        const copy: MatchupCopy = {
          opponent,
          source,
          mainLabel,
          hasPrep: hasMatchupPrep(getPlanForTeam(opponent, team.id)),
        };
        const key = sameTeamKey(opponent);
        const row = rows.get(key);
        if (!row) rows.set(key, { primary: copy, copies: [copy] });
        else {
          row.copies.push(copy);
          if (!row.primary.hasPrep && copy.hasPrep) row.primary = copy;
        }
      }
    }
  }
  return [...rows.values()]
    .filter((row) => row.primary.hasPrep)
    .map((row) => ({
      ...row,
      copies: [row.primary, ...row.copies.filter((copy) => copy !== row.primary)],
    }));
}
