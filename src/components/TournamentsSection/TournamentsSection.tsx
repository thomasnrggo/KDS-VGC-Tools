"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Team, Tournament } from "@/types";
import { getTournamentRecord } from "@/lib/tournament";
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
}

/** "Tournaments" list page's content — mirrors MyTeamsSection's shape, simplified further (no search/regulation switcher — not asked for, and there's nothing to filter yet with one regulation). Each row navigates to /tournaments/[id] on click. */
export function TournamentsSection({
  tournaments,
  teams,
  isLoading,
  addTournament,
  removeTournament,
}: TournamentsSectionProps) {
  const router = useRouter();
  // Only active teams are offered when starting a new tournament — same
  // reasoning as the team switcher (see PLANNING.md).
  const activeTeams = teams.filter((team) => !isTeamArchived(team));
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(activeTeams[0]?.id ?? "");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  function openAdd() {
    setName("");
    setTeamId(activeTeams[0]?.id ?? "");
    setIsAdding(true);
  }

  function handleAddSubmit() {
    const team = activeTeams.find((t) => t.id === teamId);
    if (!team) return;
    const tournament = addTournament(name, team.id, team.regulationId);
    setIsAdding(false);
    router.push(`/tournaments/${tournament.id}`);
  }

  const confirmRemoveTournament = confirmRemoveId
    ? (tournaments.find((t) => t.id === confirmRemoveId) ?? null)
    : null;

  return (
    <section className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-mauve-900">Tournaments</h2>
        <button
          type="button"
          onClick={openAdd}
          disabled={activeTeams.length === 0}
          className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add tournament
        </button>
      </div>

      {isAdding && (
        <Modal onClose={() => setIsAdding(false)} labelledBy="add-tournament-modal-title">
          <h2 id="add-tournament-modal-title" className="mb-4 text-lg font-semibold text-mauve-900">
            Add a tournament
          </h2>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tournament name (e.g. Regionals 2026)"
              aria-label="Tournament name"
              className="w-full rounded-lg border border-mauve-300 bg-white p-2 text-sm text-mauve-900 focus:outline-none focus:ring-2 focus:ring-mauve-400"
            />
            <label className="flex flex-col gap-1 text-sm text-mauve-700">
              Team
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="rounded-lg border border-mauve-300 bg-white p-2 text-sm text-mauve-900"
              >
                {activeTeams.map((team) => (
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
                className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create tournament
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
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
            className="mb-2 text-lg font-semibold text-mauve-900"
          >
            Remove {confirmRemoveTournament.name}?
          </h2>
          <p className="mb-4 text-sm text-mauve-600">
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
              className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <p className="text-sm text-mauve-500">Loading…</p>
      ) : activeTeams.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-mauve-300 bg-mauve-50 px-6 py-14 text-center text-sm text-mauve-600">
          Add a team on the My Teams page first — a tournament tracks your rounds with one of your
          saved teams.
        </p>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-mauve-300 bg-mauve-50 px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-mauve-900">No tournaments yet</h3>
          <p className="max-w-md text-sm text-mauve-600">
            Track your rounds, opponent picks, and Pokémon usage/win-loss stats across a real event.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
          >
            Add tournament
          </button>
        </div>
      ) : (
        <ul className="flex flex-col">
          {tournaments.map((tournament, index) => {
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
                  index % 2 === 0 ? "bg-mauve-200" : "bg-mauve-100"
                }`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-mauve-900">
                    {tournament.name}
                  </span>
                  <span className="truncate text-xs text-mauve-500">
                    {team?.name ?? "Unknown team"} · {tournament.rounds.length} round
                    {tournament.rounds.length === 1 ? "" : "s"} · {record.wins}-{record.losses}
                  </span>
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
                    className="flex h-7 w-7 items-center justify-center rounded-full text-mauve-500 hover:bg-red-100 hover:text-red-600"
                  >
                    <Icon name={IconName.Delete} size={16} />
                  </button>
                  <Icon
                    name={IconName.ExpandMore}
                    size={20}
                    className="-rotate-90 text-mauve-400"
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
