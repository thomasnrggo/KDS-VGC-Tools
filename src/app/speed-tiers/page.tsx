"use client";

import { useState } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { SpeedTiersTable } from "@/components/SpeedTiersTable";
import { REGULATIONS } from "@/data/regulations";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";

export default function SpeedTiersPage() {
  const {
    activeTeams,
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
  const selectedRegulation =
    REGULATIONS.find((regulation) => regulation.id === selectedRegulationId) ??
    REGULATIONS[0];

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
        currentPage="speed-tiers"
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex w-full flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-mauve-900">Speed Tiers</h2>
          {REGULATIONS.length > 1 ? (
            <div className="relative shrink-0">
              <select
                value={selectedRegulationId}
                onChange={(event) => setSelectedRegulationId(event.target.value)}
                aria-label="Regulation"
                className="appearance-none rounded-full border border-mauve-300 bg-white py-1 pl-3 pr-8 text-xs font-medium text-mauve-700"
              >
                {REGULATIONS.map((regulation) => (
                  <option key={regulation.id} value={regulation.id}>
                    {regulation.label}
                  </option>
                ))}
              </select>
              <Icon
                name={IconName.ExpandMore}
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mauve-500"
              />
            </div>
          ) : (
            <span className="shrink-0 rounded-full border border-mauve-200 bg-mauve-50 px-3 py-1 text-xs font-medium text-mauve-500">
              {REGULATIONS[0]?.label}
            </span>
          )}
        </div>
        {selectedRegulation && (
          <SpeedTiersTable
            speciesKeys={selectedRegulation.speciesKeys}
            megaStoneItemsForSpecies={selectedRegulation.megaStoneItemsForSpecies}
          />
        )}
      </div>
    </div>
  );
}
