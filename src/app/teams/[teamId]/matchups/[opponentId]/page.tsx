"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useOpponents } from "@/hooks/useOpponents";
import { useGroups } from "@/hooks/useGroups";
import { useGroupOpponents } from "@/hooks/useGroupOpponents";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { MatchupView } from "@/components/MatchupView";
import { useMessages } from "@/hooks/useLanguage";
import { getPlanForTeam } from "@/lib/opponent";
import { REGULATIONS } from "@/data/regulations";
import type { MatchupPlan } from "@/types";

interface MatchupPageProps {
  params: Promise<{ teamId: string; opponentId: string }>;
}

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
  const selectedRegulationId = team?.regulationIds[0] ?? REGULATIONS[0]?.id ?? "";
  const reportHref = `/teams/${teamId}?tab=matchups`;
  const backHref = fromPlanner ? "/matchup-planner" : reportHref;
  const backLabel = fromPlanner ? t.matchupPage.backToPlanner : t.matchupPage.backToReport;

  function updatePlan(updater: (plan: MatchupPlan) => MatchupPlan) {
    updateOpponentPlan(opponentId, teamId, updater);
  }

  const isLoading = isTeamsLoading || isOpponentsLoading;

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
        <MatchupView
          team={team}
          opponent={opponent}
          plan={plan}
          mainLabel={mainLabel}
          copiedFromLabel={copiedFromLabel}
          backHref={backHref}
          backLabel={backLabel}
          calcsHref={`/teams/${teamId}?tab=calcs`}
          onUpdatePlan={updatePlan}
        />
      )}
    </div>
  );
}
