"use client";

import { useRef, useState } from "react";
import { resolveTypes } from "@/lib/damage/calculateDamage";
import { REGULATIONS } from "@/data/regulations";
import { useMeta, useMetaTournament } from "@/hooks/useMeta";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { cn } from "@/lib/utils";
import type { MetaCombo, MetaPokemon } from "@/lib/meta/aggregateMeta";
import { speciesNamesMegaForm, stripMegaSuffix } from "@/lib/species/megaForm";
import { speciesLabel } from "@/lib/species/speciesLabel";
import {
  shortTournamentName,
  type MetaDocument,
  type MetaFinalist,
  type MetaTournament,
} from "@/lib/meta/metaDocument";
import { useMetaSpreads } from "@/hooks/useMetaSpreads";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import type { Team } from "@/types";
import { LoadingState } from "../LoadingState";
import { SearchField } from "../SearchField";
import { RegulationSelect, Select } from "../Select";
import { TogglePill } from "../Button";
import { MetaIntro } from "./MetaIntro";
import { setUrl, useUrlQuery } from "./metaUrl";
import {
  CardTrend,
  CoreSize,
  MIN_ROUNDS,
  ROW_GRID,
  Scope,
  Sort,
  TYPES,
  Tab,
  Trend,
  eventDate,
  percent,
} from "./metaShared";
import { MetaOverview } from "./MetaOverview";
import { CoreDetailModal, FinalistModal, PokemonDetailModal } from "./MetaDialogs";
import { ComboList, MetaRow } from "./MetaTable";

