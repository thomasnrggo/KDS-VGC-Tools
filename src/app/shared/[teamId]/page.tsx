"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useLanguage";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { PokemonReportCard } from "@/components/PokemonReportCard";
import { TeamPost } from "@/components/TeamPost";
import { getSharedTeam } from "@/lib/firebase";
import { REGULATIONS } from "@/data/regulations";
import type { SharedTeam } from "@/types";
import { LoadingState } from "@/components/LoadingState";

interface SharedTeamPageProps {
  params: Promise<{ teamId: string }>;
}

/**
 * A shared Team Report, as anyone with the link sees it — no sign-in
 * needed. Reads the public copy (see SharedTeam / toSharedTeam), so it only
 * ever has what the owner chose to share: an open team sheet has no Stat
 * Points or nature, and so no stats.
 */
export default function SharedTeamPage({ params }: SharedTeamPageProps) {
  const t = useMessages();
  const { teamId } = use(params);
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
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "missing" }
    | { kind: "error" }
    | { kind: "ready"; team: SharedTeam }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getSharedTeam(teamId)
      .then((team) => {
        if (!cancelled) setState(team ? { kind: "ready", team } : { kind: "missing" });
      })
      .catch((error) => {
        console.error("[shared team] load failed:", error);
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

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
            name={state.team.name}
            creator={state.team.creator}
            pokepasteUrl={state.team.pokepasteUrl}
            replicaCode={state.team.replicaCode}
            overview={state.team.overview}
            status={state.team.sheet === "open" ? t.share.openSheet : t.share.closedSheet}
          />

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {state.team.pokemon.map((mon, index) => (
              <PokemonReportCard
                key={`${mon.species}-${index}`}
                pokemon={mon}
                sheet={state.team.sheet}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
