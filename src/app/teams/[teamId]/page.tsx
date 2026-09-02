"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTournaments } from "@/hooks/useTournaments";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { PokemonReportRow } from "@/components/PokemonReportRow";
import { TeamCombinationCard } from "@/components/TeamCombinationCard";
import { PokemonSprite } from "@/components/PokemonSprite";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { createEmptyCombination } from "@/constants";
import { computeTeamUsageStats } from "@/lib/tournament";
import type { TeamCombination } from "@/types";

interface TeamReportPageProps {
  params: Promise<{ teamId: string }>;
}

export default function TeamReportPage({ params }: TeamReportPageProps) {
  const { teamId } = use(params);
  const {
    teams,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
    updateTeam,
  } = useMyTeams();
  const { tournaments } = useTournaments();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();

  const team = teams.find((t) => t.id === teamId) ?? null;
  const usageStats = team ? computeTeamUsageStats(tournaments, team) : [];

  const notesRef = useRef<HTMLTextAreaElement>(null);
  const weaknessesRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    for (const el of [notesRef.current, weaknessesRef.current]) {
      if (!el) continue;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [team?.notes, team?.weaknesses]);

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
        teams={teams}
        activeTeamId={activeTeamId}
        isLoading={isLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
        currentPage="teams"
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {isLoading ? (
        <p className="p-6 text-sm text-mauve-500">Loading…</p>
      ) : !team ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-mauve-900">Team not found</p>
          <p className="text-sm text-mauve-600">
            It may have been removed on another device.
          </p>
          <Link
            href="/teams"
            className="text-sm font-medium text-mauve-600 hover:underline"
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
              className="flex h-8 w-8 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700"
            >
              <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
            </Link>
            <h1 className="text-xl font-semibold text-mauve-900">
              Team report — {team.name}
            </h1>
          </div>

          <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="flex flex-col overflow-hidden rounded-lg border border-mauve-200">
              {team.pokemon.map((mon, index) => (
                <div key={`${mon.species}-${index}`} className={index % 2 === 0 ? "bg-mauve-200" : "bg-mauve-100"}>
                  <PokemonReportRow
                    pokemon={mon}
                    note={team.pokemonNotes?.[index] ?? ""}
                    onNoteChange={(note) => updatePokemonNote(index, note)}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-lg border border-mauve-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-mauve-900">
                    Common combinations
                  </h2>
                  <button
                    type="button"
                    onClick={addCombination}
                    aria-label="Add combination"
                    title="Add combination"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700"
                  >
                    <Icon name={IconName.Add} size={18} />
                  </button>
                </div>
                {(team.combinations ?? []).length === 0 ? (
                  <p className="text-sm text-mauve-500">
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
              </div>

              <div className="flex flex-col gap-1 rounded-lg border border-mauve-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-mauve-900">Notes</h2>
                <textarea
                  ref={notesRef}
                  value={team.notes ?? ""}
                  onChange={(event) =>
                    updateTeam(teamId, (t) => ({ ...t, notes: event.target.value }))
                  }
                  rows={3}
                  placeholder="How does this team play? What's the game plan?"
                  aria-label="Team notes"
                  className="min-h-20 max-h-64 w-full resize-none overflow-y-auto rounded-lg border border-mauve-200 bg-mauve-100 p-2 text-sm text-mauve-800 focus:outline-none focus:ring-2 focus:ring-mauve-400"
                />
              </div>

              <div className="flex flex-col gap-1 rounded-lg border border-mauve-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-mauve-900">Weaknesses</h2>
                <textarea
                  ref={weaknessesRef}
                  value={team.weaknesses ?? ""}
                  onChange={(event) =>
                    updateTeam(teamId, (t) => ({ ...t, weaknesses: event.target.value }))
                  }
                  rows={3}
                  placeholder="What does this team struggle against?"
                  aria-label="Team weaknesses"
                  className="min-h-20 max-h-64 w-full resize-none overflow-y-auto rounded-lg border border-mauve-200 bg-mauve-100 p-2 text-sm text-mauve-800 focus:outline-none focus:ring-2 focus:ring-mauve-400"
                />
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-mauve-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-mauve-900">Tournament stats</h2>
                {usageStats.every((stat) => stat.timesPicked === 0) ? (
                  <p className="text-sm text-mauve-500">
                    No games logged with this team yet — Pokémon usage and win/loss stats
                    accumulate here as you log{" "}
                    <Link href="/tournaments" className="text-mauve-600 hover:underline">
                      tournament
                    </Link>{" "}
                    games.
                  </p>
                ) : (
                  <table className="w-full text-xs text-mauve-700">
                    <thead>
                      <tr className="text-mauve-500">
                        <th className="py-1 text-left font-normal">Pokémon</th>
                        <th className="text-right font-normal">Picked</th>
                        <th className="text-right font-normal">Wins</th>
                        <th className="text-right font-normal">Losses</th>
                        <th className="text-right font-normal">Win %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.map((stat) => (
                        <tr key={stat.index} className="border-t border-mauve-100">
                          <td className="flex items-center gap-2 py-1.5">
                            <span className="relative h-6 w-6 shrink-0">
                              <PokemonSprite species={stat.pokemon.species} fill />
                            </span>
                            <span className="truncate font-medium text-mauve-900">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
