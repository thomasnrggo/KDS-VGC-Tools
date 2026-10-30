"use client";

import { use } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useLanguage";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { LoadingState } from "@/components/LoadingState";
import { TeamBuilder } from "@/components/TeamBuilder";
import { toast } from "@/components/Toast";
import { REGULATIONS } from "@/data/regulations";
import { removePokemonEverywhere } from "@/lib/removeTeamPokemon";
import { teamWithoutSlot } from "@/lib/rosterSlots";

interface EditTeamPageProps {
  params: Promise<{ teamId: string }>;
}

/** A saved team in the Team Builder — reached from its Team Report page (or right after creating it, see /team-builder). */
export default function EditTeamPage({ params }: EditTeamPageProps) {
  const { teamId } = use(params);
  const t = useMessages();
  const {
    teams,
    activeTeams,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
    updateTeam,
  } = useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const team = teams.find((saved) => saved.id === teamId) ?? null;

  function removePokemon(index: number) {
    updateTeam(teamId, (current) => teamWithoutSlot(current, index));
    // Plans against opponents and logged games live outside the team.
    removePokemonEverywhere(teamId, index, user?.uid ?? null).catch((error) => {
      console.error("[team builder] updating picks after a removal failed:", error);
      toast.error(t.teamBuilder.removeSyncFailed);
    });
  }

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
        selectedRegulationId={team?.regulationIds[0] ?? REGULATIONS[0]?.id ?? ""}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {isLoading ? (
        <LoadingState />
      ) : !team ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">{t.teamPage.notFound}</p>
          <p className="text-sm text-zinc-600">{t.teamBuilder.notFoundBody}</p>
          <Link href="/teams" className="text-sm font-medium text-zinc-600 hover:underline">
            {t.teamPage.backToMyTeams}
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4 px-3 py-4 sm:p-6">
          <TeamBuilder
            team={team}
            heading={`${team.name} — ${t.teamBuilder.editPokemon}`}
            onChange={(updater) => updateTeam(teamId, updater)}
            onRemovePokemon={removePokemon}
            teamHref={`/teams/${teamId}`}
          />
        </div>
      )}
    </div>
  );
}
