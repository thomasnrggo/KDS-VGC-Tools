"use client";

import Link from "next/link";
import { PokemonSprite } from "../PokemonSprite";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { getPlanForTeam, hasMatchupReport } from "@/lib/opponent";
import { groupOpponents } from "@/lib/opponentVariants";
import { calcsAgainst } from "@/lib/teamCalcs";
import type { Opponent, PokemonSlot, Team } from "@/types";

interface TeamMatchupsListProps {
  team: Team;
  /** Every opponent, in Matchup Planner list order. */
  opponents: Opponent[];
}

function PlanSprites({
  team,
  pair,
  mega,
}: {
  team: Team;
  pair: [PokemonSlot, PokemonSlot];
  mega: [boolean, boolean];
}) {
  return (
    <span className="flex gap-0.5">
      {pair.map((slot, index) => {
        const mon = slot === null ? undefined : team.pokemon[slot];
        return (
          <span
            key={index}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-50/70"
          >
            {mon && (
              <PokemonSprite
                species={mon.species}
                // The sprite infers a Mega from the item — only pass it when
                // this slot is planned to Mega Evolve.
                item={mega[index] ? mon.item : undefined}
                size={30}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

function MatchupRow({
  team,
  opponent,
  mainLabel,
  rowClassName,
}: {
  team: Team;
  opponent: Opponent;
  /** Set on a variant: its group's main team label. */
  mainLabel?: string;
  rowClassName: string;
}) {
  const plan = getPlanForTeam(opponent, team.id);
  const planned = [...plan.leadPair, ...plan.backPair].some((slot) => slot !== null);
  const calcCount = calcsAgainst(team.calcs ?? [], opponent.team.pokemon).length;

  return (
    <li className={rowClassName}>
      {/* Plain sprites, not TeamRoster: its hover cards open on click,
          which would fight the row's own click-to-open. */}
      <Link
        href={`/teams/${team.id}/matchups/${opponent.id}`}
        className="flex flex-col gap-2 px-4 py-3 hover:bg-zinc-50/50 md:flex-row md:items-center md:gap-4"
      >
        <div className="flex min-w-0 flex-col gap-1 md:w-64 md:shrink-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-700">
              {opponent.label}
            </span>
            {mainLabel && (
              <span
                title={`Variant of ${mainLabel}`}
                className="shrink-0 rounded-full bg-zinc-300/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600"
              >
                Variant
              </span>
            )}
          </span>
          {opponent.tags.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {opponent.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600"
                >
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>

        <span className="flex flex-wrap gap-1">
          {opponent.team.pokemon.map((mon, index) => (
            <span
              key={`${mon.species}-${index}`}
              className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-50/70"
            >
              <PokemonSprite species={mon.species} item={mon.item} size={38} />
            </span>
          ))}
        </span>

        <span className="flex items-center gap-3 md:ml-auto">
          {planned ? (
            <span className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Lead
              </span>
              <PlanSprites team={team} pair={plan.leadPair} mega={plan.leadMega} />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Back
              </span>
              <PlanSprites team={team} pair={plan.backPair} mega={plan.backMega} />
            </span>
          ) : (
            <span className="text-xs text-zinc-500">No lead/back yet</span>
          )}
          <span className="w-16 shrink-0 text-right text-xs text-zinc-600">
            {calcCount > 0 ? `${calcCount} calc${calcCount === 1 ? "" : "s"}` : ""}
          </span>
          <Icon name={IconName.ExpandMore} size={18} className="-rotate-90 text-zinc-400" />
        </span>
      </Link>
    </li>
  );
}

/**
 * The Team Report's Matchups tab: the opponents in this team's regulations
 * you've written a matchup report for (see hasMatchupReport), in Matchup
 * Planner order — not every opponent you've planned against, since a report
 * is optional extra prep. Each row links to its matchup page (see
 * docs/team-report.md).
 */
export function TeamMatchupsList({ team, opponents }: TeamMatchupsListProps) {
  const groups = groupOpponents(
    opponents.filter((opponent) => team.regulationIds.includes(opponent.regulationId)),
  );
  // Planner order, variants right after their main; a variant can have a
  // report its main doesn't, so each is filtered on its own.
  const rows = groups
    .flatMap((group) => [
      { opponent: group.main, mainLabel: undefined as string | undefined },
      ...group.variants.map((variant) => ({ opponent: variant, mainLabel: group.main.label })),
    ])
    .filter(({ opponent }) => hasMatchupReport(getPlanForTeam(opponent, team.id)));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        No matchup reports yet. To write one, select this team in the{" "}
        <Link href="/matchup-planner" className="text-zinc-600 hover:underline">
          Matchup Planner
        </Link>{" "}
        and pick &ldquo;Matchup report&rdquo; from an opponent&apos;s ⋮ menu. It shows up here
        once it has notes on their Pokémon or on what they do.
      </p>
    );
  }

  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border border-zinc-200">
      {rows.map(({ opponent, mainLabel }, index) => (
        <MatchupRow
          key={opponent.id}
          team={team}
          opponent={opponent}
          mainLabel={mainLabel}
          rowClassName={`${index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100"} ${
            index > 0 ? "border-t border-zinc-300/60" : ""
          }`}
        />
      ))}
    </ul>
  );
}
