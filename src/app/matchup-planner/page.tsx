"use client";

import { useMyTeams } from "@/hooks/useMyTeams";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { MyTeamSection } from "@/components/MyTeamSection";
import { OpponentsSection } from "@/components/OpponentsSection";

export default function MatchupPlanner() {
  const {
    teams,
    activeTeam,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
  } = useMyTeams();

  return (
    <div className="flex flex-1 flex-col">
      <MyTeamHeader
        teams={teams}
        activeTeamId={activeTeamId}
        isLoading={isLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
      />
      <div className="flex w-full flex-col gap-6 p-6">
        <MyTeamSection teams={teams} isLoading={isLoading} addTeam={addTeam} />
        <OpponentsSection
          myTeamPokemon={activeTeam?.pokemon ?? []}
          activeTeamId={activeTeamId}
        />
      </div>
    </div>
  );
}
