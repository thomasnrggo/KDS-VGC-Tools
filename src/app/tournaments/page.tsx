"use client";

import { useState } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTournaments } from "@/hooks/useTournaments";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { TournamentsSection } from "@/components/TournamentsSection";
import { REGULATIONS } from "@/data/regulations";

export default function TournamentsPage() {
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
  const {
    tournaments,
    isLoading: isTournamentsLoading,
    addTournament,
    removeTournament,
  } = useTournaments();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [selectedRegulationId, setSelectedRegulationId] = useState(REGULATIONS[0]?.id ?? "");

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
        currentPage="tournaments"
        selectedRegulationId={selectedRegulationId}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex w-full flex-col gap-6 px-3 py-4 sm:p-6">
        <TournamentsSection
          tournaments={tournaments}
          teams={teams}
          isLoading={isTeamsLoading || isTournamentsLoading}
          addTournament={addTournament}
          removeTournament={removeTournament}
          selectedRegulationId={selectedRegulationId}
          setSelectedRegulationId={setSelectedRegulationId}
        />
      </div>
    </div>
  );
}
