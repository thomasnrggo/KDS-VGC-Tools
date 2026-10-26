"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Team, Tournament } from "@/types";
import { REGULATIONS } from "@/data/regulations";
import { getTournamentRecord, isTournamentCompleted } from "@/lib/tournament";
import { isTeamArchived } from "@/lib/team";
import { Modal, ModalTitle } from "../Modal";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/Button";
import { LoadingState } from "@/components/LoadingState";

interface TournamentsSectionProps {
  tournaments: Tournament[];
  /** Every team, active or archived — an existing tournament still needs to resolve/display the team it was created with even if that team's since been archived (see `activeTeams` below for the create-tournament picker, which excludes them). */
  teams: Team[];
  isLoading: boolean;
  addTournament: (name: string, teamId: string, regulationId: string) => Tournament;
  removeTournament: (id: string) => void;
  /** Lifted up to the page (see tournaments/page.tsx) so MyTeamHeader's team switcher can scope its offered list to the same regulation this section's list is already filtered by. */
  selectedRegulationId: string;
  setSelectedRegulationId: (id: string) => void;
}

/** "Tournaments" list page's content — mirrors MyTeamsSection's shape, simplified further (no search — not asked for). A tournament records whichever regulation was selected when it was started (a real event happened under one specific ruleset), using a team tagged as legal for that regulation — so the switcher here scopes both the visible tournament list and which teams the "Add tournament" picker offers, the same way MyTeamsSection's switcher scopes its team list, except a team can be offered here for more than one regulation if it's tagged for several (see TeamRegulationTags). Each row navigates to /tournaments/[id] on click. */
export function TournamentsSection({
  tournaments,
  teams,
  isLoading,
  addTournament,
  removeTournament,
  selectedRegulationId,
  setSelectedRegulationId,
}: TournamentsSectionProps) {
  const t = useMessages();
  const router = useRouter();
  // Only active teams are offered when starting a new tournament — same
  // reasoning as the team switcher (see PLANNING.md) — further scoped to
  // teams tagged for the selected regulation (see TeamRegulationTags), so a
  // team built under M-B but also tagged M-C-legal shows up here too.
  const activeTeams = teams.filter((team) => !isTeamArchived(team));
  const regulationActiveTeams = activeTeams.filter((team) =>
    team.regulationIds.includes(selectedRegulationId),
  );
  const regulationTournaments = tournaments.filter(
    (tournament) => tournament.regulationId === selectedRegulationId,
  );
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(regulationActiveTeams[0]?.id ?? "");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  function openAdd() {
    setName("");
    setTeamId(regulationActiveTeams[0]?.id ?? "");
    setIsAdding(true);
  }

  function handleAddSubmit() {
    const team = regulationActiveTeams.find((t) => t.id === teamId);
    if (!team) return;
    // The tournament is recorded under whichever regulation was selected
    // when it was started, not just any regulation the team happens to be
    // tagged with — a real event was played under one specific ruleset.
    const tournament = addTournament(name, team.id, selectedRegulationId);
    setIsAdding(false);
    router.push(`/tournaments/${tournament.id}`);
  }

  const confirmRemoveTournament = confirmRemoveId
    ? (tournaments.find((t) => t.id === confirmRemoveId) ?? null)
    : null;

  const regulationControl =
    REGULATIONS.length > 1 ? (
      <div className="relative shrink-0">
        <select
          value={selectedRegulationId}
          onChange={(event) => setSelectedRegulationId(event.target.value)}
          aria-label={t.common.regulation}
          className="appearance-none rounded-full border border-zinc-300 bg-zinc-50 py-1 pr-8 pl-3 text-xs font-medium text-zinc-700"
        >
          {REGULATIONS.map((regulation) => (
            <option key={regulation.id} value={regulation.id}>
              {t.common.regulationLabel(regulation.label)}
            </option>
          ))}
        </select>
        <Icon
          name={IconName.ExpandMore}
          size={14}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-zinc-500"
        />
      </div>
    ) : (
      <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
        {REGULATIONS[0] && t.common.regulationLabel(REGULATIONS[0].label)}
      </span>
    );

  return (
    <section className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-zinc-900">{t.tournaments.title}</h2>
          {regulationControl}
        </div>
        <Button
          onClick={openAdd}
          disabled={regulationActiveTeams.length === 0}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.tournaments.add}
        </Button>
      </div>

      {isAdding && (
        <Modal onClose={() => setIsAdding(false)} labelledBy="add-tournament-modal-title">
          <ModalTitle id="add-tournament-modal-title" className="mb-4">
            {t.tournaments.addTitle}
          </ModalTitle>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.tournaments.namePlaceholder}
              aria-label={t.tournaments.nameLabel}
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
            />
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              {t.tournaments.team}
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900"
              >
                {regulationActiveTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <Button
                onClick={handleAddSubmit}
                disabled={!teamId}
                className="disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.tournaments.create}
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmRemoveTournament && (
        <Modal
          onClose={() => setConfirmRemoveId(null)}
          labelledBy="confirm-remove-tournament-title"
        >
          <h2
            id="confirm-remove-tournament-title"
            className="mb-2 text-lg font-semibold text-zinc-900"
          >
            {t.tournaments.removeTitle(confirmRemoveTournament.name)}
          </h2>
          <p className="mb-4 text-sm text-zinc-600">{t.tournaments.removeBody}</p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={() => {
                removeTournament(confirmRemoveTournament.id);
                setConfirmRemoveId(null);
              }}
            >
              {t.tournaments.remove}
            </Button>
            <Button variant="outline" onClick={() => setConfirmRemoveId(null)}>
              {t.common.cancel}
            </Button>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <LoadingState />
      ) : regulationActiveTeams.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center text-sm text-zinc-600">
          {activeTeams.length === 0 ? t.tournaments.needTeam : t.tournaments.needRegulationTeam}
        </p>
      ) : regulationTournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-zinc-900">{t.tournaments.empty}</h3>
          <p className="max-w-md text-sm text-zinc-600">{t.tournaments.emptyBody}</p>
          <Button onClick={openAdd}>{t.tournaments.add}</Button>
        </div>
      ) : (
        <ul className="flex flex-col">
          {regulationTournaments.map((tournament, index) => {
            const record = getTournamentRecord(tournament);
            const team = teams.find((t) => t.id === tournament.teamId);
            return (
              <li
                key={tournament.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/tournaments/${tournament.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/tournaments/${tournament.id}`);
                  }
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-4 p-4",
                  index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100",
                )}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-zinc-900">
                    {tournament.name}
                  </span>
                  <span className="truncate text-xs text-zinc-500">
                    {team?.name ?? t.tournaments.unknownTeam} ·{" "}
                    {t.tournaments.rounds(tournament.rounds.length)} · {record.wins}-{record.losses}
                    -{record.ties}
                  </span>
                  {/* Final standing details only mean anything once the event is over — an
                      in-progress tournament's participant count/placement are usually still
                      unset anyway, so this line only appears once there's something to show. */}
                  {isTournamentCompleted(tournament) &&
                    (tournament.participantCount || tournament.placement) && (
                      <span className="truncate text-xs text-zinc-500">
                        {tournament.participantCount
                          ? t.tournaments.entrants(tournament.participantCount)
                          : null}
                        {tournament.participantCount && tournament.placement ? " · " : null}
                        {tournament.placement ? t.tournaments.placed(tournament.placement) : null}
                      </span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmRemoveId(tournament.id);
                    }}
                    aria-label={t.tournaments.removeNamed(tournament.name)}
                    title={t.tournaments.remove}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Icon name={IconName.Delete} size={16} />
                  </button>
                  <Icon name={IconName.ExpandMore} size={20} className="-rotate-90 text-zinc-400" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
