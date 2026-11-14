"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { PokemonReportCard } from "@/components/PokemonReportCard";
import { TeamPost } from "@/components/TeamPost";
import { TeamCombinationCard } from "@/components/TeamCombinationCard";
import { PokemonCalcsBox } from "@/components/TeamCalcs";
import { TeamMatchupsList } from "@/components/TeamMatchups";
import { RichTextView } from "@/components/RichTextEditor";
import { SearchField } from "@/components/SearchField";
import { TeamSpeedTiers } from "@/components/TeamSpeedTiers";
import { getSharedMatchups, getSharedTeam } from "@/lib/firebase";
import { REGULATIONS } from "@/data/regulations";
import type { Opponent, ShareSection, SharedTeam } from "@/types";
import { LoadingState } from "@/components/LoadingState";
import { TeamExportActions } from "@/components/TeamExportActions";
import { useOpponents } from "@/hooks/useOpponents";
import { addPasteToOpponents, addSharedTeamToMyTeams } from "@/lib/teamExport";
import { formatTeamPaste } from "@/lib/formatPokemonPaste";
import { sharedMatchupPath, sharedMatchupsAsOpponents, sharedTeamAsTeam } from "@/lib/sharedTeam";
import { hasRichText } from "@/lib/richText";
import { speciesIdentity } from "@/lib/teamIdentity";
import { calcMatchesSearch } from "@/lib/teamCalcs";
import { parseSearchTerms } from "@/lib/pokemonMatchesQuery";
import { cn } from "@/lib/utils";

/** Where a copy of a shared team goes: the owner's first regulation, or the newest one for a copy shared before regulations were published with it. */
function sharedRegulationId(team: SharedTeam): string {
  const known = team.regulationIds?.find((id) => REGULATIONS.some((reg) => reg.id === id));
  return known ?? REGULATIONS[0]?.id ?? "";
}

type SharedTab = "report" | ShareSection;

interface SharedTeamPageProps {
  params: Promise<{ teamId: string }>;
  /** `?tab=` opens that tab — a shared matchup page links back with `?tab=matchups`. */
  searchParams: Promise<{ tab?: string }>;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; team: SharedTeam; matchups: Opponent[] | null };

/**
 * A shared Team Report, as anyone with the link sees it — no sign-in
 * needed. Reads the public copy (see SharedTeam / toSharedTeam), so it only
 * ever has what the owner chose to share: an open team sheet has no Stat
 * Points or nature, and so no stats; strategy, calcs and matchups each get
 * a tab only when shared (docs/full-share.md).
 */
