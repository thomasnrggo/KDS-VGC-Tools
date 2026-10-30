"use client";

import { useState } from "react";
import movesData from "@/data/moves.json";
import { REGULATIONS } from "@/data/regulations";
import { useMeta } from "@/hooks/useMeta";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { cn } from "@/lib/utils";
import type { MetaPokemon, Share } from "@/lib/meta/aggregateMeta";
import { shortTournamentName, type MetaTournament } from "@/lib/meta/metaDocument";
import type { MoveData } from "@/types/damage";
import { IconName } from "@/enums";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import { LoadingState } from "../LoadingState";
import { PokemonSprite } from "../PokemonSprite";
import { SearchField } from "../SearchField";
import { RegulationSelect, Select } from "../Select";
import { TogglePill } from "../Button";
import { TypeIcon } from "../TypeIcon";

const MOVES = movesData as unknown as Record<string, MoveData>;

function percent(share: number, digits = 0): string {
  return `${(share * 100).toFixed(digits)}%`;
}

/** At least this much more (or less) common in the top 32 than overall gets an arrow. */
const TOP_DIFFERENCE = 0.05;
/** Fewer rounds than this and a win rate is mostly noise — shown faded. */
const MIN_ROUNDS = 100;
/** A change of at least this much at the latest event gets an arrow. */
const TREND_DIFFERENCE = 0.02;

type Scope = "recent" | "all";
type Sort = "usage" | "top" | "winRate" | "rising" | "falling";

/** Usage at the newest event, and at the one before it (null with only one event). */
interface Trend {
  latest: number;
  previous: number | null;
}

/**
 * The Metagame page: what official tournaments are bringing in a
 * regulation, from the metagame job's summary (useMeta). One row per
 * Pokémon — usage, usage in the top 32, win rate — opening to its common
 * sets, items, abilities, moves and teammates.
 */
