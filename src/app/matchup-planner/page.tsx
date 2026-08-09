"use client";

import { useMyTeams } from "@/hooks/useMyTeams";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { OpponentsSection } from "@/components/OpponentsSection";

export default function MatchupPlanner() {
  const { teams, activeTeam, activeTeamId, isLoading, addTeam, editTeam, removeTeam, setActiveTeamId } =
    useMyTeams();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <MyTeamHeader
        teams={teams}
        activeTeamId={activeTeamId}
        isLoading={isLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
      />
      <div className="flex flex-1 flex-col items-center px-6 py-10">
        <div className="flex w-full flex-col gap-10">
          <OpponentsSection myTeamPokemon={activeTeam?.pokemon ?? []} activeTeamId={activeTeamId} />
        </div>
      </div>
    </div>
  );
}
