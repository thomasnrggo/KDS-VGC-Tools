"use client";

import { useState } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { MyTeamsSection } from "@/components/MyTeamsSection";
import { REGULATIONS } from "@/data/regulations";

export default function TeamsPage() {
  const {
    teams,
    activeTeams,
    activeTeamId,
    isLoading,
    addTeam,
    duplicateTeam,
    editTeam,
    updateTeam,
    removeTeam,
    archiveTeam,
    unarchiveTeam,
    setActiveTeamId,
    reorderTeams,
  } = useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [selectedRegulationId, setSelectedRegulationId] = useState(REGULATIONS[0]?.id ?? "");

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
      <div className="flex w-full flex-col gap-6 px-3 py-4 sm:p-6">
        <MyTeamsSection
          teams={teams}
          isLoading={isLoading}
          addTeam={addTeam}
          duplicateTeam={duplicateTeam}
          updateTeam={updateTeam}
          removeTeam={removeTeam}
          archiveTeam={archiveTeam}
          unarchiveTeam={unarchiveTeam}
          reorderTeams={reorderTeams}
          selectedRegulationId={selectedRegulationId}
          setSelectedRegulationId={setSelectedRegulationId}
        />
      </div>
    </div>
  );
}
