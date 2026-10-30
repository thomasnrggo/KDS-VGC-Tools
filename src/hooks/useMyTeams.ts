"use client";

import { useCallback, useEffect, useState, useRef } from "react";
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
  reorderTeams as reorderTeamsList,
  unarchiveTeam as toActive,
  validateTeamSize,
} from "@/lib/team";
import { REGULATIONS } from "@/data/regulations";
import { useAuth } from "./useAuth";
import { sameRecords } from "@/lib/sameRecords";
import type { Team } from "@/types";
import { getMessages } from "@/lib/i18n/settings";

async function loadLocalOnly(): Promise<{ teams: Team[]; activeTeamId: string | null }> {
  const [teams, activeTeamId] = await Promise.all([getMyTeams(), getActiveTeamId()]);
  return { teams, activeTeamId };
}

function sortByCustomOrder(teams: Team[]): Team[] {
  // Highest sortOrder first — a freshly created team (sortOrder: Date.now())
  // lands at the top by default; dragging to reorder (see reorderTeams) is
  // what changes this afterward. See Team.sortOrder's doc comment.
  return [...teams].sort((a, b) => b.sortOrder - a.sortOrder);
}

/**
 * The last loaded teams, kept across page navigations so a page's first
 * render shows them right away instead of an empty "loading" state — each
 * page mounts its own hook, and the header's team sprites used to blink on
 * every navigation. The hook still reloads in the background on mount.
 */
let cached: { teams: Team[]; activeTeamId: string | null } | null = null;

