"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTournaments } from "@/hooks/useTournaments";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { PokemonReportRow } from "@/components/PokemonReportRow";
import { TeamCombinationCard } from "@/components/TeamCombinationCard";
import { PokemonSprite } from "@/components/PokemonSprite";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { createEmptyCombination } from "@/constants";
import { computeTeamUsageStats } from "@/lib/tournament";
import { isTeamArchived } from "@/lib/team";
import { REGULATIONS } from "@/data/regulations";
import type { TeamCombination } from "@/types";

interface TeamReportPageProps {
  params: Promise<{ teamId: string }>;
}

type ReportTab = "report" | "strategy" | "stats";

const TABS: { id: ReportTab; label: string }[] = [
  { id: "report", label: "Team report" },
  { id: "strategy", label: "Strategy" },
  { id: "stats", label: "Tournament stats" },
];

export default function TeamReportPage({ params }: TeamReportPageProps) {
  const { teamId } = use(params);
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
    unarchiveTeam,
  } = useMyTeams();
  const { tournaments } = useTournaments();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();

  const team = teams.find((t) => t.id === teamId) ?? null;
  // No regulation selector on this page (it's one specific team's own
  // report) — default the header switcher to whichever regulation this
  // team itself is tagged for, so it at least includes this team.
  const selectedRegulationId = team?.regulationIds[0] ?? REGULATIONS[0]?.id ?? "";
  const usageStats = team ? computeTeamUsageStats(tournaments, team) : [];
  const [activeTab, setActiveTab] = useState<ReportTab>("report");

  function updatePokemonNote(index: number, note: string) {
    updateTeam(teamId, (t) => ({
      ...t,
      pokemonNotes: { ...t.pokemonNotes, [index]: note },
    }));
  }

  function addCombination() {
    updateTeam(teamId, (t) => ({
      ...t,
      combinations: [...(t.combinations ?? []), createEmptyCombination()],
    }));
  }

  function updateCombination(
    combinationId: string,
    updater: (combination: TeamCombination) => TeamCombination,
  ) {
    updateTeam(teamId, (t) => ({
      ...t,
      combinations: (t.combinations ?? []).map((c) =>
        c.id === combinationId ? updater(c) : c,
      ),
    }));
  }

  function removeCombination(combinationId: string) {
    updateTeam(teamId, (t) => ({
      ...t,
      combinations: (t.combinations ?? []).filter((c) => c.id !== combinationId),
    }));
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
        selectedRegulationId={selectedRegulationId}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {isLoading ? (
        <p className="p-6 text-sm text-zinc-500">Loading…</p>
      ) : !team ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">Team not found</p>
          <p className="text-sm text-zinc-600">
            It may have been removed on another device.
          </p>
          <Link
            href="/teams"
            className="text-sm font-medium text-zinc-600 hover:underline"
          >
            ← Back to My Teams
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6 p-6">
          <div className="flex items-center gap-2">
            <Link
              href="/teams"
              aria-label="Back to My Teams"
              title="Back to My Teams"
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
            </Link>
            <h1 className="text-xl font-semibold text-zinc-900">
              Team report — {team.name}
            </h1>
          </div>

          {isTeamArchived(team) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-zinc-700">
                <Icon name={IconName.Archive} size={18} className="shrink-0 text-zinc-500" />
                This team is archived — it&apos;s hidden from the team switcher and can&apos;t be
                set active until you unarchive it.
              </span>
              <button
                type="button"
                onClick={() => unarchiveTeam(team.id)}
                className="shrink-0 rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Unarchive
              </button>
            </div>
          )}

          <div role="tablist" aria-label="Team report sections" className="flex gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-zinc-600 dark:bg-zinc-400 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "report" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {[0, 1].map((column) => {
                const half = Math.ceil(team.pokemon.length / 2);
                const start = column === 0 ? 0 : half;
                const end = column === 0 ? half : team.pokemon.length;
                const slice = team.pokemon.slice(start, end);
                if (slice.length === 0) return null;
                return (
                  <div key={column} className="flex flex-col gap-4">
                    {slice.map((mon, i) => {
                      const index = start + i;
                      return (
                        <PokemonReportRow
                          key={`${mon.species}-${index}`}
                          pokemon={mon}
                          note={team.pokemonNotes?.[index] ?? ""}
                          onNoteChange={(note) => updatePokemonNote(index, note)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "strategy" && (
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Common combinations
                </h2>
                <button
                  type="button"
                  onClick={addCombination}
                  aria-label="Add combination"
                  title="Add combination"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <Icon name={IconName.Add} size={18} />
                </button>
              </div>
              {(team.combinations ?? []).length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No combinations yet — add one to save a lead/back pairing you like using with
                  this team.
                </p>
              ) : (
                (team.combinations ?? []).map((combination) => (
                  <TeamCombinationCard
                    key={combination.id}
                    combination={combination}
                    teamPokemon={team.pokemon}
                    onUpdate={(updater) => updateCombination(combination.id, updater)}
                    onRemove={() => removeCombination(combination.id)}
                  />
                ))
              )}

              <div className="grid grid-cols-1 gap-4 border-t border-zinc-200 pt-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Notes
                  </h2>
                  <RichTextEditor
                    value={team.notes ?? ""}
                    onChange={(notes) => updateTeam(teamId, (t) => ({ ...t, notes }))}
                    placeholder="How does this team play? What's the game plan?"
                    ariaLabel="Team notes"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Weaknesses
                  </h2>
                  <RichTextEditor
                    value={team.weaknesses ?? ""}
                    onChange={(weaknesses) => updateTeam(teamId, (t) => ({ ...t, weaknesses }))}
                    placeholder="What does this team struggle against?"
                    ariaLabel="Team weaknesses"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              {usageStats.every((stat) => stat.timesPicked === 0) ? (
                <p className="text-sm text-zinc-500">
                  No games logged with this team yet — Pokémon usage and win/loss stats
                  accumulate here as you log{" "}
                  <Link href="/tournaments" className="text-zinc-600 hover:underline">
                    tournament
                  </Link>{" "}
                  games.
                </p>
              ) : (
                <table className="w-full text-xs text-zinc-700">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="py-1 text-left font-normal">Pokémon</th>
                      <th className="text-right font-normal">Picked</th>
                      <th className="text-right font-normal">Wins</th>
                      <th className="text-right font-normal">Losses</th>
                      <th className="text-right font-normal">Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageStats.map((stat) => (
                      <tr key={stat.index} className="border-t border-zinc-100">
                        <td className="flex items-center gap-2 py-1.5">
                          <span className="relative h-6 w-6 shrink-0">
                            <PokemonSprite species={stat.pokemon.species} fill />
                          </span>
                          <span className="truncate font-medium text-zinc-900">
                            {stat.pokemon.species}
                          </span>
                        </td>
                        <td className="text-right">{stat.timesPicked}</td>
                        <td className="text-right text-green-700">{stat.wins}</td>
                        <td className="text-right text-red-600">{stat.losses}</td>
                        <td className="text-right font-medium">
                          {stat.timesPicked > 0
                            ? `${Math.round((stat.wins / stat.timesPicked) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
