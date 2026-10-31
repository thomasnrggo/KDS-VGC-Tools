"use client";

import { useState } from "react";
import movesData from "@/data/moves.json";
import { REGULATIONS } from "@/data/regulations";
import { useMeta, useMetaTournament } from "@/hooks/useMeta";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { cn } from "@/lib/utils";
import type { MetaCombo, MetaCombos, MetaPokemon, MetaTeam, Share } from "@/lib/meta/aggregateMeta";
import { megaDisplayName, speciesNamesMegaForm, stripMegaSuffix } from "@/lib/species/megaForm";
import type { PokemonText } from "@/lib/i18n/pokemonNames";
import { shortTournamentName, type MetaTournament } from "@/lib/meta/metaDocument";
import type { MoveData } from "@/types/damage";
import { IconName } from "@/enums";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import { LoadingState } from "../LoadingState";
import { PokemonSprite } from "../PokemonSprite";
import { SearchField } from "../SearchField";
import { Modal, ModalTitle } from "../Modal";
import { RegulationSelect, Select } from "../Select";
import { IconButton, TextAction, TogglePill } from "../Button";
import { TypeIcon } from "../TypeIcon";

const MOVES = movesData as unknown as Record<string, MoveData>;

/**
 * A species as the page shows it: "Mega Charizard Y" for a Mega form (the
 * Pokémon-name language's own when it has one), the translated name otherwise.
 */
function speciesLabel(text: PokemonText, species: string): string {
  const translated = text.species(species);
  if (!speciesNamesMegaForm(species) || translated !== species) return translated;
  return megaDisplayName(species) ?? species;
}

function percent(share: number, digits = 0): string {
  return `${(share * 100).toFixed(digits)}%`;
}

/** At least this much more (or less) common in the top 32 than overall gets an arrow. */
const TOP_DIFFERENCE = 0.05;
/** Fewer rounds than this and a win rate is mostly noise — shown faded. */
const MIN_ROUNDS = 100;
/** How many Pokémon, and how many of each core size, the overview shows. */
const OVERVIEW_POKEMON = 20;
const OVERVIEW_CORES = 5;
const CORE_SIZES = { pairs: 2, trios: 3, quads: 4 } as const;
/** A change of at least this much at the latest event gets an arrow. */
const TREND_DIFFERENCE = 0.02;

/** The newest events, the whole regulation, or one tournament (its id). */
type Scope = "recent" | "all" | (string & {});
type Tab = "overview" | "pokemon" | "megas" | "cores" | "teams";
type Sort = "usage" | "top" | "winRate" | "rising" | "falling";
type CoreSize = "pairs" | "trios" | "quads";

/** Usage at the newest event, and at the one before it (null with only one event). */
interface Trend {
  latest: number;
  previous: number | null;
}

const TAB_CLASS = (active: boolean) =>
  cn(
    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
    active ? "bg-chrome-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
  );

