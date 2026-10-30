"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useOpponents } from "@/hooks/useOpponents";
import { useGroups } from "@/hooks/useGroups";
import { useGroupOpponents } from "@/hooks/useGroupOpponents";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { TeamSheetPreview } from "@/components/TeamSheetPreview";
import { GamePlanCard } from "@/components/GamePlanCard";
import { Button, TogglePill } from "@/components/Button";
import { addPlan, listPlans, movePlan, removePlan, updatePlanAt } from "@/lib/matchupPlans";
import { useMessages } from "@/hooks/useLanguage";
import { RichTextEditor } from "@/components/RichTextEditor";
import { TeamCalcsList } from "@/components/TeamCalcs";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { getPlanForTeam } from "@/lib/opponent";
import { calcsAgainst } from "@/lib/teamCalcs";
import { REGULATIONS } from "@/data/regulations";
import { cn } from "@/lib/utils";
import type { MatchupPlan } from "@/types";

interface MatchupPageProps {
  params: Promise<{ teamId: string; opponentId: string }>;
}

const SECTION_TITLE_CLASSES = "text-xs font-semibold uppercase tracking-wide text-zinc-500";

/**
 * One opponent's prep page for one of your teams (see docs/team-report.md):
 * your plans (their picks, yours, the game plan) beside their team, in tabs:
 * a compact sheet with a note per Pokémon, what they do, and the team's calcs
 * that involve their Pokémon. The plan is the same
 * MatchupPlan the Matchup Planner row edits — not a copy.
 *
 * `?groupId=` opens a prep group's opponent (your private plan for it, like
 * the planner's group list); `?from=planner` makes the header and the back
 * arrow point at the Matchup Planner instead of the team report.
 */
