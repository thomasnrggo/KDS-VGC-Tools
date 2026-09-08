"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTournaments } from "@/hooks/useTournaments";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { OpponentPokemonCard } from "@/components/OpponentPokemonCard";
import { TournamentGameCard } from "@/components/TournamentGameCard";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { parseRoundOpponentTeam } from "@/lib/tournament";
import type { TournamentGame, TournamentRound } from "@/types";

interface RoundPageProps {
  params: Promise<{ tournamentId: string; roundId: string }>;
}

export default function RoundPage({ params }: RoundPageProps) {
  const { tournamentId, roundId } = use(params);
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
  const { tournaments, isLoading: isTournamentsLoading, updateTournament } = useTournaments();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [rosterDraft, setRosterDraft] = useState("");

  const tournament = tournaments.find((t) => t.id === tournamentId) ?? null;
  const round = tournament?.rounds.find((r) => r.id === roundId) ?? null;
  const team = tournament ? (teams.find((t) => t.id === tournament.teamId) ?? null) : null;
  const isLoading = isTeamsLoading || isTournamentsLoading;

  function updateRound(updater: (round: TournamentRound) => TournamentRound) {
    updateTournament(tournamentId, (t) => ({
      ...t,
      rounds: t.rounds.map((r) => (r.id === roundId ? updater(r) : r)),
    }));
  }

  function updateGame(gameIndex: number, updater: (game: TournamentGame) => TournamentGame) {
    updateRound((r) => ({
      ...r,
      games: r.games.map((g, i) => (i === gameIndex ? updater(g) : g)) as TournamentRound["games"],
    }));
  }

  function openRosterEditor() {
    setRosterDraft(round?.opponentRawPaste ?? "");
    setIsEditingRoster(true);
  }

  function saveRoster() {
    const trimmed = rosterDraft.trim();
    updateRound((r) => ({
      ...r,
      opponentRawPaste: trimmed,
      opponentTeam: trimmed ? parseRoundOpponentTeam(trimmed) : [],
    }));
    setIsEditingRoster(false);
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
      ) : !tournament || !round ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-mauve-900">Round not found</p>
          <p className="text-sm text-mauve-600">It may have been removed on another device.</p>
          <Link href="/tournaments" className="text-sm font-medium text-mauve-600 hover:underline">
            ← Back to Tournaments
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6 p-6">
          <div className="flex items-center gap-2">
            <Link
              href={`/tournaments/${tournamentId}`}
              aria-label="Back to tournament"
              title="Back to tournament"
              className="flex h-8 w-8 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700"
            >
              <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
            </Link>
            <h1 className="text-xl font-semibold text-mauve-900">
              {round.label} — {tournament.name}
            </h1>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mauve-900">Opponent&apos;s team</h2>
              <button
                type="button"
                onClick={openRosterEditor}
                className="rounded-full border border-mauve-300 px-3 py-1 text-xs font-medium text-mauve-700 hover:bg-mauve-100"
              >
                {round.opponentTeam.length > 0 ? "Edit roster" : "Add roster"}
              </button>
            </div>
            {round.opponentTeam.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-mauve-300 bg-mauve-50 px-6 py-8 text-center text-sm text-mauve-600">
                Paste whatever the team sheet revealed — species, item, ability, nature, and moves.
                Stat Points aren&apos;t usually shown, so that&apos;s fine to leave out.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {round.opponentTeam.map((mon, index) => (
                  <OpponentPokemonCard
                    key={`${mon.species}-${index}`}
                    pokemon={mon}
                    note={round.opponentPokemonNotes?.[index] ?? ""}
                    onNoteChange={(note) =>
                      updateRound((r) => ({
                        ...r,
                        opponentPokemonNotes: { ...r.opponentPokemonNotes, [index]: note },
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {team && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {round.games.map((game, index) => (
                <TournamentGameCard
                  key={game.id}
                  label={`Game ${index + 1}`}
                  game={game}
                  opponentTeam={round.opponentTeam}
                  myTeam={team.pokemon}
                  onUpdate={(updater) => updateGame(index, updater)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {isEditingRoster && (
        <Modal onClose={() => setIsEditingRoster(false)} labelledBy="edit-roster-modal-title">
          <h2 id="edit-roster-modal-title" className="mb-4 text-lg font-semibold text-mauve-900">
            Opponent&apos;s team
          </h2>
          <div className="flex flex-col gap-3">
            <textarea
              value={rosterDraft}
              onChange={(event) => setRosterDraft(event.target.value)}
              rows={16}
              placeholder="Paste whatever the team sheet revealed — Stat Points are optional…"
              aria-label="Opponent's team"
              className="w-full resize-y rounded-lg border border-mauve-300 bg-white p-3 font-mono text-sm text-mauve-900 focus:outline-none focus:ring-2 focus:ring-mauve-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveRoster}
                className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingRoster(false)}
                className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