/**
 * The Metagame page: what official tournaments are bringing in a
 * regulation, from the metagame job's summaries (useMeta, and
 * useMetaTournament for one event). Which events — the newest few, the whole
 * regulation, or one tournament — then five views: an overview (the top 20
 * and the top cores, each opening its details), every Pokémon (a Mega apart
 * from its species), only the Megas, cores (pairs, trios, quads) and full
 * teams.
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
  const [tab, setTab] = useState<Tab>("overview");
  const [sort, setSort] = useState<Sort>("usage");
  const [coreSize, setCoreSize] = useState<CoreSize>("pairs");
  // The overview's detail dialogs: a Pokémon (its species) or a core.
  const [detailSpecies, setDetailSpecies] = useState<string | null>(null);
  const [detailCore, setDetailCore] = useState<MetaCombo | null>(null);

  const official = meta?.official;
  const tournaments = official?.tournaments ?? [];
  const tournamentScope = tournaments.find((event) => event.id === scope) ?? null;
  const { tournamentMeta, isLoading: isTournamentLoading } = useMetaTournament(
    regulationId,
    tournamentScope?.id ?? null,
  );
  // The recent slice when the document has one (older documents don't).
  const slice = tournamentScope
    ? tournamentMeta
    : scope === "recent" && official?.recent
      ? official.recent
      : official;
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

  const ranked = (slice?.pokemon ?? [])
    .filter((mon) => tab !== "megas" || speciesNamesMegaForm(mon.species))
    .map((mon, index) => ({ mon, rank: index + 1 }));
  const folded = foldForSearch(query.trim());
  const matchesQuery = (species: string) =>
    !folded ||
    foldForSearch(species).includes(folded) ||
    foldForSearch(speciesLabel(text, species)).includes(folded);
  const matching = ranked.filter(({ mon }) => matchesQuery(mon.species));
  // Missing values (no previous event, too few rounds) sort last.
  const sortValue = ({ mon }: { mon: MetaPokemon }): number | null => {
    if (sort === "top") return mon.topUsage;
    if (sort === "winRate") return mon.rounds >= MIN_ROUNDS ? mon.winRate : null;
    const delta = change(mon.species);
    if (sort === "rising") return delta;
    if (sort === "falling") return delta === null ? null : -delta;
    return mon.usage;
  };
  const visible =
    sort === "usage"
      ? matching
      : [...matching].sort((a, b) => (sortValue(b) ?? -Infinity) - (sortValue(a) ?? -Infinity));
  const latestEvent = tournaments.at(-1);
  const previousEvent = tournaments.at(-2);
  const combos = slice?.combos;
  const eventCount = tournamentScope
    ? 1
    : scope === "recent" && official?.recent
      ? official.recent.tournamentIds.length
      : tournaments.length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-900">{t.metagame.title}</h2>
        {REGULATIONS.length > 1 && (
          <RegulationSelect
            value={regulationId}
            onChange={(id) => {
              setRegulationId(id);
              setScope("recent");
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
          {/* Which events: the newest few, the whole regulation, or one tournament. */}
          <div
            role="group"
            aria-label={t.metagame.scopeLabel}
            title={t.metagame.scopeHint}
            className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {official.recent && (
              <TogglePill
                active={scope === "recent"}
                onClick={() => setScope("recent")}
                className="shrink-0 px-3.5 py-1.5 text-sm"
              >
                {t.metagame.scopeRecent(official.recent.tournamentIds.length)}
              </TogglePill>
            )}
            <TogglePill
              active={scope === "all" || (scope === "recent" && !official.recent)}
              onClick={() => setScope("all")}
              className="shrink-0 px-3.5 py-1.5 text-sm"
            >
              {t.metagame.scopeAll}
            </TogglePill>
            <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-zinc-300" />
            {[...tournaments].reverse().map((tournament) => (
              <TogglePill
                key={tournament.id}
                active={scope === tournament.id}
                onClick={() => setScope(tournament.id)}
                title={`${tournament.title} · ${tournament.teams.toLocaleString(appLanguage)}`}
                className="shrink-0 px-3 py-1.5 text-sm"
              >
                {shortTournamentName(tournament.title)}
              </TogglePill>
            ))}
          </div>

          <div className="flex flex-col gap-1 text-sm text-zinc-600">
            <p>
              <span className="font-medium text-zinc-800">
                {tournamentScope
                  ? tournamentScope.title
                  : t.metagame.basedOn(eventCount, slice?.teams ?? official.teams)}
              </span>
              {tournamentScope && ` · ${t.metagame.teamsCount(tournamentScope.teams)}`}
              {" · "}
              {t.metagame.updated(
                new Date(meta.updatedAt).toLocaleDateString(appLanguage, {
                  month: "short",
                  day: "numeric",
                }),
              )}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div role="tablist" aria-label={t.metagame.view} className="flex flex-wrap gap-1.5">
              {(["overview", "pokemon", "megas", "cores", "teams"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={tab === option}
                  onClick={() => {
                    setTab(option);
                    setOpenSpecies(null);
                  }}
                  className={TAB_CLASS(tab === option)}
                >
                  {
                    {
                      overview: t.metagame.tabOverview,
                      pokemon: t.metagame.tabPokemon,
                      megas: t.metagame.tabMegas,
                      cores: t.metagame.tabCores,
                      teams: t.metagame.tabTeams,
                    }[option]
                  }
                </button>
              ))}
            </div>
            <div
              className={cn("flex flex-wrap items-center gap-2", tab === "overview" && "hidden")}
            >
              <SearchField
                query={query}
                onQueryChange={setQuery}
                placeholder={t.metagame.searchPlaceholder}
                ariaLabel={t.metagame.searchLabel}
                className="min-w-0 flex-1 md:w-56 md:flex-none"
              />
              {(tab === "pokemon" || tab === "megas") && (
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
              )}
              {tab === "cores" && (
                <div role="group" aria-label={t.metagame.coreSize} className="flex gap-1.5">
                  {(["pairs", "trios", "quads"] as const).map((size) => (
                    <TogglePill
                      key={size}
                      active={coreSize === size}
                      onClick={() => setCoreSize(size)}
                      className="px-3 py-1.5 text-sm"
                    >
                      {t.metagame[size]}
                    </TogglePill>
                  ))}
                </div>
              )}
            </div>
          </div>

          {tournamentScope && !tournamentMeta ? (
            isTournamentLoading ? (
              <LoadingState />
            ) : (
              <p className="py-10 text-center text-sm text-zinc-500">{t.metagame.noTournament}</p>
            )
          ) : tab === "overview" ? (
            <MetaOverview
              pokemon={slice?.pokemon ?? []}
              combos={combos}
              onOpenPokemon={setDetailSpecies}
              onOpenCore={setDetailCore}
              onSeeAllCores={(size) => {
                setTab("cores");
                setCoreSize(size);
              }}
            />
          ) : tab === "cores" || tab === "teams" ? (
            !combos ? (
              <p className="py-10 text-center text-sm text-zinc-500">{t.metagame.noCombos}</p>
            ) : (
              <ComboList
                combos={
                  tab === "teams"
                    ? combos.teams
                    : coreSize === "pairs"
                      ? combos.pairs
                      : coreSize === "trios"
                        ? combos.trios
                        : combos.quads
                }
                hint={tab === "teams" ? t.metagame.teamsHint : t.metagame.coresHint}
                isTeams={tab === "teams"}
                matches={(combo) => combo.species.some(matchesQuery)}
                emptyLabel={t.metagame.noMatches(query.trim())}
              />
            )
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              {t.metagame.noMatches(query.trim())}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {tab === "megas" && <p className="text-xs text-zinc-500">{t.metagame.megasHint}</p>}
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
            </div>
          )}

          {detailSpecies &&
            (() => {
              const index = (slice?.pokemon ?? []).findIndex(
                (mon) => mon.species === detailSpecies,
              );
              if (index < 0) return null;
              return (
                <PokemonDetailModal
                  mon={slice!.pokemon[index]}
                  rank={index + 1}
                  trend={trendOf(detailSpecies)}
                  history={historyBySpecies.get(detailSpecies) ?? []}
                  tournaments={tournaments}
                  recentIds={recentIds}
                  onClose={() => setDetailSpecies(null)}
                />
              );
            })()}
          {detailCore && (
            <CoreDetailModal
              core={detailCore}
              pokemon={slice?.pokemon ?? []}
              onOpenPokemon={(species) => {
                setDetailCore(null);
                setDetailSpecies(species);
              }}
              onClose={() => setDetailCore(null)}
            />
          )}
        </>
      )}
    </section>
  );
}

