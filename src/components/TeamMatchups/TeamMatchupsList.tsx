"use client";

import Link from "next/link";
import { EitherTile } from "../PokemonSlotPicker";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { LoadingState } from "../LoadingState";
import { useState } from "react";
import { SearchField } from "../SearchField";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { foldForSearch, parseSearchTerms, pokemonMatchesQuery } from "@/lib/pokemonMatchesQuery";
import { tagsMatchQuery } from "@/lib/opponentTags";
import { getPlanForTeam } from "@/lib/opponent";
import { listPlans, notesToHtml } from "@/lib/matchupPlans";
import { hasRichText } from "@/lib/richText";
import {
  buildMatchupRows,
  type MatchupCopy,
  type MatchupRow as Row,
  type MatchupSource,
} from "@/lib/matchupList";
import { calcsAgainst } from "@/lib/teamCalcs";
import { cn } from "@/lib/utils";
import type { Opponent, ParsedPokemon, PokemonSlot, Team } from "@/types";

interface TeamMatchupsListProps {
  team: Team;
  /** Your opponents and each prep group's, each in Matchup Planner list order. */
  lists: { source: MatchupSource; opponents: Opponent[] }[];
  isLoading: boolean;
}

/** A copy's matchup page — through ?groupId= for a prep group's (your private plan for it). */
function matchupHref(team: Team, copy: MatchupCopy): string {
  const base = `/teams/${team.id}/matchups/${copy.opponent.id}`;
  return copy.source.kind === "group" ? `${base}?groupId=${copy.source.id}` : base;
}

const COLUMN_TITLE_CLASSES =
  "flex h-7 items-center text-xs font-semibold tracking-wide text-zinc-500 uppercase";

// Phones: fills its grid cell (square); md up: the Matchup Planner card's 64px.
const TILE_SIZE = "aspect-square w-full md:aspect-auto md:h-16 md:w-16";

/** A read-only sprite tile, sized like the Matchup Planner card's. */
function Tile({
  species,
  item,
  badge,
  matched,
  alternative,
  any,
}: {
  species?: string;
  item?: string;
  badge?: boolean;
  /** Highlighted while it matches the search, like the Matchup Planner's roster. */
  matched?: boolean;
  /** "A or B": a second Pokémon, stacked under the first. */
  alternative?: { species: string; item?: string };
  /** Empty, but any of the rest fits — shown as "+1". */
  any?: boolean;
}) {
  if (!species) {
    return (
      <span
        className={cn(
          TILE_SIZE,
          "flex shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-400/70 text-sm font-semibold text-zinc-500",
        )}
      >
        {any && "+1"}
      </span>
    );
  }
  if (alternative) {
    return (
      <span className={cn(TILE_SIZE, "shrink-0")}>
        <EitherTile
          first={<PokemonSprite species={species} item={item} fill />}
          second={<PokemonSprite species={alternative.species} item={alternative.item} fill />}
        />
      </span>
    );
  }
  return (
    <span className={cn(TILE_SIZE, "relative shrink-0")}>
      <span
        className={cn(
          "absolute inset-0 overflow-hidden rounded-lg bg-zinc-500/20",
          matched && "ring-2 ring-amber-400",
        )}
      >
        <PokemonSprite species={species} item={item} fill />
      </span>
      {badge && item && (
        <span className="absolute -right-1 -bottom-1">
          <ItemIcon item={item} size={22} />
        </span>
      )}
    </span>
  );
}

function PickPair({
  team,
  label,
  pair,
  mega,
  alternative = null,
  any = false,
}: {
  team: Team;
  label: string;
  pair: [PokemonSlot, PokemonSlot];
  mega: [boolean, boolean];
  /** The second slot's alternative ("A or B"). */
  alternative?: PokemonSlot;
  /** The second slot is open: any of the rest fits. */
  any?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className={COLUMN_TITLE_CLASSES}>{label}</span>
      <span className="flex gap-2">
        {pair.map((slot, index) => {
          const mon = slot === null ? undefined : team.pokemon[slot];
          // The sprite infers a Mega from the item — only pass it when this
          // slot is planned to Mega Evolve.
          const alt = index === 1 && alternative !== null ? team.pokemon[alternative] : undefined;
          return (
            <Tile
              key={index}
              species={mon?.species}
              item={mega[index] ? mon?.item : undefined}
              alternative={alt && { species: alt.species }}
              any={index === 1 && any}
            />
          );
        })}
      </span>
    </div>
  );
}