const TABS: Tab[] = ["overview", "pokemon", "megas", "cores", "teams"];

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
export function MetagameSection({
  showIntro = false,
  initialMeta = null,
  myTeams,
  onAddTeam,
}: {
  /** The home page's welcome: what VGC Box is, and its tools. */
  showIntro?: boolean;
  /** The server-rendered page's snapshot of the default regulation (see src/lib/meta/serverMeta.ts). */
  initialMeta?: MetaDocument | null;
  /** All of the user's teams — to spot a winning team already added. */
  myTeams: Team[];
  /** Saves a new team (useMyTeams' addBuiltTeam). */
  onAddTeam: (team: Team) => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const { appLanguage } = useLanguageSettings();
  // The view lives in the URL (see metaUrl): a link shares it, and Back
  // closes a Pokémon's details.
  const url = useUrlQuery();
  const requestedRegulation = url.get("reg");
  const regulationId = REGULATIONS.some((regulation) => regulation.id === requestedRegulation)
    ? requestedRegulation!
    : (REGULATIONS[0]?.id ?? "");
  const scope: Scope = url.get("events") ?? "recent";
  const requestedView = url.get("view") as Tab | null;
  const tab: Tab = requestedView && TABS.includes(requestedView) ? requestedView : "overview";
  const query = url.get("q") ?? "";
  // The overview's Pokémon dialog (its species).
  const detailSpecies = url.get("pokemon");
  const { meta, isLoading } = useMeta(regulationId, initialMeta);
  // The admin's common spreads (see /admin/meta-sets), for a copied set's Stat Points.
  const { spreads } = useMetaSpreads(regulationId);
  const { flags } = useFeatureFlags();
  const { isStaff } = useIsAdmin();
  const libraryOpen = flags.teamLibrary || isStaff;
  const [openSpecies, setOpenSpecies] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("usage");
  const [coreSize, setCoreSize] = useState<CoreSize>("pairs");
  // Whether this page opened the Pokémon dialog with its own history entry,
  // so closing it goes Back instead of leaving an extra entry behind. (Stale
  // after the browser's own Back is harmless: it's only read on closing, and
  // an open dialog then has an entry to go back from — or was reopened, which
  // sets it again.)
  const pushedDetail = useRef(false);

  function setRegulationId(id: string) {
    setUrl({ reg: id === REGULATIONS[0]?.id ? null : id, events: null });
  }
  function setQuery(value: string) {
    // As typed (spaces too), so the field keeps what's in it.
    setUrl({ q: value.trim() ? value : null });
  }
  function setScope(value: Scope) {
    setUrl({ events: value === "recent" ? null : value });
  }
  function setTab(value: Tab) {
    setUrl({ view: value === "overview" ? null : value });
  }
  function setDetailSpecies(species: string | null) {
    if (species) {
      pushedDetail.current = true;
      setUrl({ pokemon: species }, "push");
    } else if (pushedDetail.current) {
      pushedDetail.current = false;
      window.history.back();
    } else {
      setUrl({ pokemon: null });
    }
  }
  const [detailCore, setDetailCore] = useState<MetaCombo | null>(null);
  const [detailFinalist, setDetailFinalist] = useState<{
    event: MetaTournament;
    finalist: MetaFinalist;
  } | null>(null);

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
  // The events the page is showing, newest first — for their winning teams.
  const scopeEvents = (
    tournamentScope
      ? [tournamentScope]
      : scope === "recent" && official?.recent
        ? tournaments.filter((event) => recentIds.has(event.id))
        : tournaments
  ).toReversed();
  // Per-event histories live on the whole regulation's list.
  const historyBySpecies = new Map(
    (official?.pokemon ?? []).map((mon) => [mon.species, mon.history ?? []]),
  );
  // The overview cards' arrows: the event in view (the newest, unless one is
  // picked) against the one before it.
  const trendIndex = tournamentScope
    ? tournaments.findIndex((event) => event.id === tournamentScope.id)
    : tournaments.length - 1;
  function cardTrend(species: string): CardTrend | null {
    const history = historyBySpecies.get(species);
    const now = history?.[trendIndex];
    const before = history?.[trendIndex - 1];
    if (!now || !before) return null;
    return {
      delta: now.usage - before.usage,
      hint: t.metagame.latestHint(
        shortTournamentName(tournaments[trendIndex].title),
        percent(now.usage, 1),
        shortTournamentName(tournaments[trendIndex - 1].title),
        percent(before.usage, 1),
      ),
    };
  }
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
  // A type's whole name ("fairy", or "hada" in Spanish) also finds the Pokémon of that type.
  const searchedType = TYPES.find(
    (type) => foldForSearch(type) === folded || foldForSearch(text.type(type)) === folded,
  );
  const matchesQuery = (species: string) =>
    !folded ||
    foldForSearch(species).includes(folded) ||
    foldForSearch(speciesLabel(text, species)).includes(folded) ||
    (searchedType !== undefined && (resolveTypes(species) ?? []).includes(searchedType));
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
  /** A teammate (a plain species) as the list has it: its most-used form, a Mega apart. */
  const formOf = (species: string) =>
    (slice?.pokemon ?? []).find((entry) => stripMegaSuffix(entry.species) === species)?.species;
  // What the usage figures cover, briefly: "last 4 events", "Gdansk"…
  const scopeShort = tournamentScope
    ? shortTournamentName(tournamentScope.title)
    : scope === "recent" && official?.recent
      ? t.metagame.scopeShortRecent(official.recent.tournamentIds.length)
      : t.metagame.scopeShortAll;
  const eventCount = tournamentScope
    ? 1
    : scope === "recent" && official?.recent
      ? official.recent.tournamentIds.length
      : tournaments.length;

  return (
    <section className="flex flex-col gap-4">
      {showIntro && <MetaIntro />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showIntro ? (
          <h2 className="text-xl font-semibold text-zinc-900">{t.metagame.title}</h2>
        ) : (
          <h1 className="text-xl font-semibold text-zinc-900">{t.metagame.title}</h1>
        )}
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
          {/* Which events (the newest few, or one tournament — a select, as the list grows weekly),
              then the view. Event dates are ISO (UTC midnight): shown in UTC so they don't shift a day back. */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={tournamentScope ? tournamentScope.id : official.recent ? "recent" : "all"}
                onChange={(value) => setScope(value)}
                ariaLabel={t.metagame.scopeLabel}
                title={t.metagame.scopeHint}
                className="px-3.5 py-1.5 text-sm"
                options={[
                  official.recent
                    ? {
                        value: "recent",
                        label: t.metagame.scopeRecent(official.recent.tournamentIds.length),
                      }
                    : { value: "all", label: t.metagame.scopeAll },
                  ...[...tournaments].reverse().map((tournament) => ({
                    value: tournament.id,
                    label: `${shortTournamentName(tournament.title)} · ${new Date(
                      tournament.startDate,
                    ).toLocaleDateString(appLanguage, {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}`,
                  })),
                ]}
              />
              <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-zinc-300 sm:block" />
              {/* One line that scrolls sideways on phones, rather than wrapping. */}
              <div
                role="tablist"
                aria-label={t.metagame.view}
                className="-mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
              >
                {TABS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={tab === option}
                    onClick={() => {
                      setTab(option);
                      setOpenSpecies(null);
                    }}
                    className={cn(TAB_CLASS(tab === option), "shrink-0")}
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
            </div>
            <div className="flex flex-wrap items-center gap-2">
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

          <div className="-mt-1 text-sm text-zinc-600">
            <p>
              <span className="font-medium text-zinc-800">
                {tournamentScope
                  ? tournamentScope.title
                  : t.metagame.basedOn(eventCount, slice?.teams ?? official.teams)}
              </span>
              {tournamentScope && ` · ${t.metagame.teamsCount(tournamentScope.teams)}`}
              {/* How fresh: the newest event in it, when it was updated, and when next. */}
              {!tournamentScope &&
                latestEvent &&
                ` · ${t.metagame.through(
                  shortTournamentName(latestEvent.title),
                  eventDate(latestEvent, appLanguage),
                )}`}
              {" · "}
              {t.metagame.updated(
                new Date(meta.updatedAt).toLocaleDateString(appLanguage, {
                  month: "short",
                  day: "numeric",
                  // The same day on the server as in the browser.
                  timeZone: "UTC",
                }),
              )}
              {` · ${t.metagame.weekly}`}
            </p>
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
              events={scopeEvents}
              query={query.trim()}
              trendOf={cardTrend}
              usageLegend={t.metagame.usageOf(scopeShort)}
              trendLegend={
                trendIndex >= 1
                  ? t.metagame.trendLegend(
                      shortTournamentName(tournaments[trendIndex].title),
                      shortTournamentName(tournaments[trendIndex - 1].title),
                    )
                  : null
              }
              matches={folded ? matchesQuery : undefined}
              onOpenFinalist={(event, finalist) => setDetailFinalist({ event, finalist })}
              onOpenPokemon={setDetailSpecies}
              onOpenCore={setDetailCore}
              onSeeAllCores={(size) => {
                setTab("cores");
                setCoreSize(size);
              }}
              onSeeAllTeams={() => setTab("teams")}
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
                      spreads={spreads}
                      onOpenPokemon={(species) => {
                        const form = formOf(species);
                        if (form) setDetailSpecies(form);
                      }}
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
                  scopeShort={scopeShort}
                  spreads={spreads}
                  libraryOpen={libraryOpen}
                  onOpenPokemon={(species) => {
                    const form = formOf(species);
                    if (form) setUrl({ pokemon: form });
                  }}
                  onClose={() => setDetailSpecies(null)}
                />
              );
            })()}
          {detailFinalist && (
            <FinalistModal
              {...detailFinalist}
              regulationId={regulationId}
              myTeams={myTeams}
              onAddTeam={onAddTeam}
              onClose={() => setDetailFinalist(null)}
            />
          )}
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
