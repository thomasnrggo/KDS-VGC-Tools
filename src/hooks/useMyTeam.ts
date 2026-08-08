"use client";

import { useCallback, useEffect, useState } from "react";
import { clearMyTeam, getMyTeam, saveMyTeam } from "@/lib/storage/db";
import { createTeam, validateTeamSize, type Team } from "@/lib/team";

export function useMyTeam() {
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyTeam().then((loaded) => {
      if (!cancelled) {
        setTeam(loaded);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Returns an error message, or null on success. */
  const saveFromPaste = useCallback((rawPaste: string): string | null => {
    const trimmed = rawPaste.trim();
    if (!trimmed) {
      return "Paste your team's Showdown export first.";
    }

    const newTeam = createTeam(trimmed);

    const sizeError = validateTeamSize(newTeam.pokemon);
    if (sizeError) {
      return sizeError;
    }

    setTeam(newTeam);
    void saveMyTeam(newTeam);
    return null;
  }, []);

  const clearTeam = useCallback(() => {
    setTeam(null);
    void clearMyTeam();
  }, []);

  return { team, isLoading, saveFromPaste, clearTeam };
}
