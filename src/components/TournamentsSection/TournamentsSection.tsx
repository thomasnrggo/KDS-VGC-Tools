"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Team, Tournament } from "@/types";
import { REGULATIONS } from "@/data/regulations";
import { getTournamentRecord, isTournamentCompleted } from "@/lib/tournament";
import { isTeamArchived } from "@/lib/team";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

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
          aria-label="Regulation"
          className="appearance-none rounded-full border border-zinc-300 bg-zinc-50 py-1 pl-3 pr-8 text-xs font-medium text-zinc-700"
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
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
        />
      </div>
    ) : (
      <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
        {REGULATIONS[0]?.label}
      </span>
    );

  return (
    <section className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-zinc-900">Tournaments</h2>
          {regulationControl}
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={regulationActiveTeams.length === 0}
          className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add tournament
        </button>
      </div>

      {isAdding && (
        <Modal onClose={() => setIsAdding(false)} labelledBy="add-tournament-modal-title">
          <h2 id="add-tournament-modal-title" className="mb-4 text-lg font-semibold text-zinc-900">
            Add a tournament
          </h2>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tournament name (e.g. Regionals 2026)"
              aria-label="Tournament name"
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Team
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
              <button
                type="button"
                onClick={handleAddSubmit}
                disabled={!teamId}
                className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create tournament
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmRemoveTournament && (
        <Modal onClose={() => setConfirmRemoveId(null)} labelledBy="confirm-remove-tournament-title">
          <h2
            id="confirm-remove-tournament-title"
            className="mb-2 text-lg font-semibold text-zinc-900"
          >
            Remove {confirmRemoveTournament.name}?
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            This removes every round and game logged for this tournament — it can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                removeTournament(confirmRemoveTournament.id);
                setConfirmRemoveId(null);
              }}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Remove tournament
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemoveId(null)}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : regulationActiveTeams.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center text-sm text-zinc-600">
          {activeTeams.length === 0
            ? "Add a team on the My Teams page first — a tournament tracks your rounds with one of your saved teams."
            : "No teams under this regulation — add one on the My Teams page first, or switch to a different regulation above."}
        </p>
      ) : regulationTournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-zinc-900">No tournaments yet</h3>
          <p className="max-w-md text-sm text-zinc-600">
            Track your rounds, opponent picks, and Pokémon usage/win-loss stats across a real event.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
          >
            Add tournament
          </button>
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
                className={`flex cursor-pointer items-center justify-between gap-4 p-4 ${
                  index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100"
                }`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-zinc-900">
                    {tournament.name}
                  </span>
                  <span className="truncate text-xs text-zinc-500">
                    {team?.name ?? "Unknown team"} · {tournament.rounds.length} round
                    {tournament.rounds.length === 1 ? "" : "s"} · {record.wins}-{record.losses}-
                    {record.ties}
                  </span>
                  {/* Final standing details only mean anything once the event is over — an
                      in-progress tournament's participant count/placement are usually still
                      unset anyway, so this line only appears once there's something to show. */}
                  {isTournamentCompleted(tournament) &&
                    (tournament.participantCount || tournament.placement) && (
                      <span className="truncate text-xs text-zinc-500">
                        {tournament.participantCount ? `${tournament.participantCount} entrants` : null}
                        {tournament.participantCount && tournament.placement ? " · " : null}
                        {tournament.placement ? `Placed #${tournament.placement}` : null}
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
                    aria-label={`Remove ${tournament.name}`}
                    title="Remove tournament"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-red-100 dark:hover:bg-red-950 hover:text-red-600"
                  >
                    <Icon name={IconName.Delete} size={16} />
                  </button>
                  <Icon
                    name={IconName.ExpandMore}
                    size={20}
                    className="-rotate-90 text-zinc-400"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