/** Rich text (the game plan's HTML) as plain lines, for a short preview. */
function plainText(html: string): string {
  return html
    .replace(/<\/(p|li)>|<br\s*\/?>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * One matchup, laid out like a Matchup Planner card: their roster, your
 * Plan A lead/back, and the start of its game plan — read only, the whole
 * row opening the matchup page.
 */
function MatchupRow({
  team,
  row,
  rowClassName,
  isMatch,
}: {
  team: Team;
  row: Row;
  rowClassName: string;
  isMatch?: (mon: ParsedPokemon) => boolean;
}) {
  const t = useMessages();
  const { opponent, mainLabel } = row.primary;
  const sourceLabel = (source: MatchupSource) =>
    source.kind === "mine" ? t.teamMatchups.mine : source.name;
  const plan = getPlanForTeam(opponent, team.id);
  const planCount = listPlans(plan).length;
  const notes = plainText(notesToHtml(plan.notes));
  const calcCount = calcsAgainst(team.calcs ?? [], opponent.team.pokemon).length;
  // "What they do" or a note on one of their Pokémon — prep the plan count doesn't show.
  const hasNotes =
    hasRichText(plan.scoutingNotes) ||
    Object.values(plan.pokemonNotes ?? {}).some((note) => hasRichText(note));
  const notesMarker = hasNotes && (
    <span
      role="img"
      aria-label={t.teamMatchups.hasNotes}
      title={t.teamMatchups.hasNotes}
      className="flex shrink-0 text-zinc-500"
    >
      <Icon name={IconName.Description} size={14} />
    </span>
  );
  const tags = opponent.tags.map((tag) => (
    <span
      key={tag}
      className="shrink-0 rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600"
    >
      {tag}
    </span>
  ));
  const plansChip = planCount > 1 && (
    <span className="rounded-full border border-zinc-300 px-2 py-px text-[11px] font-medium whitespace-nowrap text-zinc-600">
      {t.matchupPage.morePlans(planCount - 1)}
    </span>
  );
  const calcsAndArrow = (
    <span className="flex h-7 items-center gap-1 text-xs whitespace-nowrap text-zinc-500">
      {notesMarker}
      {calcCount > 0 && t.teamMatchups.calcCount(calcCount)}
      <Icon name={IconName.ExpandMore} size={18} className="-rotate-90 text-zinc-400" />
    </span>
  );

  return (
    // The name's link covers the whole row (its ::after).
    <li
      className={cn(
        "relative grid grid-cols-1 hover:brightness-[0.98] md:grid-cols-[auto_auto_minmax(0,1fr)]",
        rowClassName,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 border-zinc-300 px-3 py-3 md:border-r md:p-4">
        <div className="flex h-7 w-0 min-w-full items-center gap-1.5">
          <Link
            href={matchupHref(team, row.primary)}
            title={opponent.label}
            className="min-w-0 truncate text-xs font-semibold tracking-wide text-zinc-600 uppercase after:absolute after:inset-0 hover:text-zinc-900"
          >
            {opponent.label}
          </Link>
          {mainLabel && (
            <span
              title={t.matchupPage.variantOf(mainLabel)}
              className="shrink-0 rounded-full bg-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 uppercase"
            >
              {t.opponentCard.variant}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-zinc-500">
            · {sourceLabel(row.primary.source)}
          </span>
          <Icon
            name={IconName.ExpandMore}
            size={18}
            className="ml-auto shrink-0 -rotate-90 text-zinc-400 md:hidden"
          />
        </div>
        <div className="grid grid-cols-6 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {opponent.team.pokemon.map((mon, index) => (
            <Tile
              key={`${mon.species}-${index}`}
              species={mon.species}
              item={mon.item}
              badge
              matched={isMatch?.(mon)}
            />
          ))}
        </div>
        {/* Phones: a summary instead of the picks and game plan — how much
            prep there is, and the tags (one line; ones that don't fit are cut off). */}
        <div className="flex min-w-0 items-center gap-3 md:hidden">
          <span className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-zinc-600">
            {t.teamMatchups.planCount(planCount)}
            {calcCount > 0 && <> · {t.teamMatchups.calcCount(calcCount)}</>}
            {notesMarker}
          </span>
          {tags.length > 0 && (
            <span className="flex min-w-0 flex-1 justify-end gap-1 overflow-hidden">{tags}</span>
          )}
        </div>
      </div>

      <div className="hidden gap-2 border-r border-zinc-300 p-4 md:flex md:flex-col lg:flex-row lg:gap-4">
        <PickPair
          team={team}
          label={t.opponentCard.lead}
          pair={plan.leadPair}
          mega={plan.leadMega}
        />
        <PickPair
          team={team}
          label={t.opponentCard.back}
          pair={plan.backPair}
          mega={plan.backMega}
          alternative={plan.backAlt ?? null}
          any={[...plan.leadPair, plan.backPair[0]].every((slot) => slot !== null)}
        />
      </div>

      <div className="hidden min-w-0 flex-col gap-2 p-4 md:flex">
        <div className="flex min-h-7 items-start gap-2">
          <span className={cn(COLUMN_TITLE_CLASSES, "shrink-0 whitespace-nowrap")}>
            {t.opponentCard.gamePlan}
          </span>
          {plansChip && <span className="mt-1">{plansChip}</span>}
          <span className="ml-auto flex min-h-7 min-w-0 items-center gap-2">
            {tags.length > 0 && (
              <span className="flex min-w-0 flex-wrap justify-end gap-1">{tags}</span>
            )}
            {calcsAndArrow}
          </span>
        </div>
        {notes ? (
          <p className="line-clamp-3 text-sm whitespace-pre-line text-zinc-800">{notes}</p>
        ) : (
          <p className="text-sm text-zinc-400">{t.teamMatchups.noGamePlan}</p>
        )}
      </div>
    </li>
  );
}

/**
 * The Team Report's Matchups tab: every opponent in this team's regulations
 * you've prepped — from your list and every prep group (see buildMatchupRows),
 * the same team in several lists shown once. Each row links to its matchup
 * page (see docs/team-report.md).
 */
export function TeamMatchupsList({ team, lists, isLoading }: TeamMatchupsListProps) {
  const t = useMessages();
  const pokemonText = usePokemonText();
  const [query, setQuery] = useState("");
  if (isLoading) return <LoadingState />;
  const rows = buildMatchupRows(team, lists);

  // Like the Matchup Planner's search — every term must match one of the
  // team's Pokémon/items or tags — and the team's name as well.
  const terms = parseSearchTerms(query);
  const isSearching = terms.length > 0;
  const shownRows = rows.filter(({ primary: { opponent } }) =>
    terms.every(
      (term) =>
        foldForSearch(opponent.label).includes(term) ||
        opponent.team.pokemon.some((mon) => pokemonMatchesQuery(mon, term, pokemonText)) ||
        tagsMatchQuery(opponent.tags, term),
    ),
  );
  const isMatch = isSearching
    ? (mon: ParsedPokemon) => terms.some((term) => pokemonMatchesQuery(mon, term, pokemonText))
    : undefined;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        {t.teamMatchups.emptyBefore}
        <Link href="/matchup-planner" className="text-zinc-600 hover:underline">
          {t.nav.matchupPlanner}
        </Link>
        {t.teamMatchups.emptyAfter}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchField
        query={query}
        onQueryChange={setQuery}
        placeholder={t.teamMatchups.searchPlaceholder}
        ariaLabel={t.teamMatchups.searchLabel}
      />
      {shownRows.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          {t.teamMatchups.noMatches(query.trim())}
        </p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-lg">
          {shownRows.map((row, index) => (
            <MatchupRow
              key={row.primary.opponent.id}
              team={team}
              row={row}
              isMatch={isMatch}
              rowClassName={cn(index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
