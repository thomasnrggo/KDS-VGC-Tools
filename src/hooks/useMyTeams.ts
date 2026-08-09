"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteMyTeam,
  getActiveTeamId,
  getMyTeams,
  saveMyTeam,
  setActiveTeamId as persistActiveTeamId,
} from "@/lib/storage/db";
import { createTeam, validateTeamSize } from "@/lib/team";
import type { Team } from "@/types";

function sortByUpdatedAtAsc(teams: Team[]): Team[] {
  // Oldest-first (creation order) so switching teams doesn't reorder the tabs.
  return [...teams].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

export function useMyTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyTeams(), getActiveTeamId()]).then(([loadedTeams, loadedActiveId]) => {
      if (cancelled) return;
      const sorted = sortByUpdatedAtAsc(loadedTeams);
      const resolvedActiveId =
        loadedActiveId && sorted.some((team) => team.id === loadedActiveId)
          ? loadedActiveId
          : (sorted[0]?.id ?? null);
      setTeams(sorted);
      setActiveTeamIdState(resolvedActiveId);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setActiveTeamId = useCallback((id: string | null) => {
    setActiveTeamIdState(id);
    void persistActiveTeamId(id);
  }, []);

  /** Adds a new team from a paste and makes it active. Returns an error message, or null on success. */
  const addTeam = useCallback(
    (rawPaste: string, name: string): string | null => {
      const trimmed = rawPaste.trim();
      if (!trimmed) {
        return "Paste your team's Showdown export first.";
      }

      const newTeam = createTeam(trimmed, name.trim() || `Team ${teams.length + 1}`);
      const sizeError = validateTeamSize(newTeam.pokemon);
      if (sizeError) {
        return sizeError;
      }

      setTeams((prev) => [...prev, newTeam]);
      void saveMyTeam(newTeam);
      setActiveTeamId(newTeam.id);
      return null;
    },
    [teams.length, setActiveTeamId],
  );

  /** Re-parses `rawPaste` and replaces the team with `id`, keeping its id. Returns an error message, or null on success. */
  const editTeam = useCallback((id: string, rawPaste: string, name: string): string | null => {
    const trimmed = rawPaste.trim();
    if (!trimmed) {
      return "Paste your team's Showdown export first.";
    }

    const reparsed = createTeam(trimmed, name.trim() || "Team");
    const sizeError = validateTeamSize(reparsed.pokemon);
    if (sizeError) {
      return sizeError;
    }

    const updated: Team = { ...reparsed, id };
    setTeams((prev) => prev.map((team) => (team.id === id ? updated : team)));
    void saveMyTeam(updated);
    return null;
  }, []);

  const removeTeam = useCallback(
    (id: string) => {
      setTeams((prev) => prev.filter((team) => team.id !== id));
      if (activeTeamId === id) {
        setActiveTeamId(teams.find((team) => team.id !== id)?.id ?? null);
      }
      void deleteMyTeam(id);
    },
    [activeTeamId, teams, setActiveTeamId],
  );

  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;

  return {
    teams,
    activeTeam,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
  };
}
