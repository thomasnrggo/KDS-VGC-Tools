"use client";

import { use, useState } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useLanguage";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { TeamBuilder } from "@/components/TeamBuilder";
import { REGULATIONS } from "@/data/regulations";
import { createTeam } from "@/lib/team";
import type { Team } from "@/types";

/**
 * Creating a team in the Team Builder. It's a draft until its first Pokémon
 * (an empty one left behind never becomes a team); then it's saved, and the
 * address becomes its edit page — /teams/[id]/edit, where My Teams links to
 * — without leaving this page, so the keyboard flow isn't interrupted.
 */
interface NewTeamBuilderPageProps {
  /** ?regulation= — the regulation to start in (My Teams passes the one it's showing). */
  searchParams: Promise<{ regulation?: string }>;
}

export default function NewTeamBuilderPage({ searchParams }: NewTeamBuilderPageProps) {
  const t = useMessages();
  const { regulation: regulationId } = use(searchParams);
  const {
    teams,
    activeTeams,
    activeTeamId,
    isLoading,
    addTeam,
    addBuiltTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
    updateTeam,
  } = useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [draft, setDraft] = useState<Team>(() =>
    createTeam(
      "",
      t.teamBuilder.newTeam,
      REGULATIONS.find((regulation) => regulation.id === regulationId)?.id ?? REGULATIONS[0].id,
    ),
  );
  const [savedId, setSavedId] = useState<string | null>(null);
  const team = (savedId && teams.find((saved) => saved.id === savedId)) || draft;

  function handleChange(updater: (team: Team) => Team) {
    if (savedId) {
      updateTeam(savedId, updater);
      return;
    }
    const next = updater(draft);
    setDraft(next);
    if (next.pokemon.length === 0) return;
    const saved = { ...next, updatedAt: new Date().toISOString() };
    addBuiltTeam(saved);
    setSavedId(saved.id);
    // The native History API is synced with Next's router.
    window.history.replaceState(null, "", `/teams/${saved.id}/edit`);
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
        selectedRegulationId={team.regulationIds[0] ?? REGULATIONS[0]?.id ?? ""}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      <div className="flex w-full flex-col gap-4 px-3 py-4 sm:p-6">
        <TeamBuilder
          team={team}
          heading={t.teamBuilder.title}
          onChange={handleChange}
          teamHref={savedId ? `/teams/${savedId}` : undefined}
        />
      </div>
    </div>
  );
}
