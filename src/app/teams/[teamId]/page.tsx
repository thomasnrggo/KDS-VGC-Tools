"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { ShareDialog } from "@/components/TeamPost";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { createEmptyCombination, TEAM_REPORT_PREP_ENABLED } from "@/constants";
import { computeTeamUsageStats } from "@/lib/tournament";
import { isTeamArchived } from "@/lib/team";
import { speciesIdentity } from "@/lib/teamIdentity";
import { calcMatchesSearch } from "@/lib/teamCalcs";
import { parseSearchTerms } from "@/lib/pokemonMatchesQuery";
import { SearchField } from "@/components/SearchField";
import { Modal, ModalDescription, ModalTitle } from "@/components/Modal";
import { REGULATIONS } from "@/data/regulations";
import type { TeamCombination } from "@/types";
import { cn } from "@/lib/utils";
import { Button, TogglePill, iconButtonVariants } from "@/components/Button";
import { LoadingState } from "@/components/LoadingState";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

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
    archiveTeam,
    unarchiveTeam,
  } = useMyTeams();
  const router = useRouter();
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
  // The roster's "Edit Pokémon" link into the Team Builder.
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
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  // Strategy tab below lg: which of its two sections the chips show.
  const [strategySection, setStrategySection] = useState<"combinations" | "notes">("combinations");
  // Phones: the sections' bottom sheet.
  const [isSectionsOpen, setIsSectionsOpen] = useState(false);
  const shareLabel = team?.share ? t.teamPage.sharedLabel(team.share.sheet) : t.teamPage.share;
  // Calcs tab: narrows every Pokémon's calcs to the ones against the searched Pokémon.
  const [calcQuery, setCalcQuery] = useState("");
  const [isConfirmingClearCalcs, setIsConfirmingClearCalcs] = useState(false);
  const calcSearchTerms = parseSearchTerms(calcQuery);
  const [activeTab, setActiveTab] = useState<ReportTab>(
    isReportTab(initialTab) ? initialTab : "report",
  );

  function selectTab(tab: ReportTab) {
    setActiveTab(tab);
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
          {/* "< My Teams / team" left (the team's name is the page's h1), the tabs then
              Share and Edit right. Narrower screens: Share and Edit stay on the breadcrumb's
              line and the tabs wrap below it. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <nav
              aria-label={t.teamPage.breadcrumb}
              className="mr-auto flex min-w-0 items-center gap-1 text-sm"
            >
              <Link
                href="/teams"
                className="flex shrink-0 items-center gap-1 rounded-full py-1 pr-1 font-medium text-zinc-500 hover:text-zinc-800"
              >
                <Icon name={IconName.ExpandMore} size={18} className="rotate-90" />
                {t.nav.myTeams}
              </Link>
              <span aria-hidden="true" className="text-zinc-400">
                /
              </span>
              <h1 aria-current="page" className="truncate font-semibold text-zinc-900">
                {team.name}
              </h1>
            </nav>
            {/* Phones: one button showing the current section, opening a bottom sheet with
                all of them — instead of pill tabs wrapping onto two rows. */}
            <Drawer open={isSectionsOpen} onOpenChange={setIsSectionsOpen} showSwipeHandle>
              <DrawerTrigger
                render={
                  <button
                    type="button"
                    aria-label={`${t.teamPage.sections}: ${t.teamPage.tabs[activeTab]}`}
                    className="order-last flex basis-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-raised px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 sm:hidden"
                  />
                }
              >
                {t.teamPage.tabs[activeTab]}
                <Icon name={IconName.ExpandMore} size={18} className="text-zinc-500" />
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>{t.teamPage.sections}</DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col gap-1 p-3 pt-1 pb-6">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      aria-current={activeTab === tab ? "page" : undefined}
                      onClick={() => {
                        selectTab(tab);
                        setIsSectionsOpen(false);
                      }}
                      className={cn(
                        "flex min-h-12 items-center justify-between rounded-lg px-3 text-left text-base font-medium",
                        activeTab === tab
                          ? "bg-chrome-600 text-white"
                          : "text-zinc-800 active:bg-zinc-200",
                      )}
                    >
                      {t.teamPage.tabs[tab]}
                      {activeTab === tab && <Icon name={IconName.Check} size={18} />}
                    </button>
                  ))}
                </div>
              </DrawerContent>
            </Drawer>
            <div
              role="tablist"
              aria-label={t.teamPage.sections}
              className="order-last hidden basis-full flex-wrap gap-1.5 sm:flex lg:order-none lg:basis-auto"
            >
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
            <div className="flex items-center gap-1.5">
              {/* A dot marks a shared report — the owner's only sign of it. */}
              <button
                type="button"
                onClick={() => setIsSharing(true)}
                aria-label={shareLabel}
                title={shareLabel}
                className={cn(iconButtonVariants({ variant: "round" }), "relative")}
              >
                <Icon name={IconName.Share} size={16} />
                {team.share && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-50 bg-green-600"
                  />
                )}
              </button>
              {/* Editing the team happens in the Team Builder. */}
              <Link
                href={`/teams/${teamId}/edit`}
                aria-label={t.teamBuilder.editPokemon}
                title={t.teamBuilder.editPokemonHint}
                className={iconButtonVariants({ variant: "round" })}
              >
                <Icon name={IconName.Edit} size={16} />
              </Link>
              {/* Phones: My Teams rows only show Edit and Duplicate, so Archive and
                  Remove are here instead. */}
              <div className="md:hidden">
                <RowActionsMenu
                  label={t.myTeams.teamOptions(team.name)}
                  triggerClassName={iconButtonVariants({ variant: "round" })}
                  onRemove={() => setIsConfirmingRemove(true)}
                  removeLabel={t.myTeams.removeTeam}
                  middleAction={
                    isTeamArchived(team)
                      ? {
                          label: t.myTeams.unarchive,
                          icon: IconName.Unarchive,
                          onClick: () => unarchiveTeam(team.id),
                        }
                      : {
                          label: t.myTeams.archive,
                          icon: IconName.Archive,
                          onClick: () => archiveTeam(team.id),
                        }
                  }
                />
              </div>
            </div>
          </div>

          {isConfirmingRemove && (
            <Modal
              onClose={() => setIsConfirmingRemove(false)}
              labelledBy="confirm-remove-team-title"
            >
              <ModalTitle id="confirm-remove-team-title" className="mb-2">
                {t.myTeams.confirmRemoveTitle(team.name)}
              </ModalTitle>
              <ModalDescription>{t.myTeams.confirmRemoveBody}</ModalDescription>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    // Leave first, so this page never flashes "team not found".
                    router.replace("/teams");
                    removeTeam(team.id);
                  }}
                >
                  {t.myTeams.removeTeam}
                </Button>
                <Button variant="outline" onClick={() => setIsConfirmingRemove(false)}>
                  {t.common.cancel}
                </Button>
              </div>
            </Modal>
          )}

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
              (Team.pokemonNotes) are no longer shown here, but stay saved. So do the
              old post's creator, links and overview, no longer shown either. */}
          {activeTab === "report" && (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {team.pokemon.map((mon, index) => (
                <PokemonReportCard key={`${mon.species}-${index}`} pokemon={mon} />
              ))}
            </div>
          )}

          {/* Two columns on desktop: the lead/back combinations, and one
              "Weaknesses & watch-outs" area. Narrower, where they'd stack, chips switch
              between them instead. (Team.weaknesses is no longer shown — its text stays
              saved.) */}
          {activeTab === "strategy" && (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <div className="flex flex-wrap gap-1.5 lg:hidden">
                <TogglePill
                  active={strategySection === "combinations"}
                  onClick={() => setStrategySection("combinations")}
                  className="px-3.5 py-1.5 text-sm"
                >
                  {t.teamPage.combinations}
                </TogglePill>
                <TogglePill
                  active={strategySection === "notes"}
                  onClick={() => setStrategySection("notes")}
                  className="px-3.5 py-1.5 text-sm"
                >
                  {t.teamPage.notes}
                </TogglePill>
              </div>
              {/* Laid out like the matchup page's plans: a card per combination, arrows to reorder. */}
              <section
                aria-label={t.teamPage.combinations}
                className={cn(
                  "flex-col gap-3 lg:flex",
                  strategySection === "combinations" ? "flex" : "hidden",
                )}
              >
                <h2 className="hidden h-8 items-center text-xs font-semibold tracking-wide text-zinc-500 uppercase lg:flex">
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
              <section
                aria-label={t.teamPage.notes}
                className={cn(
                  "flex-col gap-3 lg:flex",
                  strategySection === "notes" ? "flex" : "hidden",
                )}
              >
                <h2 className="hidden h-8 items-center text-xs font-semibold tracking-wide text-zinc-500 uppercase lg:flex">
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
