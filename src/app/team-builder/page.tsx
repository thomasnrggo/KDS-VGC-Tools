"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { TeamRoster } from "@/components/TeamRoster";
import { REGULATIONS } from "@/data/regulations";
import { Button } from "@/components/Button";

export default function TeamBuilderPage() {
  const router = useRouter();
  const {
    activeTeams,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
    addBlankTeam,
  } = useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();

  function createTeamAndOpen() {
    const newTeam = addBlankTeam(`Team ${activeTeams.length + 1}`, REGULATIONS[0].id);
    router.push(`/team-builder/${newTeam.id}`);
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
        currentPage="team-builder"
        selectedRegulationId={REGULATIONS[0]?.id ?? ""}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      <div className="flex w-full flex-col gap-6 px-3 py-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Team Builder</h2>
            <p className="text-sm text-zinc-600">
              Build a team from scratch, or open any existing team here to edit its species, items,
              abilities, moves, and Stat Points directly.
            </p>
          </div>
          <Button onClick={createTeamAndOpen} className="shrink-0">
            New team
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : activeTeams.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No teams yet — start one with &quot;New team&quot; above, or paste one in{" "}
            <Link href="/teams" className="font-medium text-zinc-600 hover:underline">
              My Teams
            </Link>{" "}
            first.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {activeTeams.map((team) => (
              <Link
                key={team.id}
                href={`/team-builder/${team.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="truncate text-sm font-semibold text-zinc-900">{team.name}</span>
                  {team.pokemon.length > 0 ? (
                    <TeamRoster pokemon={team.pokemon} />
                  ) : (
                    <span className="text-xs text-zinc-500">
                      Empty roster — click to add Pokémon.
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium text-zinc-500">
                  Edit in builder →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
