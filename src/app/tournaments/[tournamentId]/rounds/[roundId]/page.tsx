"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTournaments } from "@/hooks/useTournaments";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { OpponentPokemonCard } from "@/components/OpponentPokemonCard";
import { TournamentGameCard } from "@/components/TournamentGameCard";
import { RoundSpeedLine } from "@/components/RoundSpeedLine";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { parseRoundOpponentTeam } from "@/lib/tournament";
import { REGULATIONS } from "@/data/regulations";
import { isAdminUid } from "@/lib/admin";
import type { TournamentGame, TournamentRound } from "@/types";
import { useMessages } from "@/hooks/useLanguage";

interface RoundPageProps {
  params: Promise<{ tournamentId: string; roundId: string }>;
}

export default function RoundPage({ params }: RoundPageProps) {
  const { tournamentId, roundId } = use(params);
  const t = useMessages();
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
  const isAdmin = isAdminUid(user?.uid);
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [rosterDraft, setRosterDraft] = useState("");

  const tournament = tournaments.find((t) => t.id === tournamentId) ?? null;
  const round = tournament?.rounds.find((r) => r.id === roundId) ?? null;
  const team = tournament ? (teams.find((t) => t.id === tournament.teamId) ?? null) : null;
  const isLoading = isTeamsLoading || isTournamentsLoading;
  // No regulation selector on this page (it's one specific round) — default
  // the header switcher to whichever regulation the parent tournament was
  // recorded under.
  const selectedRegulationId = tournament?.regulationId ?? REGULATIONS[0]?.id ?? "";

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

  /** Toggles a walkover/bye win on/off — clicking the already-active option clears it back to the normal (game-count-based) result. */
  function setRoundOutcome(outcome: "walkover" | "bye") {
    updateRound((r) => {
      const next = { ...r };
      if (next.roundOutcome === outcome) {
        delete next.roundOutcome;
      } else {
        next.roundOutcome = outcome;
      }
      return next;
    });
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
        selectedRegulationId={selectedRegulationId}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {isLoading ? (
        <p className="p-6 text-sm text-zinc-500">{t.common.loading}</p>
      ) : !tournament || !round ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">{t.round.notFound}</p>
          <p className="text-sm text-zinc-600">{t.tournament.notFoundBody}</p>
          <Link href="/tournaments" className="text-sm font-medium text-zinc-600 hover:underline">
            {t.tournament.backLink}
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6 p-6">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link
                  href={`/tournaments/${tournamentId}`}
                  aria-label={t.round.back}
                  title={t.round.back}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
                </Link>
                <h1 className="text-xl font-semibold text-zinc-900">
                  {round.label} — {tournament.name}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRoundOutcome("walkover")}
                  aria-pressed={round.roundOutcome === "walkover"}
                  title={t.round.walkoverHint}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    round.roundOutcome === "walkover"
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-zinc-300 text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  {t.round.walkover}
                </button>
                <button
                  type="button"
                  onClick={() => setRoundOutcome("bye")}
                  aria-pressed={round.roundOutcome === "bye"}
                  title={t.round.byeHint}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    round.roundOutcome === "bye"
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-zinc-300 text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  {t.round.bye}
                </button>
              </div>
            </div>
            {round.roundOutcome && (
              <p className="text-xs text-zinc-500">
                {t.round.decidedNotice}
              </p>
            )}
          </div>

          {/* A bye has no opponent by definition — skip the roster section entirely rather
              than show an empty-state prompt to paste a team that will never exist. */}
          {round.roundOutcome !== "bye" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">{t.round.opponentTeam}</h2>
                <button
                  type="button"
                  onClick={openRosterEditor}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  {round.opponentTeam.length > 0 ? t.round.editRoster : t.round.addRoster}
                </button>
              </div>
              {round.opponentTeam.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-600">
                  {t.round.rosterHint}
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
          )}

          {isAdmin && team && round.opponentTeam.length > 0 && (
            <RoundSpeedLine myTeam={team.pokemon} opponentTeam={round.opponentTeam} />
          )}

          {team && round.roundOutcome ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-600">
              {t.round.noGames(round.roundOutcome)}
            </p>
          ) : (
            team && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {round.games.map((game, index) => (
                  <TournamentGameCard
                    key={game.id}
                    label={t.round.game(index + 1)}
                    game={game}
                    opponentTeam={round.opponentTeam}
                    myTeam={team.pokemon}
                    onUpdate={(updater) => updateGame(index, updater)}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {isEditingRoster && (
        <Modal onClose={() => setIsEditingRoster(false)} labelledBy="edit-roster-modal-title">
          <h2 id="edit-roster-modal-title" className="mb-4 text-lg font-semibold text-zinc-900">
            {t.round.opponentTeam}
          </h2>
          <div className="flex flex-col gap-3">
            <textarea
              value={rosterDraft}
              onChange={(event) => setRosterDraft(event.target.value)}
              rows={16}
              placeholder={t.round.rosterPlaceholder}
              aria-label={t.round.opponentTeam}
              className="w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveRoster}
                className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
              >
                {t.common.save}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingRoster(false)}
                className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
