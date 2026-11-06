"use client";

import { Suspense } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "../MyTeamHeader";
import { MetagameSection } from "../MetagameSection";
import { REGULATIONS } from "@/data/regulations";

/**
 * The Metagame page with the app's header — the site's home page (`/`,
 * with the intro) and `/metagame`. Suspense: MetagameSection reads its
 * view from the URL (useSearchParams).
 */
export function MetagamePage({ showIntro = false }: { showIntro?: boolean }) {
  const {
    teams,
    activeTeams,
    activeTeamId,
    isLoading,
    addTeam,
    addBuiltTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
  } = useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();

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
        currentPage="metagame"
        selectedRegulationId={REGULATIONS[0]?.id ?? ""}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex w-full flex-col gap-6 px-3 py-4 sm:p-6">
        <Suspense>
          <MetagameSection showIntro={showIntro} myTeams={teams} onAddTeam={addBuiltTeam} />
        </Suspense>
      </div>
    </div>
  );
}
