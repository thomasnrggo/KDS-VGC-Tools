"use client";

import { useEffect, useState } from "react";
import { subscribeCollabTeam } from "@/lib/firebase";
import { useGroups } from "./useGroups";
import { useAuth } from "./useAuth";
import type { Team } from "@/types";

/** Last known collaborative teams per user, kept across page navigations (see useMyTeams' cache). */
let cached: { key: string; teams: Team[] } | null = null;

/**
 * Your collaborative teams, live from Firestore (docs/collaborative-teams.md):
 * the team of every active prep group of yours that has one. Read only —
 * useMyTeams merges them into your teams and routes their edits. Signed out,
 * or in no team's group, there are none.
 */
export function useCollabTeams(): { teams: Team[]; isLoading: boolean } {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { teamGroups, isLoading: isGroupsLoading } = useGroups();
  const teamIds = teamGroups
    .flatMap((group) => (group.teamId ? [group.teamId] : []))
    .sort()
    .join(",");
  const key = `${uid}|${teamIds}`;
  const [loaded, setLoaded] = useState<{ key: string; teams: Team[] } | null>(() =>
    cached?.key === key ? cached : null,
  );

  useEffect(() => {
    if (!uid) return;
    const ids = teamIds ? teamIds.split(",") : [];
    const byId: Record<string, Team | null | undefined> = {};

    function publish() {
      // Shown once every team has answered, so the list doesn't fill in piece by piece.
      if (ids.some((id) => byId[id] === undefined)) return;
      const teams = ids.flatMap((id) => (byId[id] ? [byId[id]] : []));
      cached = { key: `${uid}|${teamIds}`, teams };
      setLoaded(cached);
    }

    if (ids.length === 0) {
      publish();
      return;
    }
    const stops = ids.map((id) =>
      subscribeCollabTeam(
        id,
        (team) => {
          byId[id] = team;
          publish();
        },
        (error) => {
          // A team you can't read (e.g. just removed from its group) is left out.
          console.error(`[collab team] listener for ${id} failed:`, error);
          byId[id] = null;
          publish();
        },
      ),
    );
    return () => stops.forEach((stop) => stop());
  }, [uid, teamIds]);

  if (!uid) return { teams: [], isLoading: false };
  const current = loaded?.key === key ? loaded.teams : null;
  return { teams: current ?? [], isLoading: isGroupsLoading || !current };
}
