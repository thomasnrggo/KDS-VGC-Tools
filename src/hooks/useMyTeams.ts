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
  duplicateTeam as toDuplicate,
  isTeamArchived,
  reorderTeams as reorderTeamsList,
  unarchiveTeam as toActive,
  validateTeamSize,
} from "@/lib/team";
import { REGULATIONS } from "@/data/regulations";
import { useAuth } from "./useAuth";
import { useCollabTeams } from "./useCollabTeams";
import { sameRecords } from "@/lib/sameRecords";
import { diffCollabTeam, hasCollabChanges } from "@/lib/collabTeam";
import { createKeyedDebouncer } from "@/lib/keyedDebounce";
import { writeCollabTeamChanges } from "@/lib/firebase";
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

/** A collaborative team's edits are written after a pause, like the personal cloud push. */
const COLLAB_WRITE_DELAY_MS = 800;
const collabWriteDebouncer = createKeyedDebouncer(COLLAB_WRITE_DELAY_MS);

// Shared by every useMyTeams on the page (and kept across navigations), so
// they all show the same pending edit and only one write goes out:
// your edits to collaborative teams not yet reported back by Firestore, what
// each pending edit started from, and the last Firestore snapshot of each.
// The write is the difference between an edit and what it started from, so a
// teammate's change to another part made meanwhile is never overwritten.
let collabEdits: Record<string, Team> = {};
const collabEditBases: Record<string, Team> = {};
const collabSnapshots: Record<string, Team> = {};
const collabEditListeners = new Set<(edits: Record<string, Team>) => void>();

/**
 * Your teams: your own (this device's storage, synced to your account) and,
 * signed in, your collaborative ones (live from Firestore — see
 * useCollabTeams and docs/collaborative-teams.md), as one list. Every edit
 * goes where its team lives. A collaborative team's list order and archived
 * state aren't per-member yet, so reordering and archiving skip them.
 */
