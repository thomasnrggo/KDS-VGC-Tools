"use client";

/** The Metagame's overview: the top Pokémon as cards, the top cores, and the top teams. */

import { useState, type CSSProperties, type ReactNode } from "react";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import type { MetaCombo, MetaCombos, MetaPokemon, MetaTeam } from "@/lib/meta/aggregateMeta";
import { speciesLabel } from "@/lib/species/speciesLabel";
import {
  shortTournamentName,
  type MetaFinalist,
  type MetaTournament,
} from "@/lib/meta/metaDocument";
import { IconName } from "@/enums";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import { PokemonSprite } from "../PokemonSprite";
import { TextAction, TogglePill } from "../Button";
import {
  CARD_TREND_DIFFERENCE,
  CORE_SIZES,
  CardTrend,
  CoreSize,
  HIGHLIGHT_SPRITE,
  OVERVIEW_CORES,
  OVERVIEW_POKEMON,
  eventDate,
  formatRecord,
  percent,
  trendTone,
} from "./metaShared";

/** The top 20 Pokémon as cards, then the top pairs, trios and quads — each opens its details. */
export function MetaOverview({
  pokemon,
  combos,
  events,
  query,
  matches,
  trendOf,
  usageLegend,
  trendLegend,
  onOpenFinalist,
  onOpenPokemon,
  onOpenCore,
  onSeeAllCores,
  onSeeAllTeams,
}: {
  pokemon: MetaPokemon[];
  combos: MetaCombos | undefined;
  /** Newest first. */
  events: MetaTournament[];
  /** The search, trimmed — for the empty messages. */
  query: string;
  /** Set while searching: whether a species matches it. */
  matches?: (species: string) => boolean;
  /** Its usage at the event in view against the one before. */
  trendOf: (species: string) => CardTrend | null;
  /** What the cards' percentages cover. */
  usageLegend: string;
  /** What the arrows compare — null when there's no earlier event. */
  trendLegend: string | null;
  onOpenFinalist: (event: MetaTournament, finalist: MetaFinalist) => void;
  onOpenPokemon: (species: string) => void;
  onOpenCore: (core: MetaCombo) => void;
  onSeeAllCores: (size: CoreSize) => void;
  onSeeAllTeams: () => void;
}) {
  const t = useMessages();
  const top = pokemon.slice(0, OVERVIEW_POKEMON);
  // While searching: the matching Pokémon past the top 20, with their real rank.
  const beyondTop = matches
    ? pokemon
        .map((mon, index) => ({ mon, rank: index + 1 }))
        .slice(OVERVIEW_POKEMON)
        .filter(({ mon }) => matches(mon.species))
        .slice(0, OVERVIEW_POKEMON)
    : [];
  // One core size at a time, picked by its tab. While searching, cores keep
  // their rank in the full list but only those with a match show.
  const [size, setSize] = useState<CoreSize>("pairs");
  const cores = (combos?.[size] ?? [])
    .map((combo, index) => ({ combo, rank: index + 1 }))
    .filter(({ combo }) => !matches || combo.species.some(matches))
    .slice(0, OVERVIEW_CORES);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-zinc-900">
            {t.metagame.topPokemon(top.length)}
          </h3>
          <p className="text-sm text-zinc-600">
            {usageLegend}
            {trendLegend && ` · ${trendLegend}`}
          </p>
        </div>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10">
          {top.map((mon, index) => (
            <li key={mon.species}>
              <PokemonCard
                mon={mon}
                rank={index + 1}
                highlight={matches ? matches(mon.species) : undefined}
                trend={trendOf(mon.species)}
                onOpen={onOpenPokemon}
              />
            </li>
          ))}
        </ol>
        {matches && (
          <>
            {beyondTop.length > 0 && (
              <h4 className="pt-2 text-sm font-semibold text-zinc-700">
                {t.metagame.alsoMatching(query)}
              </h4>
            )}
            {beyondTop.length > 0 ? (
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10">
                {beyondTop.map(({ mon, rank }) => (
                  <li key={mon.species}>
                    <PokemonCard
                      mon={mon}
                      rank={rank}
                      trend={trendOf(mon.species)}
                      onOpen={onOpenPokemon}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              !top.some((mon) => matches(mon.species)) && (
                <p className="text-sm text-zinc-500">{t.metagame.noMatches(query)}</p>
              )
            )}
          </>
        )}
      </section>

      <TopTeams
        events={events}
        teams={combos?.teams ?? []}
        query={query}
        matches={matches}
        onOpenFinalist={onOpenFinalist}
        onOpenTeam={onOpenCore}
        onSeeAllTeams={onSeeAllTeams}
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-zinc-900">{t.metagame.commonCores}</h3>
          <p className="text-sm text-zinc-600">{t.metagame.commonCoresHint}</p>
        </div>
        {!combos ? (
          <p className="py-6 text-center text-sm text-zinc-500">{t.metagame.noCombos}</p>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-raised">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
              <div role="group" aria-label={t.metagame.coreSize} className="flex gap-1.5">
                {(["pairs", "trios", "quads"] as const).map((option) => (
                  <TogglePill
                    key={option}
                    active={size === option}
                    onClick={() => setSize(option)}
                    title={t.metagame.coresOf(CORE_SIZES[option])}
                    className="px-3 py-1 text-sm"
                  >
                    {t.metagame[option]}
                  </TogglePill>
                ))}
              </div>
              <TextAction onClick={() => onSeeAllCores(size)}>
                {t.metagame.seeAll}
                <Icon name={IconName.ChevronRight} size={14} />
              </TextAction>
            </div>
            {cores.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">
                {t.metagame.noCoresMatch(query)}
              </p>
            )}
            <ColumnList
              items={cores}
              itemKey={({ combo }) => combo.species.join("|")}
              renderItem={({ combo, rank }) => (
                <ComboRow combo={combo} rank={rank} matches={matches} onOpen={onOpenCore} />
              )}
            />
          </div>
        )}
      </section>
    </div>
  );
}

/** The pills switching the overview's Top teams card. */
export type TopTeamsMode = "winners" | "mostUsed";

/**
 * Teams worth knowing, one card: the winner and runner-up of each event in
 * view (each opens its team sheet), or the most-used full teams (each opens
 * its numbers). While searching, only the teams with a match show.
 */
export function TopTeams({
  events,
  teams,
  query,
  matches,
  onOpenFinalist,
  onOpenTeam,
  onSeeAllTeams,
}: {
  /** Newest first. */
  events: MetaTournament[];
  teams: MetaTeam[];
  query: string;
  matches?: (species: string) => boolean;
  onOpenFinalist: (event: MetaTournament, finalist: MetaFinalist) => void;
  onOpenTeam: (team: MetaTeam) => void;
  onSeeAllTeams: () => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const { appLanguage } = useLanguageSettings();
  const hasFinalists = events.some((event) => event.finalists?.length);
  const [picked, setPicked] = useState<TopTeamsMode>("winners");
  // Documents written before finalists existed have only the most-used teams.
  const mode: TopTeamsMode = hasFinalists ? picked : "mostUsed";
  if (!hasFinalists && teams.length === 0) return null;

  // One row per event: its winner and runner-up side by side (while
  // searching, only those with a match).
  const finalistsByEvent = events
    .map((event) => ({
      event,
      finalists: (event.finalists ?? []).filter(
        (finalist) => !matches || finalist.team.some((mon) => matches(mon.species)),
      ),
    }))
    .filter(({ finalists }) => finalists.length > 0);
  const mostUsed = teams
    .map((team, index) => ({ team, rank: index + 1 }))
    .filter(({ team }) => !matches || team.species.some(matches))
    .slice(0, OVERVIEW_CORES);
  const isEmpty = mode === "winners" ? finalistsByEvent.length === 0 : mostUsed.length === 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-zinc-900">{t.metagame.topTeams}</h3>
        <p className="text-sm text-zinc-600">
          {mode === "winners" ? t.metagame.winningTeamsHint : t.metagame.teamsHint}
        </p>
      </div>
      <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-raised">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
          <div role="group" aria-label={t.metagame.topTeams} className="flex gap-1.5">
            {hasFinalists && (
              <TogglePill
                active={mode === "winners"}
                onClick={() => setPicked("winners")}
                className="px-3 py-1 text-sm"
              >
                {t.metagame.winners}
              </TogglePill>
            )}
            <TogglePill
              active={mode === "mostUsed"}
              onClick={() => setPicked("mostUsed")}
              className="px-3 py-1 text-sm"
            >
              {t.metagame.mostUsed}
            </TogglePill>
          </div>
          {mode === "mostUsed" && (
            <TextAction onClick={onSeeAllTeams}>
              {t.metagame.seeAll}
              <Icon name={IconName.ChevronRight} size={14} />
            </TextAction>
          )}
        </div>
        {isEmpty && (
          <p className="px-3 py-6 text-center text-sm text-zinc-500">
            {mode === "winners" ? t.metagame.noWinnersMatch(query) : t.metagame.noCoresMatch(query)}
          </p>
        )}
        {mode === "winners" ? (
          <ol className="flex flex-col divide-y divide-zinc-200">
            {finalistsByEvent.map(({ event, finalists }) => (
              <li
                key={event.id}
                className="flex flex-col gap-1 px-3 py-2.5 lg:flex-row lg:items-center lg:gap-4"
              >
                <span className="flex shrink-0 items-baseline gap-2 lg:w-28 lg:flex-col lg:gap-0">
                  <span
                    className="truncate text-sm font-semibold text-zinc-900"
                    title={event.title}
                  >
                    {shortTournamentName(event.title)}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {eventDate(event, appLanguage)} · {t.metagame.teamsCount(event.teams)}
                  </span>
                </span>
                <span className="grid min-w-0 flex-1 grid-cols-1 gap-1 lg:grid-cols-2 lg:gap-4">
                  {finalists.map((finalist) => {
                    const name = shortTournamentName(event.title);
                    const placing = t.metagame.finalistPlacing(finalist.placing);
                    return (
                      <button
                        key={finalist.placing}
                        type="button"
                        onClick={() => onOpenFinalist(event, finalist)}
                        aria-label={t.metagame.openDetails(`${placing} · ${name}`)}
                        title={finalist.team.map((mon) => text.species(mon.species)).join(" / ")}
                        className="-mx-1 flex min-w-0 items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-zinc-100"
                      >
                        <span className="flex w-20 shrink-0 flex-col">
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              finalist.placing === 1
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-zinc-700",
                            )}
                          >
                            {placing}
                          </span>
                          <span className="text-xs text-zinc-500 tabular-nums">
                            {formatRecord(finalist.record)}
                          </span>
                        </span>
                        <span className="flex min-w-0 gap-0.5">
                          {finalist.team.map((mon, index) => (
                            <span
                              key={index}
                              className={cn(
                                "relative h-9 w-9 shrink-0 rounded-full sm:h-11 sm:w-11",
                                matches?.(mon.species) && HIGHLIGHT_SPRITE,
                              )}
                            >
                              <PokemonSprite species={mon.species} fill />
                              {mon.item && (
                                <span className="absolute -right-0.5 -bottom-0.5">
                                  <ItemIcon item={mon.item} size={16} />
                                </span>
                              )}
                            </span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <ColumnList
            items={mostUsed}
            itemKey={({ team }) => team.species.join("|")}
            renderItem={({ team, rank }) => (
              <ComboRow combo={team} rank={rank} matches={matches} onOpen={onOpenTeam} />
            )}
          />
        )}
      </div>
    </section>
  );
}

/**
 * A card's list: one column, two on wide screens filled down then across
 * (#1–5, then #6–10). The list's -1px bottom hides the last rows' dividers.
 */
export function ColumnList<T>({
  items,
  itemKey,
  renderItem,
}: {
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const rows = Math.ceil(items.length / 2);
  return (
    <ol
      className="-mb-px grid grid-cols-1 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-(--rows)"
      style={{ "--rows": `repeat(${rows}, auto)` } as CSSProperties}
    >
      {items.map((item, index) => (
        <li
          key={itemKey(item)}
          className={cn("border-b border-zinc-200", index < rows && "lg:border-r")}
        >
          {renderItem(item)}
        </li>
      ))}
    </ol>
  );
}

/** A core or full team in an overview card: rank, sprites and names, usage and team count (and a team's best finish). */
export function ComboRow<C extends MetaCombo>({
  combo,
  rank,
  matches,
  onOpen,
}: {
  combo: C;
  rank: number;
  matches?: (species: string) => boolean;
  onOpen: (combo: C) => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const names = combo.species.map((species) => text.species(species)).join(" / ");
  const best = "best" in combo ? (combo as unknown as MetaTeam).best : undefined;
  return (
    <button
      type="button"
      onClick={() => onOpen(combo)}
      aria-label={t.metagame.openDetails(names)}
      title={names}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-100"
    >
      <span className="w-6 shrink-0 text-xs text-zinc-500 tabular-nums">
        {t.metagame.rank(rank)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex gap-0.5">
          {combo.species.map((species) => (
            <span
              key={species}
              className={cn(
                "relative h-10 w-10 shrink-0 rounded-full",
                matches?.(species) && HIGHLIGHT_SPRITE,
              )}
            >
              <PokemonSprite species={species} fill />
            </span>
          ))}
        </span>
        <span className="truncate text-xs text-zinc-600">
          {best
            ? `${t.metagame.best}: ${t.metagame.bestFinish(
                t.metagame.placing(best.placing),
                shortTournamentName(best.tournament),
              )}`
            : names}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end text-xs text-zinc-500 tabular-nums">
        <span className="text-sm font-semibold text-zinc-900">{percent(combo.usage, 1)}</span>
        {t.metagame.teamsCount(combo.teams)}
      </span>
    </button>
  );
}

/**
 * One of the overview's Pokémon cards: rank, sprite, name, usage. While
 * searching, `highlight` rings the matches and dims the rest (undefined: no
 * search).
 */
export function PokemonCard({
  mon,
  rank,
  highlight,
  trend,
  onOpen,
}: {
  mon: MetaPokemon;
  rank: number;
  highlight?: boolean;
  trend: CardTrend | null;
  onOpen: (species: string) => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const name = speciesLabel(text, mon.species);
  return (
    <button
      type="button"
      onClick={() => onOpen(mon.species)}
      aria-label={t.metagame.openDetails(name)}
      className={cn(
        // Phones: a compact row (sprite beside the name); wider, a tile.
        "relative flex h-full w-full items-center gap-2 rounded-lg border border-zinc-200 bg-raised py-1.5 pr-2 pl-1 text-left transition-[border-color,opacity] hover:border-zinc-400 sm:flex-col sm:gap-1 sm:px-2 sm:pt-5 sm:pb-2.5 sm:text-center",
        highlight === true && "border-chrome-600 ring-1 ring-chrome-600",
        highlight === false && "opacity-40 hover:opacity-100",
      )}
    >
      <span
        className={cn(
          "absolute top-0 left-0 rounded-tl-lg rounded-br-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
          rank <= 3 ? "bg-chrome-600 text-white" : "bg-zinc-100 text-zinc-600",
        )}
      >
        {rank}
      </span>
      {trend && Math.abs(trend.delta) >= CARD_TREND_DIFFERENCE && (
        <span
          title={trend.hint}
          className={cn(
            "absolute top-1 right-1.5 text-[11px] font-semibold tabular-nums",
            trendTone(trend.delta, CARD_TREND_DIFFERENCE),
          )}
        >
          {trend.delta > 0 ? "▲" : "▼"}
          {Math.round(Math.abs(trend.delta) * 100)}
          <span className="sr-only">{trend.hint}</span>
        </span>
      )}
      <span className="relative h-11 w-11 shrink-0 sm:h-16 sm:w-16">
        <PokemonSprite species={mon.species} fill />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:w-full sm:items-center sm:gap-1">
        <span className="w-full truncate text-xs font-medium text-zinc-900 sm:text-sm">{name}</span>
        <span className="text-sm font-semibold text-zinc-900 tabular-nums">
          {percent(mon.usage, 1)}
        </span>
        <span className="h-1 w-full overflow-hidden rounded-full bg-zinc-200">
          <span
            className="block h-full rounded-full bg-chrome-600"
            style={{ width: percent(mon.usage) }}
          />
        </span>
      </span>
    </button>
  );
}
