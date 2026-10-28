"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTournaments } from "@/hooks/useTournaments";
import { useOpponents } from "@/hooks/useOpponents";
import { useGroups } from "@/hooks/useGroups";
import { useAllGroupOpponents } from "@/hooks/useAllGroupOpponents";
import { useAuth } from "@/hooks/useAuth";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { PokemonReportCard } from "@/components/PokemonReportCard";
import { TeamCombinationCard } from "@/components/TeamCombinationCard";
import { PokemonSprite } from "@/components/PokemonSprite";
import { RichTextEditor } from "@/components/RichTextEditor";
import { PokemonCalcsBox } from "@/components/TeamCalcs";
import { TeamMatchupsList } from "@/components/TeamMatchups";
import { ShareDialog, TeamPost } from "@/components/TeamPost";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { createEmptyCombination, TEAM_REPORT_PREP_ENABLED } from "@/constants";
import { computeTeamUsageStats } from "@/lib/tournament";
import { isTeamArchived } from "@/lib/team";
import { parseTeam } from "@/lib/parseTeam";
import { speciesIdentity } from "@/lib/teamIdentity";
import { calcMatchesSearch } from "@/lib/teamCalcs";
import { parseSearchTerms } from "@/lib/pokemonMatchesQuery";
import { SearchField } from "@/components/SearchField";
import { Modal, ModalDescription, ModalTitle } from "@/components/Modal";
import { REGULATIONS } from "@/data/regulations";
import type { TeamCombination } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/Button";
import { LoadingState } from "@/components/LoadingState";

interface TeamReportPageProps {
  params: Promise<{ teamId: string }>;
  /** `?tab=` opens that tab — the matchup page links back with `?tab=matchups`. */
  searchParams: Promise<{ tab?: string }>;
}

type ReportTab = "report" | "strategy" | "calcs" | "matchups" | "stats";

const ALL_TABS: ReportTab[] = ["report", "strategy", "calcs", "matchups", "stats"];
// Matchups is on hold — see TEAM_REPORT_PREP_ENABLED.
const TABS = TEAM_REPORT_PREP_ENABLED ? ALL_TABS : ALL_TABS.filter((tab) => tab !== "matchups");

function isReportTab(value: string | undefined): value is ReportTab {
  return TABS.some((tab) => tab === value);
}

