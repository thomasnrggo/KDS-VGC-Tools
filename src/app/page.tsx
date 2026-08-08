"use client";

import { useMyTeam } from "@/hooks/useMyTeam";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { OpponentsSection } from "@/components/OpponentsSection";

export default function Home() {
  const { team, isLoading, saveFromPaste, clearTeam } = useMyTeam();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <MyTeamHeader
        team={team}
        isLoading={isLoading}
        saveFromPaste={saveFromPaste}
        onClear={clearTeam}
      />
      <div className="flex flex-1 flex-col items-center px-6 py-10">
        <div className="flex w-full flex-col gap-10">
          <OpponentsSection myTeamPokemon={team?.pokemon ?? []} hasMyTeam={!!team} />
        </div>
      </div>
    </div>
  );
}
