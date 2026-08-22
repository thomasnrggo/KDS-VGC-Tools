"use client";

import { Suspense } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { DamageCalculator } from "@/components/DamageCalculator";

export default function DamageCalcPage() {
  const {
    teams,
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
        teams={teams}
        activeTeamId={activeTeamId}
        isLoading={isLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
        currentPage="damage-calc"
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex w-full flex-col gap-4 p-6">
        <h2 className="text-xl font-semibold text-mauve-900">
          Damage Calculator
        </h2>
        {/* DamageCalculator reads ?opponentId= via useSearchParams — Next.js
            requires a Suspense boundary around any client component that
            does, so a static build doesn't fail with a missing-Suspense
            error (see the "Prerendering" section of useSearchParams' docs). */}
        <Suspense fallback={null}>
          <DamageCalculator />
        </Suspense>
      </div>
    </div>
  );
}