export default function TeamReportPage({ params, searchParams }: TeamReportPageProps) {
  const { teamId } = use(params);
  const { tab: initialTab } = use(searchParams);
  const t = useMessages();
  const pokemonText = usePokemonText();
  const {
    teams,
    activeTeams,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
    updateTeam,
    unarchiveTeam,
  } = useMyTeams();
  const { tournaments } = useTournaments();
  const personal = useOpponents();
  // The Matchups tab lists your prep from your own opponents and every prep group's.
  const groupsApi = useGroups();
  const groupOpponents = useAllGroupOpponents(groupsApi.groups);
  const matchupLists = [
    { source: { kind: "mine" as const }, opponents: personal.opponents },
    ...groupOpponents.lists.map(({ group, opponents }) => ({
      source: { kind: "group" as const, id: group.id, name: group.name },
      opponents,
    })),
  ];
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  // Until sign-in resolves, whether there are groups to read isn't known yet.
  const isMatchupsLoading =
    isAuthLoading || personal.isLoading || groupsApi.isLoading || groupOpponents.isLoading;

  const team = teams.find((t) => t.id === teamId) ?? null;
  // No regulation selector on this page (it's one specific team's own
  // report) — default the header switcher to whichever regulation this
  // team itself is tagged for, so it at least includes this team.
  const selectedRegulationId = team?.regulationIds[0] ?? REGULATIONS[0]?.id ?? "";
  const usageStats = team ? computeTeamUsageStats(tournaments, team) : [];
  const [isSharing, setIsSharing] = useState(false);
  // Calcs tab: narrows every Pokémon's calcs to the ones against the searched Pokémon.
  const [calcQuery, setCalcQuery] = useState("");
  const [isConfirmingClearCalcs, setIsConfirmingClearCalcs] = useState(false);
  const calcSearchTerms = parseSearchTerms(calcQuery);
  // The paste in the post's edit form, while editing — the Pokémon cards
  // preview it live instead of showing the saved roster.
  const [draftPaste, setDraftPaste] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>(
    isReportTab(initialTab) ? initialTab : "report",
  );

  const isPreviewing = draftPaste !== null && draftPaste.trim() !== team?.rawPaste.trim();
  const rosterShown = isPreviewing ? parseTeam(draftPaste) : (team?.pokemon ?? []);

  function selectTab(tab: ReportTab) {
    setActiveTab(tab);
    // Leaving the report tab unmounts the post, dropping any unsaved edit —
    // drop its paste preview with it.
    setDraftPaste(null);
    // Keep the tab in the URL so Back from a matchup page (or a reload)
    // returns to it. The native History API is synced with Next's router.
    const url = new URL(window.location.href);
    if (tab === "report") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  }

  function addCombination() {
    updateTeam(teamId, (t) => ({
      ...t,
      combinations: [...(t.combinations ?? []), createEmptyCombination()],
    }));
  }

  function updateCombination(
    combinationId: string,
    updater: (combination: TeamCombination) => TeamCombination,
  ) {
    updateTeam(teamId, (t) => ({
      ...t,
      combinations: (t.combinations ?? []).map((c) => (c.id === combinationId ? updater(c) : c)),
    }));
  }

  function moveCombination(combinationId: string, direction: -1 | 1) {
    updateTeam(teamId, (t) => {
      const combinations = [...(t.combinations ?? [])];
      const from = combinations.findIndex((c) => c.id === combinationId);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= combinations.length) return t;
      [combinations[from], combinations[to]] = [combinations[to], combinations[from]];
      return { ...t, combinations };
    });
  }

  function removeCombination(combinationId: string) {
    updateTeam(teamId, (t) => ({
      ...t,
      combinations: (t.combinations ?? []).filter((c) => c.id !== combinationId),
    }));
  }

  return (
    <div className="flex flex-1 flex-col">
      <MyTeamHeader
        teams={activeTeams}
        activeTeamId={activeTeamId}
        isLoading={isLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
        currentPage="teams"
        selectedRegulationId={selectedRegulationId}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {isLoading ? (
        <LoadingState />
      ) : !team ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">{t.teamPage.notFound}</p>
          <p className="text-sm text-zinc-600">{t.teamPage.notFoundBody}</p>
          <Link href="/teams" className="text-sm font-medium text-zinc-600 hover:underline">
            {t.teamPage.backToMyTeams}
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6 px-3 py-4 sm:p-6">
          {/* Back to My Teams left, tabs right (they wrap below on narrow
              screens); the team's name is the title of its post below. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* On the Team report tab the post titles the page; elsewhere the
                team's name joins the breadcrumb (as the page's h1). */}
            <nav
              aria-label={t.teamPage.breadcrumb}
              className="flex min-w-0 items-center gap-1 text-sm"
            >
              <Link
                href="/teams"
                className="flex shrink-0 items-center gap-1 rounded-full py-1 pr-1 font-medium text-zinc-500 hover:text-zinc-800"
              >
                <Icon name={IconName.ExpandMore} size={18} className="rotate-90" />
                {t.nav.myTeams}
              </Link>
              {activeTab !== "report" && (
                <>
                  <span aria-hidden="true" className="text-zinc-400">
                    /
                  </span>
                  <h1 aria-current="page" className="truncate font-semibold text-zinc-900">
                    {team.name}
                  </h1>
                </>
              )}
            </nav>
            <div role="tablist" aria-label={t.teamPage.sections} className="flex flex-wrap gap-1.5">
              {TABS.map((tab) => (
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
          </div>

          {/* The team's post (and its edit mode) lives on the Team report
              tab; the other tabs name the team in the breadcrumb above. */}
          {activeTab === "report" ? (
            <TeamPost
              name={team.name}
              rawPaste={team.rawPaste}
              creator={team.creator}
              pokepasteUrl={team.pokepasteUrl}
              replicaCode={team.replicaCode}
              overview={team.overview}
              owner={{
                onSave: ({ rawPaste, ...content }) => {
                  // A changed paste is reparsed (and validated) the same way
                  // the old Edit team dialog did; the rest is plain fields.
                  if (rawPaste !== undefined) {
                    const error = editTeam(teamId, rawPaste, content.name);
                    if (error) return error;
                  }
                  updateTeam(teamId, (t) => ({ ...t, ...content }));
                  return null;
                },
                onShare: () => setIsSharing(true),
                shareLabel: team.share
                  ? t.teamPage.sharedLabel(team.share.sheet)
                  : t.teamPage.share,
                isShared: !!team.share,
                onDraftPasteChange: setDraftPaste,
              }}
            />
          ) : null}
          {isSharing && (
            <ShareDialog
              team={team}
              onUpdate={(updater) => updateTeam(teamId, updater)}
              isSignedIn={!!user}
              onSignIn={signInWithGoogle}
              onClose={() => setIsSharing(false)}
            />
          )}

          {isTeamArchived(team) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-zinc-700">
                <Icon name={IconName.Archive} size={18} className="shrink-0 text-zinc-500" />
                {t.teamPage.archivedNotice}
              </span>
              <button
                type="button"
                onClick={() => unarchiveTeam(team.id)}
                className="shrink-0 rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {t.teamPage.unarchive}
              </button>
            </div>
          )}

          {/* Six compact cards in a row on desktop. Per-Pokémon notes
              (Team.pokemonNotes) are no longer shown here, but stay saved.
              While the paste is being edited they preview the draft. */}
          {activeTab === "report" && (
            <div className="flex flex-col gap-2">
              {isPreviewing && (
                <p className="text-xs font-medium text-zinc-500">{t.teamPage.previewNotSaved}</p>
              )}
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {rosterShown.map((mon, index) => (
                  <PokemonReportCard key={`${mon.species}-${index}`} pokemon={mon} />
                ))}
              </div>
            </div>
          )}

          {/* Two columns on desktop: the lead/back combinations, and one
              "Weaknesses & watch-outs" area. (Team.weaknesses is no longer shown — its
              text stays saved.) */}
          {activeTab === "strategy" && (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              {/* Laid out like the matchup page's plans: a card per combination, arrows to reorder. */}
              <section className="flex flex-col gap-3">
                <h2 className="flex h-8 items-center text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {t.teamPage.combinations}
                </h2>
                {(team.combinations ?? []).length === 0 ? (
                  <p className="text-sm text-zinc-500">{t.teamPage.noCombinations}</p>
                ) : (
                  (team.combinations ?? []).map((combination, index, all) => (
                    <TeamCombinationCard
                      key={combination.id}
                      combination={combination}
                      index={index}
                      total={all.length}
                      teamPokemon={team.pokemon}
                      onUpdate={(updater) => updateCombination(combination.id, updater)}
                      onMove={(direction) => moveCombination(combination.id, direction)}
                      onRemove={() => removeCombination(combination.id)}
                    />
                  ))
                )}
                <Button
                  variant="outline"
                  onClick={addCombination}
                  className="flex items-center gap-1.5 self-start"
                >
                  <Icon name={IconName.Add} size={16} />
                  {t.teamPage.addCombination}
                </Button>
              </section>

              {/* Titled like the combinations beside it — no card around the editor. */}
              <section className="flex flex-col gap-3">
                <h2 className="flex h-8 items-center text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {t.teamPage.notes}
                </h2>
                <RichTextEditor
                  value={team.notes ?? ""}
                  onChange={(notes) => updateTeam(teamId, (t) => ({ ...t, notes }))}
                  placeholder={t.teamPage.notesPlaceholder}
                  ariaLabel={t.teamPage.notesLabel}
                  size="tall"
                />
              </section>
            </div>
          )}

          {/* Each Pokémon's card (collapsed to its sprite header until clicked)
              with its saved calcs underneath. Columns are independent, so
              expanding one card or one list never stretches the others. */}
          {activeTab === "calcs" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SearchField
                  query={calcQuery}
                  onQueryChange={setCalcQuery}
                  placeholder={t.pokemonCard.searchCalcsPlaceholder}
                  ariaLabel={t.pokemonCard.searchCalcs}
                  className="min-w-0 flex-1 sm:max-w-xs"
                />
                {(team.calcs ?? []).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearCalcs(true)}
                    className="ml-auto flex items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-red-300 hover:text-red-600"
                  >
                    <Icon name={IconName.Delete} size={16} />
                    {t.pokemonCard.clearCalcs}
                  </button>
                )}
              </div>
              {isConfirmingClearCalcs && (
                <Modal
                  onClose={() => setIsConfirmingClearCalcs(false)}
                  labelledBy="confirm-clear-calcs-title"
                >
                  <ModalTitle id="confirm-clear-calcs-title" className="mb-2">
                    {t.pokemonCard.confirmClearCalcsTitle((team.calcs ?? []).length)}
                  </ModalTitle>
                  <ModalDescription>{t.pokemonCard.confirmClearCalcsBody}</ModalDescription>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      onClick={() => {
                        updateTeam(teamId, (t) => ({ ...t, calcs: [] }));
                        setIsConfirmingClearCalcs(false);
                      }}
                    >
                      {t.pokemonCard.clearCalcs}
                    </Button>
                    <Button variant="outline" onClick={() => setIsConfirmingClearCalcs(false)}>
                      {t.common.cancel}
                    </Button>
                  </div>
                </Modal>
              )}
              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {team.pokemon.map((mon, index) => (
                  <div key={`${mon.species}-${index}`} className="flex flex-col gap-2">
                    <PokemonReportCard pokemon={mon} collapsible />
                    <PokemonCalcsBox
                      searching={calcSearchTerms.length > 0}
                      calcs={(team.calcs ?? []).filter(
                        (calc) =>
                          calc.species === speciesIdentity(mon.species) &&
                          (calcSearchTerms.length === 0 ||
                            calcMatchesSearch(calc, calcSearchTerms, pokemonText.species)),
                      )}
                      onRemoveCalc={(id) =>
                        updateTeam(teamId, (t) => ({
                          ...t,
                          calcs: (t.calcs ?? []).filter((calc) => calc.id !== id),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "matchups" && (
            <TeamMatchupsList team={team} lists={matchupLists} isLoading={isMatchupsLoading} />
          )}

          {activeTab === "stats" && (
            <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              {usageStats.every((stat) => stat.timesPicked === 0) ? (
                <p className="text-sm text-zinc-500">
                  {t.teamPage.noGames.before}
                  <Link href="/tournaments" className="text-zinc-600 hover:underline">
                    {t.teamPage.noGames.link}
                  </Link>
                  {t.teamPage.noGames.after}
                </p>
              ) : (
                <table className="w-full text-xs text-zinc-700">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="py-1 text-left font-normal">{t.teamPage.statsPokemon}</th>
                      <th className="text-right font-normal">{t.teamPage.statsPicked}</th>
                      <th className="text-right font-normal">{t.teamPage.statsWins}</th>
                      <th className="text-right font-normal">{t.teamPage.statsLosses}</th>
                      <th className="text-right font-normal">{t.teamPage.statsWinRate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageStats.map((stat) => (
                      <tr key={stat.index} className="border-t border-zinc-100">
                        <td className="flex items-center gap-2 py-1.5">
                          <span className="relative h-6 w-6 shrink-0">
                            <PokemonSprite species={stat.pokemon.species} fill />
                          </span>
                          <span className="truncate font-medium text-zinc-900">
                            {pokemonText.species(stat.pokemon.species)}
                          </span>
                        </td>
                        <td className="text-right">{stat.timesPicked}</td>
                        <td className="text-right text-green-700">{stat.wins}</td>
                        <td className="text-right text-red-600">{stat.losses}</td>
                        <td className="text-right font-medium">
                          {stat.timesPicked > 0
                            ? `${Math.round((stat.wins / stat.timesPicked) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