export function MetagameSection() {
  const t = useMessages();
  const text = usePokemonText();
  const { appLanguage } = useLanguageSettings();
  const [regulationId, setRegulationId] = useState(REGULATIONS[0]?.id ?? "");
  const { meta, isLoading } = useMeta(regulationId);
  const [query, setQuery] = useState("");
  const [openSpecies, setOpenSpecies] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("recent");
  const [sort, setSort] = useState<Sort>("usage");

  const official = meta?.official;
  // The recent slice when the document has one (older documents don't).
  const slice = scope === "recent" && official?.recent ? official.recent : official;
  const tournaments = official?.tournaments ?? [];
  const recentIds = new Set(
    official?.recent?.tournamentIds ?? tournaments.map((event) => event.id),
  );
  // Per-event histories live on the whole regulation's list.
  const historyBySpecies = new Map(
    (official?.pokemon ?? []).map((mon) => [mon.species, mon.history ?? []]),
  );
  function trendOf(species: string): Trend | null {
    const history = historyBySpecies.get(species);
    if (!history?.length) return null;
    return {
      latest: history[history.length - 1].usage,
      previous: history.length > 1 ? history[history.length - 2].usage : null,
    };
  }
  const change = (species: string) => {
    const trend = trendOf(species);
    return trend && trend.previous !== null ? trend.latest - trend.previous : null;
  };

  const ranked = (slice?.pokemon ?? []).map((mon, index) => ({ mon, rank: index + 1 }));
  const folded = foldForSearch(query.trim());
  const matching = folded
    ? ranked.filter(
        ({ mon }) =>
          foldForSearch(mon.species).includes(folded) ||
          foldForSearch(text.species(mon.species)).includes(folded),
      )
    : ranked;
  // Missing values (no previous event, too few rounds) sort last.
  const sortValue = ({ mon }: { mon: MetaPokemon }): number | null =>
    sort === "top"
      ? mon.topUsage
      : sort === "winRate"
        ? mon.rounds >= MIN_ROUNDS
          ? mon.winRate
          : null
        : sort === "rising"
          ? change(mon.species)
          : sort === "falling"
            ? (() => {
                const value = change(mon.species);
                return value === null ? null : -value;
              })()
            : mon.usage;
  const visible =
    sort === "usage"
      ? matching
      : [...matching].sort((a, b) => (sortValue(b) ?? -Infinity) - (sortValue(a) ?? -Infinity));
  const latestEvent = tournaments.at(-1);
  const previousEvent = tournaments.at(-2);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-900">{t.metagame.title}</h2>
        {REGULATIONS.length > 1 && (
          <RegulationSelect
            value={regulationId}
            onChange={(id) => {
              setRegulationId(id);
              setOpenSpecies(null);
            }}
          />
        )}
      </div>

      {isLoading && !official ? (
        <LoadingState />
      ) : !official ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-600">
          {t.metagame.noData}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1 text-sm text-zinc-600">
            <p>
              <span className="font-medium text-zinc-800">
                {t.metagame.basedOn(
                  scope === "recent" && official.recent
                    ? official.recent.tournamentIds.length
                    : tournaments.length,
                  slice!.teams,
                )}
              </span>
              {" · "}
              {t.metagame.updated(
                new Date(meta.updatedAt).toLocaleDateString(appLanguage, {
                  month: "short",
                  day: "numeric",
                }),
              )}
            </p>
            <details className="group text-xs text-zinc-500">
              <summary className="cursor-pointer list-none hover:text-zinc-700">
                {t.metagame.source} <span className="underline">{t.metagame.tournaments}</span>
              </summary>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {[...official.tournaments]
                  .sort((a, b) => b.startDate.localeCompare(a.startDate))
                  .map((tournament) => (
                    <li key={tournament.id}>
                      {tournament.title} · {tournament.teams.toLocaleString(appLanguage)}
                    </li>
                  ))}
              </ul>
            </details>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {official.recent && (
              <div className="flex flex-wrap gap-1.5" title={t.metagame.scopeHint}>
                {(["recent", "all"] as const).map((option) => (
                  <TogglePill
                    key={option}
                    active={scope === option}
                    onClick={() => setScope(option)}
                    className="px-3.5 py-1.5 text-sm"
                  >
                    {option === "recent"
                      ? t.metagame.scopeRecent(official.recent!.tournamentIds.length)
                      : t.metagame.scopeAll}
                  </TogglePill>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <SearchField
                query={query}
                onQueryChange={setQuery}
                placeholder={t.metagame.searchPlaceholder}
                ariaLabel={t.metagame.searchLabel}
                className="min-w-0 flex-1 sm:w-64 sm:flex-none"
              />
              <Select
                value={sort}
                onChange={(value) => setSort(value as Sort)}
                ariaLabel={t.metagame.sortBy}
                className="py-2 text-sm"
                options={[
                  { value: "usage", label: t.metagame.sortUsage },
                  { value: "top", label: t.metagame.sortTop },
                  { value: "winRate", label: t.metagame.sortWinRate },
                  ...(previousEvent
                    ? [
                        { value: "rising", label: t.metagame.sortRising },
                        { value: "falling", label: t.metagame.sortFalling },
                      ]
                    : []),
                ]}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              {t.metagame.noMatches(query.trim())}
            </p>
          ) : (
            <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200">
              <div
                className={cn(
                  ROW_GRID,
                  "bg-zinc-100 py-2 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase",
                )}
              >
                <span className="text-right">#</span>
                <span className="col-span-2">{t.metagame.pokemon}</span>
                <span title={t.metagame.usageHint} className="text-right">
                  {t.metagame.usage}
                </span>
                <span title={t.metagame.topHint} className="hidden text-right sm:block">
                  {t.metagame.top}
                </span>
                <span className="text-right">{t.metagame.latest}</span>
                <span className="text-right">{t.metagame.winRate}</span>
              </div>
              <ul className="flex flex-col divide-y divide-zinc-200">
                {visible.map(({ mon, rank }) => (
                  <MetaRow
                    key={mon.species}
                    mon={mon}
                    rank={rank}
                    maxUsage={ranked[0]?.mon.usage ?? 1}
                    trend={trendOf(mon.species)}
                    latestEvent={latestEvent}
                    previousEvent={previousEvent}
                    history={historyBySpecies.get(mon.species) ?? []}
                    tournaments={tournaments}
                    recentIds={recentIds}
                    isOpen={openSpecies === mon.species}
                    onToggle={() =>
                      setOpenSpecies((current) => (current === mon.species ? null : mon.species))
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Rank · sprite · name · usage · top 32 (from sm) · latest · win rate. */
const ROW_GRID =
  "grid grid-cols-[1.25rem_2.5rem_minmax(0,1fr)_3.5rem_3.75rem_3rem] items-center gap-x-2 px-3 sm:grid-cols-[2rem_3rem_minmax(0,1fr)_8rem_5rem_5rem_5rem] sm:gap-x-3";

function MetaRow({
  mon,
  rank,
  maxUsage,
  trend,
  latestEvent,
  previousEvent,
  history,
  tournaments,
  recentIds,
  isOpen,
  onToggle,
}: {
  mon: MetaPokemon;
  rank: number;
  maxUsage: number;
  trend: Trend | null;
  latestEvent: MetaTournament | undefined;
  previousEvent: MetaTournament | undefined;
  history: MetaPokemon["history"];
  tournaments: MetaTournament[];
  recentIds: Set<string>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const name = text.species(mon.species);
  const difference = mon.topUsage - mon.usage;
  const delta = trend && trend.previous !== null ? trend.latest - trend.previous : null;

  return (
    <li className={cn(isOpen && "bg-zinc-50")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? t.metagame.hideDetails(name) : t.metagame.showDetails(name)}
        className={cn(ROW_GRID, "w-full py-1.5 text-left text-sm hover:bg-zinc-100")}
      >
        <span className="text-right text-xs text-zinc-500 tabular-nums">{rank}</span>
        <span className="relative h-10 w-10 sm:h-12 sm:w-12">
          <PokemonSprite species={mon.species} fill />
        </span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-medium text-zinc-900">{name}</span>
          <Icon
            name={IconName.ExpandMore}
            size={16}
            className={cn("shrink-0 text-zinc-400 transition-transform", isOpen && "rotate-180")}
          />
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="font-semibold text-zinc-900 tabular-nums">{percent(mon.usage, 1)}</span>
          <span className="hidden h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 sm:block">
            <span
              className="block h-full rounded-full bg-chrome-600"
              style={{ width: `${(mon.usage / maxUsage) * 100}%` }}
            />
          </span>
        </span>
        <span
          className={cn(
            "hidden items-center justify-end gap-0.5 tabular-nums sm:flex",
            difference >= TOP_DIFFERENCE
              ? "text-green-700 dark:text-green-300"
              : difference <= -TOP_DIFFERENCE
                ? "text-red-600 dark:text-red-300"
                : "text-zinc-600",
          )}
          title={
            difference >= TOP_DIFFERENCE
              ? t.metagame.moreAtTop
              : difference <= -TOP_DIFFERENCE
                ? t.metagame.lessAtTop
                : undefined
          }
        >
          {percent(mon.topUsage)}
          {Math.abs(difference) >= TOP_DIFFERENCE && (
            <span aria-hidden="true" className="text-[10px]">
              {difference > 0 ? "▲" : "▼"}
            </span>
          )}
        </span>
        <span
          title={
            trend && latestEvent
              ? t.metagame.latestHint(
                  shortTournamentName(latestEvent.title),
                  percent(trend.latest),
                  previousEvent ? shortTournamentName(previousEvent.title) : null,
                  trend.previous !== null ? percent(trend.previous) : null,
                )
              : undefined
          }
          className={cn(
            "flex items-center justify-end gap-0.5 tabular-nums",
            delta !== null && delta >= TREND_DIFFERENCE
              ? "text-green-700 dark:text-green-300"
              : delta !== null && delta <= -TREND_DIFFERENCE
                ? "text-red-600 dark:text-red-300"
                : "text-zinc-600",
          )}
        >
          {trend ? percent(trend.latest) : "—"}
          {delta !== null && Math.abs(delta) >= TREND_DIFFERENCE && (
            <span aria-hidden="true" className="text-[10px]">
              {delta > 0 ? "▲" : "▼"}
              {Math.round(Math.abs(delta) * 100)}
            </span>
          )}
        </span>
        <span
          title={t.metagame.winRateHint(mon.rounds)}
          className={cn(
            "text-right tabular-nums",
            mon.rounds < MIN_ROUNDS
              ? "text-zinc-400"
              : mon.winRate !== null && mon.winRate >= 0.53
                ? "text-green-700 dark:text-green-300"
                : mon.winRate !== null && mon.winRate <= 0.47
                  ? "text-red-600 dark:text-red-300"
                  : "text-zinc-700",
          )}
        >
          {mon.winRate === null ? "—" : percent(mon.winRate)}
        </span>
      </button>
      {isOpen && (
        <MetaDetails mon={mon} history={history} tournaments={tournaments} recentIds={recentIds} />
      )}
    </li>
  );
}

function MetaDetails({
  mon,
  history,
  tournaments,
  recentIds,
}: {
  mon: MetaPokemon;
  history: MetaPokemon["history"];
  tournaments: MetaTournament[];
  recentIds: Set<string>;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const peak = Math.max(...history.map((point) => point.usage), 0.01);

  return (
    <>
      {/* Phones leave the Top 32 column out of the row. */}
      <p className="px-3 pt-1 text-xs text-zinc-600 sm:hidden">
        {t.metagame.top}: <span className="font-medium">{percent(mon.topUsage)}</span>
      </p>
      {history.length > 1 && (
        <div className="flex flex-col gap-2 px-3 pt-2 sm:pl-[5.75rem]">
          <h3 className={DETAIL_TITLE}>{t.metagame.history}</h3>
          <ol className="flex items-end gap-1.5 overflow-x-auto pb-1">
            {history.map((point, index) => {
              const tournament = tournaments[index];
              if (!tournament) return null;
              const isRecent = recentIds.has(tournament.id);
              return (
                <li
                  key={tournament.id}
                  title={`${tournament.title} · ${percent(point.usage, 1)}`}
                  className="flex w-14 shrink-0 flex-col items-center gap-1"
                >
                  <span className="text-[11px] text-zinc-700 tabular-nums">
                    {percent(point.usage)}
                  </span>
                  <span className="flex h-16 w-6 items-end overflow-hidden rounded-t bg-zinc-100">
                    <span
                      className={cn(
                        "block w-full rounded-t",
                        isRecent ? "bg-chrome-600" : "bg-zinc-300",
                      )}
                      style={{ height: `${(point.usage / peak) * 100}%` }}
                    />
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-zinc-500">
                    {shortTournamentName(tournament.title)}
                  </span>
                  <span className="text-[10px] text-zinc-400 tabular-nums">{tournament.teams}</span>
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] text-zinc-400">{t.metagame.historyHint}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 px-3 pt-1 pb-4 sm:pl-[5.75rem] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-2">
          <h3 className={DETAIL_TITLE}>{t.metagame.sets}</h3>
          <ul className="flex flex-col gap-2">
            {mon.sets.slice(0, 3).map((set, index) => (
              <li
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-raised p-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {set.item && (
                    <span className="flex items-center gap-1.5 font-medium text-zinc-900">
                      <ItemIcon item={set.item} size={20} />
                      {text.item(set.item)}
                    </span>
                  )}
                  {set.ability && (
                    <span className="text-zinc-700">{text.ability(set.ability)}</span>
                  )}
                  {set.nature && <span className="text-zinc-500">{text.nature(set.nature)}</span>}
                  <span className="ml-auto text-xs text-zinc-500">
                    {t.metagame.setShare(percent(set.share))}
                  </span>
                </div>
                <ul className="grid grid-cols-2 gap-1.5">
                  {set.moves.map((move) => (
                    <MovePill key={move} move={move} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <ShareList
            title={t.metagame.items}
            shares={mon.items.slice(0, 5)}
            render={(name) => (
              <span className="flex min-w-0 items-center gap-1.5">
                <ItemIcon item={name} size={18} />
                <span className="truncate">{text.item(name)}</span>
              </span>
            )}
          />
          <ShareList
            title={t.metagame.abilities}
            shares={mon.abilities.slice(0, 3)}
            render={(name) => <span className="truncate">{text.ability(name)}</span>}
          />
          <ShareList
            title={t.metagame.moves}
            shares={mon.moves.slice(0, 8)}
            render={(name) => <MoveName move={name} />}
          />
          <ShareList
            title={t.metagame.teammates}
            shares={mon.teammates.slice(0, 6)}
            render={(name) => (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="relative h-7 w-7 shrink-0">
                  <PokemonSprite species={name} fill />
                </span>
                <span className="truncate">{text.species(name)}</span>
              </span>
            )}
          />
        </div>
      </div>
    </>
  );
}

const DETAIL_TITLE = "text-xs font-semibold tracking-wide text-zinc-500 uppercase";

/** A titled list of names with the share of this Pokémon's teams that have each. */
function ShareList({
  title,
  shares,
  render,
}: {
  title: string;
  shares: Share[];
  render: (name: string) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={DETAIL_TITLE}>{title}</h3>
      <ul className="flex flex-col gap-1">
        {shares.map(({ name, share }) => (
          <li key={name} className="flex flex-col gap-0.5 text-sm text-zinc-800">
            <span className="flex items-center justify-between gap-2">
              {render(name)}
              <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{percent(share)}</span>
            </span>
            <span className="h-1 overflow-hidden rounded-full bg-zinc-200">
              <span
                className="block h-full rounded-full bg-zinc-400"
                style={{ width: percent(share) }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoveName({ move }: { move: string }) {
  const text = usePokemonText();
  const type = MOVES[normalizeSpeciesKey(move)]?.type;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {type && (
        <span className="shrink-0 overflow-hidden rounded">
          <TypeIcon type={type} size={16} />
        </span>
      )}
      <span className="truncate">{text.move(move)}</span>
    </span>
  );
}

/** A move as the Pokémon cards show it: a light pill with its type icon. */
function MovePill({ move }: { move: string }) {
  return (
    <li className="flex h-7 min-w-0 items-center rounded bg-zinc-100 px-1.5 text-[13px] text-zinc-800">
      <MoveName move={move} />
    </li>
  );
}
