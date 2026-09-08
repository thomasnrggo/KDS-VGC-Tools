"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTournaments } from "@/hooks/useTournaments";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { createRound, getRoundResult } from "@/lib/tournament";

interface TournamentPageProps {
  params: Promise<{ tournamentId: string }>;
}

const RESULT_LABEL: Record<ReturnType<typeof getRoundResult>, string> = {
  win: "Won",
  loss: "Lost",
  "in-progress": "In progress",
};
const RESULT_CLASSES: Record<ReturnType<typeof getRoundResult>, string> = {
  win: "text-green-700",
  loss: "text-red-600",
  "in-progress": "text-mauve-500",
};

export default function TournamentPage({ params }: TournamentPageProps) {
  const { tournamentId } = use(params);
  const router = useRouter();
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
    updateTournament,
  } = useTournaments();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();

  const tournament = tournaments.find((t) => t.id === tournamentId) ?? null;
  const team = tournament ? (teams.find((t) => t.id === tournament.teamId) ?? null) : null;
  const isLoading = isTeamsLoading || isTournamentsLoading;

  function addRound() {
    if (!tournament) return;
    const round = createRound(`Round ${tournament.rounds.length + 1}`);
    updateTournament(tournamentId, (t) => ({ ...t, rounds: [...t.rounds, round] }));
    router.push(`/tournaments/${tournamentId}/rounds/${round.id}`);
  }

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
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {isLoading ? (
        <p className="p-6 text-sm text-mauve-500">Loading…</p>
      ) : !tournament ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-mauve-900">Tournament not found</p>
          <p className="text-sm text-mauve-600">It may have been removed on another device.</p>
          <Link href="/tournaments" className="text-sm font-medium text-mauve-600 hover:underline">
            ← Back to Tournaments
          </Link>
        </div>
      ) : (
        <div className="flex w-full max-w-3xl flex-col gap-6 p-6">
          <div className="flex items-center gap-2">
            <Link
              href="/tournaments"
              aria-label="Back to Tournaments"
              title="Back to Tournaments"
              className="flex h-8 w-8 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700"
            >
              <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
            </Link>
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold text-mauve-900">{tournament.name}</h1>
              <span className="text-xs text-mauve-500">
                {team?.name ?? "Unknown team"}
                {team && (
                  <>
                    {" · "}
                    <Link href={`/teams/${team.id}`} className="hover:underline">
                      Team Report
                    </Link>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-mauve-900">Rounds</h2>
            <button
              type="button"
              onClick={addRound}
              className="rounded-full bg-mauve-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
            >
              Add round
            </button>
          </div>

          {tournament.rounds.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-mauve-300 bg-mauve-50 px-6 py-10 text-center text-sm text-mauve-600">
              No rounds logged yet — add one when your first match starts.
            </p>
          ) : (
            <ul className="flex flex-col">
              {tournament.rounds.map((round, index) => {
                const result = getRoundResult(round);
                return (
                  <li
                    key={round.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/tournaments/${tournamentId}/rounds/${round.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/tournaments/${tournamentId}/rounds/${round.id}`);
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-4 p-4 ${
                      index % 2 === 0 ? "bg-mauve-200" : "bg-mauve-100"
                    }`}
                  >
                    <span className="text-sm font-semibold text-mauve-900">{round.label}</span>
                    <span className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${RESULT_CLASSES[result]}`}>
                        {RESULT_LABEL[result]}
                      </span>
                      <Icon name={IconName.ExpandMore} size={18} className="-rotate-90 text-mauve-400" />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
