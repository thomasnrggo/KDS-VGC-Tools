"use client";

import { useState } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { OpponentsSection } from "@/components/OpponentsSection";
import { REGULATIONS } from "@/data/regulations";

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
  const [selectedRegulationId, setSelectedRegulationId] = useState(
    REGULATIONS[0]?.id ?? "",
  );
  // The active team is never auto-swapped just because the regulation filter
  // changed (see MyTeamHeader) — but Lead/Back picking is blocked whenever it
  // doesn't match, rather than letting you build a plan against a team that
  // isn't actually legal for the regulation you're viewing.
  const activeTeamMatchesRegulation = activeTeam
    ? activeTeam.regulationIds.includes(selectedRegulationId)
    : false;

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
        selectedRegulationId={selectedRegulationId}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex w-full flex-col gap-6 p-6">
        <OpponentsSection
          myTeamPokemon={activeTeam?.pokemon ?? []}
          activeTeamId={activeTeamId}
          activeTeamMatchesRegulation={activeTeamMatchesRegulation}
          selectedRegulationId={selectedRegulationId}
          setSelectedRegulationId={setSelectedRegulationId}
        />
      </div>
    </div>
  );
}
