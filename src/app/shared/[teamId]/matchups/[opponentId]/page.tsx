"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useLanguage";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { MatchupView } from "@/components/MatchupView";
import { LoadingState } from "@/components/LoadingState";
import { getSharedMatchups, getSharedTeam } from "@/lib/firebase";
import { getPlanForTeam } from "@/lib/opponent";
import { sharedMatchupAsOpponent, sharedTeamAsTeam, sharedTeamPath } from "@/lib/sharedTeam";
import { REGULATIONS } from "@/data/regulations";
import type { Opponent, Team } from "@/types";

interface SharedMatchupPageProps {
  params: Promise<{ teamId: string; opponentId: string }>;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; team: Team; opponent: Opponent; mainLabel?: string };

/**
 * One matchup of a shared Team Report, read only — the owner's matchup
 * page as anyone with the link sees it (docs/full-share.md). Only there
 * while the team is shared with its matchups.
 */
export default function SharedMatchupPage({ params }: SharedMatchupPageProps) {
  const { teamId, opponentId } = use(params);
  const t = useMessages();
  const {
    activeTeams,
    activeTeamId,
    isLoading: isTeamsLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
  } = useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<LoadState> {
      const shared = await getSharedTeam(teamId);
      if (!shared?.sections?.includes("matchups")) return { kind: "missing" };
      // All of them (one read), for a variant's main's label.
      const matchups = await getSharedMatchups(teamId);
      const matchup = matchups.find((m) => m.id === opponentId);
      if (!matchup) return { kind: "missing" };
      return {
        kind: "ready",
        team: sharedTeamAsTeam(shared),
        opponent: sharedMatchupAsOpponent(matchup, teamId),
        mainLabel: matchup.variantOf
          ? matchups.find((m) => m.id === matchup.variantOf)?.label
          : undefined,
      };
    }
    load()
      .then((loaded) => {
        if (!cancelled) setState(loaded);
      })
      .catch((error) => {
        console.error("[shared matchup] load failed:", error);
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, opponentId]);

  const backHref = `${sharedTeamPath(teamId)}?tab=matchups`;

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
      ) : state.kind !== "ready" ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">
            {state.kind === "missing" ? t.sharedPage.matchupNotShared : t.sharedPage.loadFailed}
          </p>
          <p className="text-sm text-zinc-600">
            {state.kind === "missing"
              ? t.sharedPage.matchupNotSharedBody
              : t.sharedPage.loadFailedBody}
          </p>
          <Link
            href={sharedTeamPath(teamId)}
            className="text-sm font-medium text-zinc-600 hover:underline"
          >
            ← {t.sharedPage.backToShared}
          </Link>
        </div>
      ) : (
        <MatchupView
          team={state.team}
          opponent={state.opponent}
          plan={getPlanForTeam(state.opponent, teamId)}
          mainLabel={state.mainLabel}
          backHref={backHref}
          backLabel={t.sharedPage.backToShared}
        />
      )}
    </div>
  );
}