export function useMyTeams() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>(() => cached?.teams ?? []);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(
    () => cached?.activeTeamId ?? null,
  );
  const [isLoading, setIsLoading] = useState(() => cached === null);

  useEffect(() => {
    if (!isLoading) cached = { teams, activeTeamId };
  }, [teams, activeTeamId, isLoading]);

  // Set once the sync (or, signed out, the local read) has landed, so a slow
  // local read can't overwrite it.
  const syncedRef = useRef(false);

  // Shows a loaded list: the teams only when they differ from what's shown
  // (so an unchanged list doesn't re-render), and the active team resolved
  // against them.
  const showLoaded = useCallback((loaded: { teams: Team[]; activeTeamId: string | null }) => {
    const sorted = sortByCustomOrder(loaded.teams);
    // An archived team can never be "the active team" — this both picks
    // the initial one and recovers if the persisted id points at a team
    // that's since been archived (e.g. archived from another device).
    const resolvedActiveId =
      loaded.activeTeamId &&
      sorted.some((team) => team.id === loaded.activeTeamId && !isTeamArchived(team))
        ? loaded.activeTeamId
        : (sorted.find((team) => !isTeamArchived(team))?.id ?? null);
    setTeams((current) => (sameRecords(current, sorted) ? current : sorted));
    setActiveTeamIdState(resolvedActiveId);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // This device's copy first, shown right away: no waiting for sign-in or
    // the network. An empty one (a fresh device) keeps the spinner until the
    // cloud's copy arrives.
    let cancelled = false;
    loadLocalOnly().then((local) => {
      if (cancelled || syncedRef.current || local.teams.length === 0) return;
      showLoaded(local);
    });
    return () => {
      cancelled = true;
    };
  }, [showLoaded]);

  useEffect(() => {
    // Then the cloud sync once sign-in is known. Its result only replaces
    // what's shown when it actually differs, so an unchanged list doesn't
    // re-render or flicker.
    if (isAuthLoading) return;
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
      syncedRef.current = true;
      showLoaded(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading, showLoaded]);

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
        return getMessages().errors.pasteTeamFirst;
      }

      const newTeam = createTeam(
        trimmed,
        name.trim() || getMessages().errors.defaultTeamName(teams.length + 1),
        regulationId,
      );
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
        (team) => team.regulationIds.includes(regulationId) && team.rawPaste === newTeam.rawPaste,
      );
      if (duplicate) {
        return getMessages().errors.duplicateTeam(duplicate.name);
      }

      setTeams((prev) => [...prev, newTeam]);
      void saveMyTeam(newTeam);
      setActiveTeamId(newTeam.id);
      return null;
    },
    [teams, setActiveTeamId],
  );

  /**
   * Saves a team put together in the Team Builder (see /team-builder) as a
   * new team and makes it active — the builder keeps it as an unsaved draft
   * until its first Pokémon, so leaving an empty one behind never creates a
   * team. Skips addTeam's paste validation and duplicate check.
   */
  const addBuiltTeam = useCallback(
    (team: Team) => {
      setTeams((prev) => [...prev, team]);
      void saveMyTeam(team);
      setActiveTeamId(team.id);
    },
    [setActiveTeamId],
  );

  /** Re-parses `rawPaste` and replaces the team with `id`, keeping its id and regulationIds — editing a team's paste doesn't touch which regulations it's tagged with (see addRegulationTag/removeRegulationTag for that). Returns an error message, or null on success. */
  const editTeam = useCallback(
    (id: string, rawPaste: string, name: string): string | null => {
      const trimmed = rawPaste.trim();
      if (!trimmed) {
        return getMessages().errors.pasteTeamFirst;
      }

      const existing = teams.find((team) => team.id === id);
      const reparsed = createTeam(
        trimmed,
        name.trim() || "Team",
        existing?.regulationIds[0] ?? REGULATIONS[0].id,
      );
      const sizeError = validateTeamSize(reparsed.pokemon);
      if (sizeError) {
        return sizeError;
      }

      const updated: Team = {
        ...existing,
        ...reparsed,
        id,
        regulationIds: existing?.regulationIds ?? reparsed.regulationIds,
        // reparsed comes from createTeam, which stamps a brand-new sortOrder
        // (Date.now()) meant for newly created teams — an edit shouldn't
        // silently jump the team to the top of the list, so keep its
        // existing position.
        sortOrder: existing?.sortOrder ?? reparsed.sortOrder,
      };
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
        setActiveTeamId(teams.find((team) => team.id !== id && !isTeamArchived(team))?.id ?? null);
      }
      void deleteMyTeam(id, !!teams.find((team) => team.id === id)?.share);
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
        setActiveTeamId(teams.find((team) => team.id !== id && !isTeamArchived(team))?.id ?? null);
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

  // Re-sorted on every render (not just on load) so a drag reorder — which
  // only patches sortOrder values, not array position — is reflected
  // immediately regardless of where in `teams` each team happens to sit.
  const activeTeams = sortByCustomOrder(teams.filter((team) => !isTeamArchived(team)));
  const archivedTeams = sortByCustomOrder(teams.filter((team) => isTeamArchived(team)));
  const activeTeam = activeTeams.find((team) => team.id === activeTeamId) ?? null;

  /**
   * Persists a drag-and-drop reorder. `orderedIds` is one visible list (the
   * Active or Archived tab, already filtered to whatever regulation tab is
   * showing) in its new top-to-bottom order — see reorderTeams in
   * src/lib/team.ts for why only that subset's sortOrder values ever change.
   */
  const reorderTeams = useCallback(
    (orderedIds: string[]) => {
      const changed = reorderTeamsList(teams, orderedIds);
      if (changed.length === 0) return;
      const changedById = new Map(changed.map((team) => [team.id, team]));
      setTeams((prev) => prev.map((team) => changedById.get(team.id) ?? team));
      for (const team of changed) {
        void saveMyTeam(team);
      }
    },
    [teams],
  );

  return {
    teams,
    activeTeams,
    archivedTeams,
    activeTeam,
    activeTeamId,
    isLoading,
    addTeam,
    addBuiltTeam,
    editTeam,
    updateTeam,
    removeTeam,
    archiveTeam,
    unarchiveTeam,
    setActiveTeamId,
    reorderTeams,
  };
}