export function useMyTeams() {
  const { user, isLoading: isAuthLoading } = useAuth();
  // Your own teams (`teams` below adds the collaborative ones).
  const [personalTeams, setTeams] = useState<Team[]>(() => cached?.teams ?? []);
  // The saved active team id — resolved against the full list on each render.
  const [storedActiveTeamId, setActiveTeamIdState] = useState<string | null>(
    () => cached?.activeTeamId ?? null,
  );
  const [isLoading, setIsLoading] = useState(() => cached === null);
  const collab = useCollabTeams();

  useEffect(() => {
    if (!isLoading) cached = { teams: personalTeams, activeTeamId: storedActiveTeamId };
  }, [personalTeams, storedActiveTeamId, isLoading]);

  // Your pending edits to collaborative teams, shown right away and until
  // Firestore reports them back (a snapshot as new as the edit replaces it).
  const [shownCollabEdits, setShownCollabEdits] = useState(() => collabEdits);
  useEffect(() => {
    collabEditListeners.add(setShownCollabEdits);
    return () => {
      collabEditListeners.delete(setShownCollabEdits);
    };
  }, []);
  useEffect(() => {
    for (const team of collab.teams) collabSnapshots[team.id] = team;
  }, [collab.teams]);

  const collabTeams = collab.teams.map((team) => {
    const edited = shownCollabEdits[team.id];
    return edited && edited.updatedAt > team.updatedAt ? edited : team;
  });
  const collabIds = new Set(collabTeams.map((team) => team.id));
  const teams = [...personalTeams.filter((team) => !collabIds.has(team.id)), ...collabTeams];

  // Set once the sync (or, signed out, the local read) has landed, so a slow
  // local read can't overwrite it.
  const syncedRef = useRef(false);

  // Shows a loaded list: the teams only when they differ from what's shown
  // (so an unchanged list doesn't re-render), and the active team resolved
  // against them.
  const showLoaded = useCallback((loaded: { teams: Team[]; activeTeamId: string | null }) => {
    const sorted = sortByCustomOrder(loaded.teams);
    setTeams((current) => (sameRecords(current, sorted) ? current : sorted));
    setActiveTeamIdState(loaded.activeTeamId);
    setIsLoading(false);
  }, []);

  // An archived team can never be "the active team" — this both picks the
  // initial one and recovers if the saved id points at a team that's since
  // been archived (e.g. from another device), or one that isn't in the list
  // (yet: a collaborative team arrives after your own).
  const activeTeamId =
    storedActiveTeamId &&
    teams.some((team) => team.id === storedActiveTeamId && !isTeamArchived(team))
      ? storedActiveTeamId
      : (sortByCustomOrder(teams).find((team) => !isTeamArchived(team))?.id ?? null);

  /**
   * Saves an edit of a collaborative team: shown right away, written to
   * Firestore after a pause (see diffCollabTeam — only what changed).
   */
  const saveCollabTeam = useCallback(
    (updated: Team) => {
      const id = updated.id;
      collabEditBases[id] ??= collabSnapshots[id];
      collabEdits = { ...collabEdits, [id]: updated };
      for (const show of collabEditListeners) show(collabEdits);
      collabWriteDebouncer.schedule(id, () => {
        const base = collabEditBases[id];
        const latest = collabEdits[id];
        delete collabEditBases[id];
        if (!base || !latest || !user) return;
        const changes = diffCollabTeam(base, latest);
        if (!hasCollabChanges(changes)) return;
        const by = { uid: user.uid, name: user.displayName ?? user.email ?? "?" };
        writeCollabTeamChanges(id, base, changes, by, latest.updatedAt).catch((error) => {
          console.error(`[collab team] saving ${id} failed:`, error);
        });
      });
    },
    [user],
  );

  /** The team with `id` as currently shown, your unsaved edits included. */
  const currentCollabTeam = useCallback((id: string): Team | undefined => {
    const snapshot = collabSnapshots[id];
    const edited = collabEdits[id];
    if (!snapshot) return undefined;
    return edited && edited.updatedAt > snapshot.updatedAt ? edited : snapshot;
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

  const setActiveTeamId = (id: string | null) => {
    // Belt-and-suspenders: the switcher never offers an archived team as a
    // choice, but guard here too in case something else ever calls this
    // directly with one.
    if (id && teams.some((team) => team.id === id && isTeamArchived(team))) {
      return;
    }
    setActiveTeamIdState(id);
    void persistActiveTeamId(id);
  };

  /** Adds a new team from a paste and makes it active. Returns an error message, or null on success. */
  const addTeam = (rawPaste: string, name: string, regulationId: string): string | null => {
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
  };

  /**
   * Saves a team put together in the Team Builder (see /team-builder) as a
   * new team and makes it active — the builder keeps it as an unsaved draft
   * until its first Pokémon, so leaving an empty one behind never creates a
   * team. Skips addTeam's paste validation and duplicate check.
   */
  const addBuiltTeam = (team: Team) => {
    setTeams((prev) => [...prev, team]);
    void saveMyTeam(team);
    setActiveTeamId(team.id);
  };

  /**
   * Saves a copy of the team with `id`, named "<name> (copy)" — see
   * duplicateTeam (a collaborative team's copy is your own). Leaves the
   * active team as it is. Returns the copy.
   */
  const duplicateTeam = (id: string): Team | undefined => {
    const existing = teams.find((team) => team.id === id);
    if (!existing) return undefined;
    const copy = toDuplicate(existing, getMessages().myTeams.copyName(existing.name));
    setTeams((prev) => [...prev, copy]);
    void saveMyTeam(copy);
    return copy;
  };

  /**
   * After a team became collaborative (makeTeamCollaborative): drops its
   * personal copy — and its public share, which a collaborative team
   * doesn't have yet. The collaborative one keeps the same id.
   */
  const dropPersonalCopy = (id: string) => {
    const personal = personalTeams.find((team) => team.id === id);
    if (!personal) return;
    setTeams((prev) => prev.filter((team) => team.id !== id));
    void deleteMyTeam(id, !!personal.share);
  };

  /** Stopping a collaborative team: it becomes your own team again, same id (see endCollabTeam). */
  const restorePersonalTeam = (team: Team) => {
    const own: Team = { ...team, updatedAt: new Date().toISOString() };
    delete own.collab;
    setTeams((prev) => [...prev.filter((t) => t.id !== team.id), own]);
    void saveMyTeam(own);
  };

  /** Re-parses `rawPaste` and replaces the team with `id`, keeping its id and regulationIds — editing a team's paste doesn't touch which regulations it's tagged with (see addRegulationTag/removeRegulationTag for that). Returns an error message, or null on success. */
  const editTeam = (id: string, rawPaste: string, name: string): string | null => {
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
    if (existing?.collab) {
      saveCollabTeam({ ...updated, updatedAt: new Date().toISOString() });
      return null;
    }
    setTeams((prev) => prev.map((team) => (team.id === id ? updated : team)));
    void saveMyTeam(updated);
    return null;
  };

  /** Applies `updater` to the team with `id`, persisting the result — used by the Team Report page (notes/weaknesses/pokemonNotes/combinations). No-op if not found. */
  const updateTeam = useCallback(
    (id: string, updater: (team: Team) => Team) => {
      const collabTeam = currentCollabTeam(id);
      if (collabTeam) {
        saveCollabTeam({ ...updater(collabTeam), updatedAt: new Date().toISOString() });
        return;
      }
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
    },
    [currentCollabTeam, saveCollabTeam],
  );

  const removeTeam = (id: string) => {
    // Leaving or ending a collaborative team is its own flow (docs/collaborative-teams.md).
    if (teams.find((team) => team.id === id)?.collab) {
      console.warn(`[teams] ${id} is collaborative — leave or stop collaborating instead`);
      return;
    }
    setTeams((prev) => prev.filter((team) => team.id !== id));
    if (activeTeamId === id) {
      setActiveTeamId(teams.find((team) => team.id !== id && !isTeamArchived(team))?.id ?? null);
    }
    void deleteMyTeam(id, !!teams.find((team) => team.id === id)?.share);
  };

  /** Archives a team — reversible (see unarchiveTeam), it just moves the team off the switcher and onto the My Teams "Archived" tab. Reassigns activeTeamId if this was the active team, same fallback as removeTeam. */
  const archiveTeam = (id: string) => {
    const existing = teams.find((team) => team.id === id);
    if (!existing || existing.collab) return;
    const updated = toArchived(existing);
    setTeams((prev) => prev.map((team) => (team.id === id ? updated : team)));
    void saveMyTeam(updated);
    if (activeTeamId === id) {
      setActiveTeamId(teams.find((team) => team.id !== id && !isTeamArchived(team))?.id ?? null);
    }
  };

  const unarchiveTeam = (id: string) => {
    const existing = teams.find((team) => team.id === id);
    if (!existing || existing.collab) return;
    const updated = toActive(existing);
    setTeams((prev) => prev.map((team) => (team.id === id ? updated : team)));
    void saveMyTeam(updated);
  };

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
  const reorderTeams = (orderedIds: string[]) => {
    const changed = reorderTeamsList(teams, orderedIds).filter((team) => !team.collab);
    if (changed.length === 0) return;
    const changedById = new Map(changed.map((team) => [team.id, team]));
    setTeams((prev) => prev.map((team) => changedById.get(team.id) ?? team));
    for (const team of changed) {
      void saveMyTeam(team);
    }
  };

  return {
    teams,
    activeTeams,
    archivedTeams,
    activeTeam,
    activeTeamId,
    isLoading,
    /** Collaborative teams are still arriving — a team not found yet may be one of them. */
    isCollabLoading: collab.isLoading,
    addTeam,
    addBuiltTeam,
    duplicateTeam,
    dropPersonalCopy,
    restorePersonalTeam,
    editTeam,
    updateTeam,
    removeTeam,
    archiveTeam,
    unarchiveTeam,
    setActiveTeamId,
    reorderTeams,
  };
}
