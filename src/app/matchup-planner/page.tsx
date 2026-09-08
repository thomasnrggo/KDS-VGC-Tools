"use client";

import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { MyTeamSection } from "@/components/MyTeamSection";
import { OpponentsSection } from "@/components/OpponentsSection";

export default function MatchupPlanner() {
  const {
    activeTeams,
    activeTeam,
    activeTeamId,
    isLoading,
    addTeam,
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
        currentPage="matchup-planner"
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex w-full flex-col gap-6 p-6">
        <MyTeamSection teams={activeTeams} isLoading={isLoading} addTeam={addTeam} />
        <OpponentsSection
          myTeamPokemon={activeTeam?.pokemon ?? []}
          activeTeamId={activeTeamId}
        />
      </div>
    </div>
  );
}
