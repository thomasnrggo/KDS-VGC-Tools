"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTournaments } from "@/hooks/useTournaments";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { OpponentTeamPreview } from "@/components/OpponentTeamPreview";
import { Modal } from "@/components/Modal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import {
  completeTournament,
  createRound,
  getRoundResult,
  isTournamentCompleted,
  reopenTournament,
} from "@/lib/tournament";
import { REGULATIONS } from "@/data/regulations";
import type { Tournament } from "@/types";
import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/Button";
import { LoadingState } from "@/components/LoadingState";

interface TournamentPageProps {
  params: Promise<{ tournamentId: string }>;
}

const RESULT_CLASSES: Record<ReturnType<typeof getRoundResult>, string> = {
  win: "text-green-700",
  loss: "text-red-600",
  tie: "text-amber-600",
  "in-progress": "text-zinc-500",
};

export default function TournamentPage({ params }: TournamentPageProps) {
  const { tournamentId } = use(params);
  const t = useMessages();
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
  const { tournaments, isLoading: isTournamentsLoading, updateTournament } = useTournaments();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [participantsDraft, setParticipantsDraft] = useState("");
  const [placementDraft, setPlacementDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");

  const tournament = tournaments.find((t) => t.id === tournamentId) ?? null;
  // No regulation selector on this page (it's one specific tournament) —
  // default the header switcher to whichever regulation this tournament
  // itself was recorded under.
  const selectedRegulationId = tournament?.regulationId ?? REGULATIONS[0]?.id ?? "";
  const team = tournament ? (teams.find((t) => t.id === tournament.teamId) ?? null) : null;
  const isLoading = isTeamsLoading || isTournamentsLoading;
  const completed = tournament ? isTournamentCompleted(tournament) : false;

  function addRound() {
    if (!tournament || isTournamentCompleted(tournament)) return;
    const round = createRound(t.tournament.defaultRoundLabel(tournament.rounds.length + 1));
    updateTournament(tournamentId, (t) => ({ ...t, rounds: [...t.rounds, round] }));
    router.push(`/tournaments/${tournamentId}/rounds/${round.id}`);
  }

  function toggleCompleted() {
    updateTournament(tournamentId, (t) =>
      isTournamentCompleted(t) ? reopenTournament(t) : completeTournament(t),
    );
  }

  function openDetailsEditor() {
    if (!tournament) return;
    setParticipantsDraft(tournament.participantCount?.toString() ?? "");
    setPlacementDraft(tournament.placement?.toString() ?? "");
    setUrlDraft(tournament.tournamentUrl ?? "");
    setIsEditingDetails(true);
  }

  /** Blank fields clear their field entirely rather than writing 0/"" — same "absent means unset" convention Team.archivedAt uses. */
  function saveDetails() {
    const participantCount = participantsDraft.trim() ? Number(participantsDraft) : undefined;
    const placement = placementDraft.trim() ? Number(placementDraft) : undefined;
    const tournamentUrl = urlDraft.trim() || undefined;
    updateTournament(tournamentId, (t) => {
      const next: Tournament = { ...t };
      if (participantCount !== undefined && !Number.isNaN(participantCount)) {
        next.participantCount = participantCount;
      } else {
        delete next.participantCount;
      }
      if (placement !== undefined && !Number.isNaN(placement)) {
        next.placement = placement;
      } else {
        delete next.placement;
      }
      if (tournamentUrl !== undefined) {
        next.tournamentUrl = tournamentUrl;
      } else {
        delete next.tournamentUrl;
      }
      return next;
    });
    setIsEditingDetails(false);
  }

  const detailParts: string[] = [];
  if (tournament?.participantCount) {
    detailParts.push(t.tournaments.entrants(tournament.participantCount));
  }
  if (tournament?.placement) detailParts.push(t.tournaments.placed(tournament.placement));

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
        <LoadingState />
      ) : !tournament ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">{t.tournament.notFound}</p>
          <p className="text-sm text-zinc-600">{t.tournament.notFoundBody}</p>
          <Link href="/tournaments" className="text-sm font-medium text-zinc-600 hover:underline">
            {t.tournament.backLink}
          </Link>
        </div>
      ) : (
        <div className="flex w-full max-w-3xl flex-col gap-6 px-3 py-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href="/tournaments"
                aria-label={t.tournament.back}
                title={t.tournament.back}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
              </Link>
              <div className="flex flex-col">
                <h1 className="text-xl font-semibold text-zinc-900">{tournament.name}</h1>
                <span className="text-xs text-zinc-500">
                  {team?.name ?? t.tournaments.unknownTeam}
                  {team && (
                    <>
                      {" · "}
                      <Link href={`/teams/${team.id}`} className="hover:underline">
                        {t.tournament.teamReport}
                      </Link>
                    </>
                  )}
                  {detailParts.length > 0 && <> · {detailParts.join(" · ")}</>}
                  {tournament.tournamentUrl && (
                    <>
                      {" · "}
                      <a
                        href={tournament.tournamentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {t.tournament.eventLink}
                      </a>
                    </>
                  )}
                  {completed && (
                    <>
                      {" · "}
                      <span className="font-medium text-zinc-700">{t.tournament.completed}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={openDetailsEditor}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {t.tournament.editDetails}
              </button>
              <button
                type="button"
                onClick={toggleCompleted}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  completed
                    ? "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                    : "border-green-600 bg-green-600 text-white hover:bg-green-700",
                )}
              >
                {completed ? t.tournament.reopen : t.tournament.markCompleted}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">{t.tournament.rounds}</h2>
            <button
              type="button"
              onClick={addRound}
              disabled={completed}
              title={completed ? t.tournament.reopenToAdd : undefined}
              className="rounded-full bg-chrome-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-chrome-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.tournament.addRound}
            </button>
          </div>

          {tournament.rounds.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-600">
              {t.tournament.noRounds}
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
                    className={cn(
                      "grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 p-4",
                      index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100",
                    )}
                  >
                    <span className="truncate text-sm font-semibold text-zinc-900">
                      {round.label}
                    </span>
                    <OpponentTeamPreview pokemon={round.opponentTeam} />
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex items-center text-xs font-semibold",
                          RESULT_CLASSES[result],
                        )}
                      >
                        {t.tournament.result[result]}
                        {round.roundOutcome && (
                          <Tooltip>
                            <TooltipTrigger
                              render={<sup className="ml-0.5 cursor-help text-xs font-normal" />}
                            >
                              *
                            </TooltipTrigger>
                            <TooltipContent>
                              {t.tournament.outcomeHint[round.roundOutcome]}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <Icon
                        name={IconName.ExpandMore}
                        size={18}
                        className="-rotate-90 text-zinc-400"
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {isEditingDetails && (
        <Modal
          onClose={() => setIsEditingDetails(false)}
          labelledBy="edit-tournament-details-title"
        >
          <h2
            id="edit-tournament-details-title"
            className="mb-4 text-lg font-semibold text-zinc-900"
          >
            {t.tournament.details}
          </h2>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              {t.tournament.participants}
              <input
                type="number"
                min={0}
                value={participantsDraft}
                onChange={(event) => setParticipantsDraft(event.target.value)}
                placeholder={t.tournament.participantsPlaceholder}
                aria-label={t.tournament.participantsLabel}
                className="rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              {t.tournament.placement}
              <input
                type="number"
                min={1}
                value={placementDraft}
                onChange={(event) => setPlacementDraft(event.target.value)}
                placeholder={t.tournament.placementPlaceholder}
                aria-label={t.tournament.placement}
                className="rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              {t.tournament.link}
              <input
                type="url"
                value={urlDraft}
                onChange={(event) => setUrlDraft(event.target.value)}
                placeholder="https://…"
                aria-label={t.tournament.link}
                className="rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
            </label>
            <div className="flex gap-2">
              <Button onClick={saveDetails}>{t.common.save}</Button>
              <Button variant="outline" onClick={() => setIsEditingDetails(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
