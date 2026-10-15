"use client";

import { Suspense } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { DamageCalculator } from "@/components/DamageCalculator";
import { REGULATIONS } from "@/data/regulations";
import { useMessages } from "@/hooks/useLanguage";

export default function DamageCalcPage() {
  const t = useMessages();
  // One instance shared with the calculator, so a calc it saves onto a team
  // isn't overwritten by the header's own (otherwise separate) copy.
  const myTeams = useMyTeams();
  const {
    activeTeams,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
  } = myTeams;
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
        currentPage="damage-calc"
        selectedRegulationId={REGULATIONS[0]?.id ?? ""}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex w-full flex-col gap-4 p-6">
        {/* Below xl the title sits in the calculator's sticky bar instead. */}
        <h2 className="hidden text-xl font-semibold text-zinc-900 xl:block">{t.calc.title}</h2>
        {/* DamageCalculator reads ?opponentId= via useSearchParams — Next.js
            requires a Suspense boundary around any client component that
            does, so a static build doesn't fail with a missing-Suspense
            error (see the "Prerendering" section of useSearchParams' docs). */}
        <Suspense fallback={null}>
          <DamageCalculator myTeams={myTeams} />
        </Suspense>
      </div>
    </div>
  );
}