/** The top 20 Pokémon as cards, then the top pairs, trios and quads — each opens its details. */
function MetaOverview({
  pokemon,
  combos,
  onOpenPokemon,
  onOpenCore,
  onSeeAllCores,
}: {
  pokemon: MetaPokemon[];
  combos: MetaCombos | undefined;
  onOpenPokemon: (species: string) => void;
  onOpenCore: (core: MetaCombo) => void;
  onSeeAllCores: (size: CoreSize) => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const top = pokemon.slice(0, OVERVIEW_POKEMON);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-zinc-900">{t.metagame.topPokemon(top.length)}</h3>
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10">
          {top.map((mon, index) => {
            const name = speciesLabel(text, mon.species);
            return (
              <li key={mon.species}>
                <button
                  type="button"
                  onClick={() => onOpenPokemon(mon.species)}
                  aria-label={t.metagame.openDetails(name)}
                  className="relative flex h-full w-full flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-raised px-2 pt-5 pb-2.5 text-center transition-colors hover:border-zinc-400"
                >
                  <span
                    className={cn(
                      "absolute top-0 left-0 rounded-tl-lg rounded-br-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                      index < 3 ? "bg-chrome-600 text-white" : "bg-zinc-100 text-zinc-600",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="relative h-14 w-14">
                    <PokemonSprite species={mon.species} fill />
                  </span>
                  <span className="w-full truncate text-xs font-medium text-zinc-900 sm:text-sm">
                    {name}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                    {percent(mon.usage, 1)}
                  </span>
                  <span className="h-1 w-full overflow-hidden rounded-full bg-zinc-200">
                    <span
                      className="block h-full rounded-full bg-chrome-600"
                      style={{ width: percent(mon.usage) }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-zinc-900">{t.metagame.commonCores}</h3>
          <p className="text-sm text-zinc-600">{t.metagame.commonCoresHint}</p>
        </div>
        {!combos ? (
          <p className="py-6 text-center text-sm text-zinc-500">{t.metagame.noCombos}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {(["pairs", "trios", "quads"] as const).map((size) => (
              <div
                key={size}
                className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-raised"
              >
                <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5">
                  <h4 className="text-sm font-semibold text-zinc-900">
                    {t.metagame.coresOf(CORE_SIZES[size])}
                  </h4>
                  <TextAction onClick={() => onSeeAllCores(size)}>
                    {t.metagame.seeAll}
                    <Icon name={IconName.ChevronRight} size={14} />
                  </TextAction>
                </div>
                <ol className="flex flex-col divide-y divide-zinc-200">
                  {combos[size].slice(0, OVERVIEW_CORES).map((combo, index) => {
                    const names = combo.species.map((species) => text.species(species)).join(" / ");
                    return (
                      <li key={combo.species.join("|")}>
                        <button
                          type="button"
                          onClick={() => onOpenCore(combo)}
                          aria-label={t.metagame.openDetails(names)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-100"
                        >
                          <span className="w-6 shrink-0 text-xs text-zinc-500 tabular-nums">
                            {t.metagame.rank(index + 1)}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex gap-0.5">
                              {combo.species.map((species) => (
                                <span key={species} className="relative h-10 w-10 shrink-0">
                                  <PokemonSprite species={species} fill />
                                </span>
                              ))}
                            </span>
                            <span className="truncate text-xs text-zinc-600">{names}</span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end text-xs text-zinc-500 tabular-nums">
                            <span className="text-sm font-semibold text-zinc-900">
                              {percent(combo.usage, 1)}
                            </span>
                            {t.metagame.teamsCount(combo.teams)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** A dialog's header: sprites, a title, the close button. */
function DetailHeader({
  id,
  species,
  title,
  subtitle,
  onClose,
}: {
  id: string;
  species: string[];
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  const t = useMessages();
  return (
    <div className="flex shrink-0 items-center gap-3 pb-3">
      <span className="flex shrink-0 gap-0.5">
        {species.map((name) => (
          <span
            key={name}
            className={cn("relative", species.length > 1 ? "h-10 w-10" : "h-14 w-14")}
          >
            <PokemonSprite species={name} fill />
          </span>
        ))}
      </span>
      <div className="min-w-0 flex-1">
        <ModalTitle id={id} className="mb-0 truncate">
          {title}
        </ModalTitle>
        <p className="text-sm text-zinc-500">{subtitle}</p>
      </div>
      <IconButton
        variant="round"
        onClick={onClose}
        aria-label={t.common.close}
        className="h-9 w-9 self-start"
      >
        <Icon name={IconName.Close} size={18} />
      </IconButton>
    </div>
  );
}

/** One figure in a dialog's row of stats. */
function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div title={hint} className="flex flex-col gap-0.5 rounded-lg bg-zinc-100 px-3 py-2">
      <span className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
        {label}
      </span>
      <span className={cn("text-base font-semibold text-zinc-900 tabular-nums", className)}>
        {value}
      </span>
    </div>
  );
}

const STATS_GRID = "grid shrink-0 grid-cols-2 gap-2 pb-4 sm:grid-cols-4";

/** Everything about one Pokémon: its numbers, history, sets, items, moves and teammates. */
function PokemonDetailModal({
  mon,
  rank,
  trend,
  history,
  tournaments,
  recentIds,
  onClose,
}: {
  mon: MetaPokemon;
  rank: number;
  trend: Trend | null;
  history: MetaPokemon["history"];
  tournaments: MetaTournament[];
  recentIds: Set<string>;
  onClose: () => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const delta = trend && trend.previous !== null ? trend.latest - trend.previous : null;

  return (
    <Modal onClose={onClose} labelledBy="meta-pokemon-title" size="wide" fullScreenOnPhone>
      <DetailHeader
        id="meta-pokemon-title"
        species={[mon.species]}
        title={speciesLabel(text, mon.species)}
        subtitle={`${t.metagame.rank(rank)} · ${t.metagame.teamsCount(mon.teams)}`}
        onClose={onClose}
      />
      <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 sm:mx-0 sm:px-0">
        <div className={STATS_GRID}>
          <Stat
            label={t.metagame.usage}
            value={percent(mon.usage, 1)}
            hint={t.metagame.usageHint}
          />
          <Stat label={t.metagame.top} value={percent(mon.topUsage)} hint={t.metagame.topHint} />
          <Stat
            label={t.metagame.latest}
            value={
              trend ? (
                <>
                  {percent(trend.latest)}
                  {delta !== null && Math.abs(delta) >= TREND_DIFFERENCE && (
                    <span className="ml-1 text-xs">
                      {delta > 0 ? "▲" : "▼"}
                      {Math.round(Math.abs(delta) * 100)}
                    </span>
                  )}
                </>
              ) : (
                "—"
              )
            }
            className={trendTone(delta)}
          />
          <Stat
            label={t.metagame.winRate}
            value={mon.winRate === null ? "—" : percent(mon.winRate)}
            hint={t.metagame.winRateHint(mon.rounds)}
            className={winRateTone(mon.winRate, mon.rounds)}
          />
        </div>
        <MetaDetails
          mon={mon}
          history={history}
          tournaments={tournaments}
          recentIds={recentIds}
          inset={false}
        />
      </div>
    </Modal>
  );
}

/** A core's numbers and its Pokémon — each opens its own details. */
function CoreDetailModal({
  core,
  pokemon,
  onOpenPokemon,
  onClose,
}: {
  core: MetaCombo;
  pokemon: MetaPokemon[];
  onOpenPokemon: (species: string) => void;
  onClose: () => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  // Cores count plain species; the list keeps Megas apart, so a member opens
  // its most-used form (Raichu → Mega Raichu Y when nearly every one is).
  const formOf = (species: string) =>
    pokemon.find((mon) => stripMegaSuffix(mon.species) === species);

  return (
    <Modal onClose={onClose} labelledBy="meta-core-title" size="wide">
      <DetailHeader
        id="meta-core-title"
        species={core.species}
        title={core.species.map((species) => text.species(species)).join(" / ")}
        subtitle={t.metagame.coresOf(core.species.length)}
        onClose={onClose}
      />
      <div className={STATS_GRID}>
        <Stat label={t.metagame.teams} value={core.teams.toLocaleString()} />
        <Stat label={t.metagame.usage} value={percent(core.usage, 1)} hint={t.metagame.usageHint} />
        <Stat label={t.metagame.top} value={percent(core.topUsage)} hint={t.metagame.topHint} />
        <Stat
          label={t.metagame.winRate}
          value={core.winRate === null ? "—" : percent(core.winRate)}
          hint={t.metagame.winRateHint(core.rounds)}
          className={winRateTone(core.winRate, core.rounds)}
        />
      </div>
      <h3 className={cn(DETAIL_TITLE, "pb-2")}>{t.metagame.members}</h3>
      <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-raised">
        {core.species.map((species) => {
          const mon = formOf(species);
          const name = mon ? speciesLabel(text, mon.species) : text.species(species);
          return (
            <li key={species}>
              <button
                type="button"
                disabled={!mon}
                onClick={() => mon && onOpenPokemon(mon.species)}
                aria-label={t.metagame.openDetails(name)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm enabled:hover:bg-zinc-100"
              >
                <span className="relative h-10 w-10 shrink-0">
                  <PokemonSprite species={mon?.species ?? species} fill />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">{name}</span>
                {mon && (
                  <>
                    <span className="text-zinc-600 tabular-nums">{percent(mon.usage, 1)}</span>
                    <Icon name={IconName.ChevronRight} size={18} className="text-zinc-400" />
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/** Green for a good win rate, red for a poor one, faded when there are too few rounds to tell. */
function winRateTone(winRate: number | null, rounds: number): string {
  if (rounds < MIN_ROUNDS) return "text-zinc-400";
  if (winRate !== null && winRate >= 0.53) return "text-green-700 dark:text-green-300";
  if (winRate !== null && winRate <= 0.47) return "text-red-600 dark:text-red-300";
  return "text-zinc-700";
}

/** Green when it rose at the latest event, red when it fell. */
function trendTone(delta: number | null): string {
  if (delta !== null && delta >= TREND_DIFFERENCE) return "text-green-700 dark:text-green-300";
  if (delta !== null && delta <= -TREND_DIFFERENCE) return "text-red-600 dark:text-red-300";
  return "text-zinc-600";
}

/** Rank · sprites (and names) · usage · top 32 · win rate — cores, and full teams with their best finish. */
function ComboList({
  combos,
  hint,
  isTeams,
  matches,
  emptyLabel,
}: {
  combos: (MetaCombo | MetaTeam)[];
  hint: string;
  isTeams: boolean;
  matches: (combo: MetaCombo) => boolean;
  emptyLabel: string;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const visible = combos
    .map((combo, index) => ({ combo, rank: index + 1 }))
    .filter(({ combo }) => matches(combo));
  if (visible.length === 0) {
    return <p className="py-10 text-center text-sm text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-500">{hint}</p>
      <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200">
        {visible.map(({ combo, rank }) => {
          const best = "best" in combo ? combo.best : undefined;
          return (
            <li
              key={combo.species.join("|")}
              className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="w-5 shrink-0 text-right text-xs text-zinc-500 tabular-nums">
                  {rank}
                </span>
                <span className="flex shrink-0 gap-0.5">
                  {combo.species.map((species) => (
                    <span
                      key={species}
                      title={text.species(species)}
                      className="relative h-9 w-9 sm:h-10 sm:w-10"
                    >
                      <PokemonSprite species={species} fill />
                    </span>
                  ))}
                </span>
                {!isTeams && (
                  <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                    {combo.species.map((species) => text.species(species)).join(" + ")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-7 text-sm tabular-nums sm:pl-0">
                <span title={t.metagame.usageHint}>
                  <span className="font-semibold text-zinc-900">{percent(combo.usage, 1)}</span>
                  {isTeams && (
                    <span className="ml-1 text-xs text-zinc-500">
                      {t.metagame.teamsCount(combo.teams)}
                    </span>
                  )}
                </span>
                <span title={t.metagame.topHint} className="text-zinc-600">
                  <span className="text-[10px] text-zinc-400 uppercase">{t.metagame.top}</span>{" "}
                  {percent(combo.topUsage)}
                </span>
                <span title={t.metagame.winRateHint(combo.rounds)} className="text-zinc-600">
                  <span className="text-[10px] text-zinc-400 uppercase">{t.metagame.winRate}</span>{" "}
                  {combo.winRate === null ? "—" : percent(combo.winRate)}
                </span>
                {best && (
                  <span className="text-zinc-600">
                    <span className="text-[10px] text-zinc-400 uppercase">{t.metagame.best}</span>{" "}
                    {t.metagame.bestFinish(
                      t.metagame.placing(best.placing),
                      shortTournamentName(best.tournament),
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Rank · sprite · name · usage · top 32 (from sm) · latest · win rate. */
const ROW_GRID =
  "grid grid-cols-[1.25rem_2.5rem_minmax(0,1fr)_3.5rem_3.75rem_3rem] items-center gap-x-2 px-3 sm:grid-cols-[2rem_3rem_minmax(0,1fr)_8rem_5rem_5rem_5rem] sm:gap-x-3";

function MetaRow({
  mon,
  rank,
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
  const name = speciesLabel(text, mon.species);
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
              style={{ width: percent(mon.usage) }}
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
          className={cn("flex items-center justify-end gap-0.5 tabular-nums", trendTone(delta))}
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
          className={cn("text-right tabular-nums", winRateTone(mon.winRate, mon.rounds))}
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
  inset = true,
}: {
  mon: MetaPokemon;
  history: MetaPokemon["history"];
  tournaments: MetaTournament[];
  recentIds: Set<string>;
  /** Lined up under a table row's name (true), or on its own in a dialog. */
  inset?: boolean;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const padding = inset && "px-3 sm:pl-[5.75rem]";
  const peak = Math.max(...history.map((point) => point.usage), 0.01);

  return (
    <>
      {/* Phones leave the Top 32 column out of the row. */}
      {inset && (
        <p className="px-3 pt-1 text-xs text-zinc-600 sm:hidden">
          {t.metagame.top}: <span className="font-medium">{percent(mon.topUsage)}</span>
        </p>
      )}
      {history.length > 1 && (
        <div className={cn("flex flex-col gap-2", inset && "pt-2", padding)}>
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

      <div
        className={cn(
          "grid grid-cols-1 gap-4 pt-1 pb-4",
          padding,
          inset && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
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
