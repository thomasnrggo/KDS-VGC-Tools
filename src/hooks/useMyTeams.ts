"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteMyTeam,
  getActiveTeamId,
  getMyTeams,
  saveMyTeam,
  setActiveTeamId as persistActiveTeamId,
  syncMyTeamsWithCloud,
} from "@/lib/storage/db";
import {
  archiveTeam as toArchived,
  createTeam,
  isTeamArchived,
  unarchiveTeam as toActive,
  validateTeamSize,
} from "@/lib/team";
import { REGULATIONS } from "@/data/regulations";
import { useAuth } from "./useAuth";
import type { Team } from "@/types";

async function loadLocalOnly(): Promise<{ teams: Team[]; activeTeamId: string | null }> {
  const [teams, activeTeamId] = await Promise.all([getMyTeams(), getActiveTeamId()]);
  return { teams, activeTeamId };
}

function sortByUpdatedAtAsc(teams: Team[]): Team[] {
  // Oldest-first (creation order) so switching teams doesn't reorder the tabs.
  return [...teams].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

export function useMyTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = user
      ? () =>
          syncMyTeamsWithCloud(user.uid).catch((error) => {
            console.error("[cloud sync] pull teams failed:", error);
            return loadLocalOnly();
          })
      : loadLocalOnly;
    load().then((loaded) => {
      if (cancelled) return;
      const sorted = sortByUpdatedAtAsc(loaded.teams);
      // An archived team can never be "the active team" — this both picks
      // the initial one and recovers if the persisted id points at a team
      // that's since been archived (e.g. archived from another device).
      const resolvedActiveId =
        loaded.activeTeamId &&
        sorted.some((team) => team.id === loaded.activeTeamId && !isTeamArchived(team))
          ? loaded.activeTeamId
          : (sorted.find((team) => !isTeamArchived(team))?.id ?? null);
      setTeams(sorted);
      setActiveTeamIdState(resolvedActiveId);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setActiveTeamId = useCallback(
    (id: string | null) => {
      // Belt-and-suspenders: the switcher never offers an archived team as a
      // choice, but guard here too in case something else ever calls this
      // directly with one.
      if (id && teams.some((team) => team.id === id && isTeamArchived(team))) {
        return;
      }
      setActiveTeamIdState(id);
      void persistActiveTeamId(id);
    },
    [teams],
  );

  /** Adds a new team from a paste and makes it active. Returns an error message, or null on success. */
  const addTeam = useCallback(
    (rawPaste: string, name: string, regulationId: string): string | null => {
      const trimmed = rawPaste.trim();
      if (!trimmed) {
        return "Paste your team's Showdown export first.";
      }

      const newTeam = createTeam(trimmed, name.trim() || `Team ${teams.length + 1}`, regulationId);
      const sizeError = validateTeamSize(newTeam.pokemon);
      if (sizeError) {
        return sizeError;
      }

      // Same reasoning as Opponents' duplicate check: prevents re-adding the
      // exact same team twice (e.g. re-pasting by habit) from silently
      // creating two entries with different random ids. Checked against
      // archived teams too — re-pasting one you'd archived should surface
      // the same message rather than silently making a second copy.
      const duplicate = teams.find(
        (team) => team.regulationId === regulationId && team.rawPaste === newTeam.rawPaste,
      );
      if (duplicate) {
        return `"${duplicate.name}" already has this exact roster under this regulation.`;
      }

      setTeams((prev) => [...prev, newTeam]);
      void saveMyTeam(newTeam);
      setActiveTeamId(newTeam.id);
      return null;
    },
    [teams, setActiveTeamId],
  );

  /** Re-parses `rawPaste` and replaces the team with `id`, keeping its id and regulationId. Returns an error message, or null on success. */
  const editTeam = useCallback(
    (id: string, rawPaste: string, name: string): string | null => {
      const trimmed = rawPaste.trim();
      if (!trimmed) {
        return "Paste your team's Showdown export first.";
      }

      const existing = teams.find((team) => team.id === id);
      const reparsed = createTeam(
        trimmed,
        name.trim() || "Team",
        existing?.regulationId ?? REGULATIONS[0].id,
      );
      const sizeError = validateTeamSize(reparsed.pokemon);
      if (sizeError) {
        return sizeError;
      }

      const updated: Team = { ...existing, ...reparsed, id };
      setTeams((prev) => prev.map((team) => (team.id === id ? updated : team)));
      void saveMyTeam(updated);
      return null;
    },
    [teams],
  );

  /** Applies `updater` to the team with `id`, persisting the result — used by the Team Report page (notes/weaknesses/pokemonNotes/combinations). No-op if not found. */
  const updateTeam = useCallback((id: string, updater: (team: Team) => Team) => {
    setTeams((prev) => {
      let updated: Team | undefined;
      const next = prev.map((team) => {
        if (team.id !== id) return team;
        updated = { ...updater(team), updatedAt: new Date().toISOString() };
        return updated;
      });
      if (updated) {
        void saveMyTeam(updated);
      }
      return next;
    });
  }, []);

  const removeTeam = useCallback(
    (id: string) => {
      setTeams((prev) => prev.filter((team) => team.id !== id));
      if (activeTeamId === id) {
        setActiveTeamId(
          teams.find((team) => team.id !== id && !isTeamArchived(team))?.id ?? null,
        );
      }
      void deleteMyTeam(id);
    },
    [activeTeamId, teams, setActiveTeamId],
  );

  /** Archives a team — reversible (see unarchiveTeam), it just moves the team off the switcher and onto the My Teams "Archived" tab. Reassigns activeTeamId if this was the active team, same fallback as removeTeam. */
  const archiveTeam = useCallback(
    (id: string) => {
      const existing = teams.find((team) => team.id === id);
      if (!existing) return;
      const updated = toArchived(existing);
      setTeams((prev) => prev.map((team) => (team.id === id ? updated : team)));
      void saveMyTeam(updated);
      if (activeTeamId === id) {
        setActiveTeamId(
          teams.find((team) => team.id !== id && !isTeamArchived(team))?.id ?? null,
        );
      }
    },
    [teams, activeTeamId, setActiveTeamId],
  );

  const unarchiveTeam = useCallback(
    (id: string) => {
      const existing = teams.find((team) => team.id === id);
      if (!existing) return;
      const updated = toActive(existing);
      setTeams((prev) => prev.map((team) => (team.id === id ? updated : team)));
      void saveMyTeam(updated);
    },
    [teams],
  );

  const activeTeams = teams.filter((team) => !isTeamArchived(team));
  const archivedTeams = teams.filter((team) => isTeamArchived(team));
  const activeTeam = activeTeams.find((team) => team.id === activeTeamId) ?? null;

  return {
    teams,
    activeTeams,
    archivedTeams,
    activeTeam,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    updateTeam,
    removeTeam,
    archiveTeam,
    unarchiveTeam,
    setActiveTeamId,
  };
}