export default function SharedTeamPage({ params, searchParams }: SharedTeamPageProps) {
  const t = useMessages();
  const pokemonText = usePokemonText();
  const { teamId } = use(params);
  const { tab: initialTab } = use(searchParams);
  const {
    teams,
    activeTeams,
    activeTeamId,
    isLoading: isTeamsLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
    addBuiltTeam,
  } = useMyTeams();
  const { opponents, addOpponents } = useOpponents();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedTab, setSelectedTab] = useState<string>(initialTab ?? "report");
  const [calcQuery, setCalcQuery] = useState("");
  const calcSearchTerms = parseSearchTerms(calcQuery);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<LoadState> {
      const team = await getSharedTeam(teamId);
      if (!team) return { kind: "missing" };
      // The matchups are their own docs — read only when shared.
      const matchups = team.sections?.includes("matchups")
        ? sharedMatchupsAsOpponents(await getSharedMatchups(teamId), teamId)
        : null;
      return { kind: "ready", team, matchups };
    }
    load()
      .then((loaded) => {
        if (!cancelled) setState(loaded);
      })
      .catch((error) => {
        console.error("[shared team] load failed:", error);
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const shared = state.kind === "ready" ? state.team : null;
  const team = shared ? sharedTeamAsTeam(shared) : null;
  const tabs: SharedTab[] = ["report", ...(shared?.sections ?? [])];
  // A copy published before regulationIds existed falls back to the first regulation.
  const speedRegulation =
    REGULATIONS.find((regulation) => regulation.id === shared?.regulationIds?.[0]) ??
    REGULATIONS[0];
  const activeTab: SharedTab = tabs.find((tab) => tab === selectedTab) ?? "report";
  const sharesMore = tabs.length > 1;

  function selectTab(tab: SharedTab) {
    setSelectedTab(tab);
    // Keep the tab in the URL so Back from a matchup page returns to it.
    const url = new URL(window.location.href);
    if (tab === "report") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-1 flex-col">
      <MyTeamHeader
        teams={activeTeams}
        activeTeamId={activeTeamId}
        isLoading={isTeamsLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
        currentPage="teams"
        selectedRegulationId={REGULATIONS[0]?.id ?? ""}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {state.kind === "loading" ? (
        <LoadingState />
      ) : state.kind !== "ready" || !shared || !team ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">
            {state.kind === "missing" ? t.sharedPage.notShared : t.sharedPage.loadFailed}
          </p>
          <p className="text-sm text-zinc-600">
            {state.kind === "missing" ? t.sharedPage.notSharedBody : t.sharedPage.loadFailedBody}
          </p>
          <Link href="/" className="text-sm font-medium text-zinc-600 hover:underline">
            {t.sharedPage.goHome}
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6 px-3 py-4 sm:p-6">
          {/* The owner's team post, read-only; the sheet type sits at the
              end of its details line. */}
          <TeamPost
            name={shared.name}
            creator={shared.creator}
            pokepasteUrl={shared.pokepasteUrl}
            replicaCode={shared.replicaCode}
            overview={shared.overview}
            status={shared.sheet === "open" ? t.share.openSheet : t.share.closedSheet}
          />

          {sharesMore && (
            <div role="tablist" aria-label={t.teamPage.sections} className="flex flex-wrap gap-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => selectTab(tab)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    activeTab === tab
                      ? "bg-chrome-600 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                  )}
                >
                  {t.teamPage.tabs[tab]}
                </button>
              ))}
            </div>
          )}

          {activeTab === "report" && (
            <>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {shared.pokemon.map((mon, index) => (
                  <PokemonReportCard
                    key={`${mon.species}-${index}`}
                    pokemon={mon}
                    sheet={shared.sheet}
                  />
                ))}
              </div>

              <TeamExportActions
                pokemon={shared.pokemon}
                sheet={shared.sheet}
                // Your own shared team is already in My Teams.
                onAddToMyTeams={
                  user?.uid === shared.ownerUid
                    ? undefined
                    : () => {
                        addSharedTeamToMyTeams({
                          shared,
                          regulationId: sharedRegulationId(shared),
                          myTeams: teams,
                          addTeam: addBuiltTeam,
                          matchups: state.matchups ?? [],
                          myOpponents: opponents,
                          addOpponents,
                        });
                      }
                }
                addToMyTeamsText={
                  sharesMore
                    ? { label: t.sharedPage.addEverything, hint: t.sharedPage.addEverythingHint }
                    : undefined
                }
                onAddToOpponents={() => {
                  addPasteToOpponents({
                    name: shared.name,
                    paste: formatTeamPaste(shared.pokemon, { sheet: shared.sheet }),
                    regulationId: sharedRegulationId(shared),
                    pokepasteUrl: shared.pokepasteUrl,
                    opponents,
                    addOpponents,
                  });
                }}
              />
            </>
          )}

          {/* Like the owner's Strategy tab, read only: the combinations, then the notes. */}
          {activeTab === "strategy" &&
            (!shared.combinations?.length && !hasRichText(shared.notes) ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                {t.sharedPage.noStrategy}
              </p>
            ) : (
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                {!!shared.combinations?.length && (
                  <section aria-label={t.teamPage.combinations} className="flex flex-col gap-3">
                    <h2 className="flex h-8 items-center text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      {t.teamPage.combinations}
                    </h2>
                    {shared.combinations.map((combination, index, all) => (
                      <TeamCombinationCard
                        key={combination.id}
                        combination={combination}
                        index={index}
                        total={all.length}
                        teamPokemon={shared.pokemon}
                      />
                    ))}
                  </section>
                )}
                {hasRichText(shared.notes) && (
                  <section aria-label={t.teamPage.notes} className="flex flex-col gap-3">
                    <h2 className="flex h-8 items-center text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      {t.teamPage.notes}
                    </h2>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                      <RichTextView html={shared.notes ?? ""} />
                    </div>
                  </section>
                )}
              </div>
            ))}

          {activeTab === "calcs" &&
            (!shared.calcs?.length ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                {t.sharedPage.noCalcs}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <SearchField
                  query={calcQuery}
                  onQueryChange={setCalcQuery}
                  placeholder={t.pokemonCard.searchCalcsPlaceholder}
                  ariaLabel={t.pokemonCard.searchCalcs}
                  className="min-w-0 sm:max-w-xs"
                />
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                  {shared.pokemon.map((mon, index) => (
                    <div key={`${mon.species}-${index}`} className="flex flex-col gap-2">
                      <PokemonReportCard pokemon={mon} sheet={shared.sheet} collapsible />
                      <PokemonCalcsBox
                        searching={calcSearchTerms.length > 0}
                        calcs={(shared.calcs ?? []).filter(
                          (calc) =>
                            calc.species === speciesIdentity(mon.species) &&
                            (calcSearchTerms.length === 0 ||
                              calcMatchesSearch(calc, calcSearchTerms, pokemonText.species)),
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {/* The owner's Speed table, read only (docs/team-speed-tiers.md). */}
          {activeTab === "speed" && speedRegulation && (
            <TeamSpeedTiers
              teams={[shared]}
              hideTeamPicker
              regulationId={speedRegulation.id}
              regulationLabel={t.common.regulationLabel(speedRegulation.label)}
              speciesKeys={speedRegulation.speciesKeys}
              megaStoneItemsForSpecies={speedRegulation.megaStoneItemsForSpecies}
            />
          )}

          {activeTab === "matchups" && (
            <TeamMatchupsList
              team={team}
              lists={[{ source: { kind: "mine" }, opponents: state.matchups ?? [] }]}
              isLoading={false}
              shared={{ href: (opponent) => sharedMatchupPath(shared.id, opponent.id) }}
            />
          )}
        </div>
      )}
    </div>
  );
}