export default function MatchupPage({ params }: MatchupPageProps) {
  const { teamId, opponentId } = use(params);
  const t = useMessages();
  const {
    teams,
    activeTeams,
    activeTeamId,
    isLoading: isTeamsLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
  } = useMyTeams();
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId");
  const fromPlanner = searchParams.get("from") === "planner";
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const personal = useOpponents();
  const groupsApi = useGroups();
  const group = groupId ? (groupsApi.groups.find((g) => g.id === groupId) ?? null) : null;
  const groupList = useGroupOpponents(group);
  // A prep group's opponent comes from that group's list (with your private
  // plan for it); otherwise from your own opponents.
  const { opponents, updateOpponentPlan } = groupId ? groupList : personal;
  const isOpponentsLoading = groupId
    ? isAuthLoading || groupsApi.isLoading || (!!group && groupList.isLoading)
    : personal.isLoading;

  const team = teams.find((t) => t.id === teamId) ?? null;
  const opponent = opponents.find((o) => o.id === opponentId) ?? null;
  const plan = opponent ? getPlanForTeam(opponent, teamId) : null;
  const mainLabel = opponent?.variantOf
    ? opponents.find((o) => o.id === opponent.variantOf)?.label
    : undefined;
  const copiedFromId = opponent?.copiedPlanFrom?.[teamId];
  const copiedFromLabel = copiedFromId
    ? (opponents.find((o) => o.id === copiedFromId)?.label ?? t.opponents.theMainTeam)
    : undefined;
  const relevantCalcs =
    team && opponent ? calcsAgainst(team.calcs ?? [], opponent.team.pokemon) : [];
  const selectedRegulationId = team?.regulationIds[0] ?? REGULATIONS[0]?.id ?? "";
  const reportHref = `/teams/${teamId}?tab=matchups`;
  const backHref = fromPlanner ? "/matchup-planner" : reportHref;
  const backLabel = fromPlanner ? t.matchupPage.backToPlanner : t.matchupPage.backToReport;

  function updatePlan(updater: (plan: MatchupPlan) => MatchupPlan) {
    updateOpponentPlan(opponentId, teamId, updater);
  }

  const [teamTab, setTeamTab] = useState<"preview" | "notes" | "calcs">("preview");
  // Below xl, where the two would stack: which one the chips show.
  const [section, setSection] = useState<"plans" | "theirTeam">("plans");
  const TAB_LABELS = {
    preview: t.matchupPage.preview,
    notes: t.matchupPage.notesTab,
    calcs: t.matchupPage.calcsTab,
  };
  const isLoading = isTeamsLoading || isOpponentsLoading;
  const plans = plan ? listPlans(plan) : [];

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
        currentPage={fromPlanner ? "matchup-planner" : "teams"}
        selectedRegulationId={selectedRegulationId}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {isLoading ? (
        <LoadingState />
      ) : !team || !opponent || !plan ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">
            {!team ? t.matchupPage.teamNotFound : t.matchupPage.opponentNotFound}
          </p>
          <p className="text-sm text-zinc-600">{t.matchupPage.removedElsewhere}</p>
          <Link
            href={team ? backHref : "/teams"}
            className="text-sm font-medium text-zinc-600 hover:underline"
          >
            {team ? `← ${backLabel}` : t.matchupPage.backToMyTeams}
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6 px-3 py-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-x-4 gap-y-2 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Link
                  href={backHref}
                  aria-label={backLabel}
                  title={backLabel}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
                </Link>
                <h1 className="min-w-0 text-xl font-semibold text-zinc-900">
                  {team.name} <span className="font-normal text-zinc-500">{t.matchupPage.vs}</span>{" "}
                  {opponent.label}
                </h1>
              </div>
              {opponent.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-10 md:ml-auto md:max-w-1/2 md:justify-end md:pl-0">
                  {opponent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {(mainLabel || opponent.pokepasteUrl) && (
              <div className="flex flex-wrap items-center gap-1.5 pl-10">
                {mainLabel && (
                  <span className="text-xs text-zinc-500">
                    {t.matchupPage.variantOf(mainLabel)}
                  </span>
                )}
                {opponent.pokepasteUrl && (
                  <a
                    href={opponent.pokepasteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:underline"
                  >
                    {t.common.poképaste}
                    <Icon name={IconName.OpenInNew} size={12} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Wide screens split the page: your plans on the left, their
              team (sheet / notes / calcs) on the right, both in the page's
              normal flow. Narrower screens show one at a time, switched by
              chips — plans first. */}
          <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-6">
            <div className="flex flex-wrap gap-1.5 xl:hidden">
              {(["plans", "theirTeam"] as const).map((option) => (
                <TogglePill
                  key={option}
                  active={section === option}
                  onClick={() => setSection(option)}
                  className="px-3.5 py-1.5 text-sm"
                >
                  {t.matchupPage[option]}
                </TogglePill>
              ))}
            </div>
            <div
              className={cn(
                "min-w-0 flex-col gap-6 xl:flex",
                section === "plans" ? "flex" : "hidden",
              )}
            >
              {/* Each plan: what they bring, what you bring against it, how you play it. */}
              <section aria-label={t.matchupPage.plans} className="flex flex-col gap-2">
                <div
                  className={cn(
                    "flex-wrap items-center gap-2 xl:flex",
                    copiedFromLabel ? "flex" : "hidden",
                  )}
                >
                  <h2 className={cn(SECTION_TITLE_CLASSES, "hidden xl:block")}>
                    {t.matchupPage.plans}
                  </h2>
                  {copiedFromLabel && (
                    <span
                      title={t.opponentCard.copiedFromTitle(copiedFromLabel)}
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                    >
                      {t.opponentCard.copiedFrom(copiedFromLabel)}
                    </span>
                  )}
                </div>
                {plans.map((gamePlan, index) => (
                  <GamePlanCard
                    key={gamePlan.id}
                    plan={gamePlan}
                    index={index}
                    total={plans.length}
                    myTeam={team.pokemon}
                    theirTeam={opponent.team.pokemon}
                    calcs={relevantCalcs}
                    onChange={(updater) => updatePlan((p) => updatePlanAt(p, index, updater))}
                    onMove={(direction) => updatePlan((p) => movePlan(p, index, direction))}
                    onRemove={() => updatePlan((p) => removePlan(p, index))}
                  />
                ))}
                <Button
                  variant="outline"
                  onClick={() => updatePlan(addPlan)}
                  className="flex items-center gap-1.5 self-start"
                >
                  <Icon name={IconName.Add} size={16} />
                  {t.matchupPage.addPlan}
                </Button>
              </section>
            </div>

            <section
              aria-label={t.matchupPage.theirTeam}
              className={cn(
                "min-w-0 flex-col gap-2 xl:flex",
                section === "theirTeam" ? "flex" : "hidden",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className={cn(SECTION_TITLE_CLASSES, "hidden xl:block")}>
                  {t.matchupPage.theirTeam}
                </h2>
                <div role="tablist" aria-label={t.matchupPage.theirTeam} className="flex gap-1">
                  {(["preview", "notes", "calcs"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={teamTab === tab}
                      onClick={() => setTeamTab(tab)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        teamTab === tab
                          ? "bg-chrome-600 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                      )}
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  ))}
                </div>
              </div>
              {teamTab === "preview" && (
                <TeamSheetPreview
                  pokemon={opponent.team.pokemon}
                  notes={plan.pokemonNotes}
                  onNoteChange={(index, note) =>
                    updatePlan((p) => ({
                      ...p,
                      pokemonNotes: { ...p.pokemonNotes, [index]: note },
                    }))
                  }
                />
              )}
              {teamTab === "notes" && (
                // What they do — the matchup's scouting notes, beside the sheet they're about.
                <RichTextEditor
                  size="tall"
                  value={plan.scoutingNotes ?? ""}
                  onChange={(scoutingNotes) => updatePlan((p) => ({ ...p, scoutingNotes }))}
                  placeholder={t.matchupPage.whatTheyDoPlaceholder}
                  ariaLabel={t.matchupPage.whatTheyDo}
                />
              )}
              {teamTab === "calcs" && (
                <div className="flex flex-col gap-2">
                  {relevantCalcs.length === 0 ? (
                    <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                      {t.matchupPage.noCalcs(team.name)}
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-zinc-200">
                      <TeamCalcsList calcs={relevantCalcs} teamPokemon={team.pokemon} />
                    </div>
                  )}
                  <Link
                    href={`/teams/${teamId}?tab=calcs`}
                    className="self-end text-xs font-medium text-zinc-600 hover:underline"
                  >
                    {t.matchupPage.manageCalcs}
                  </Link>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
