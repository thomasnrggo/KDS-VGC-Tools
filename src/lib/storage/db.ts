import { openDB, type IDBPDatabase } from "idb";
import { normalizeOpponent } from "@/lib/opponent";
import { normalizeTeam } from "@/lib/team";
import {
  auth,
  createCollectionSync,
  getSharedMatchups,
  publishSharedMatchup,
  publishSharedTeam,
  pullMetaDoc,
  pushMetaDoc,
  unpublishSharedMatchup,
  unpublishSharedTeam,
} from "@/lib/firebase";
import { sharesSection, toSharedMatchup, toSharedTeam } from "@/lib/sharedTeam";
import { getPlanForTeam } from "@/lib/opponent";
import { hasMatchupPrep } from "@/lib/matchupPlans";
import { createKeyedDebouncer } from "@/lib/keyedDebounce";
import type { CalcSet, MyTeamFolders, Opponent, SharedMatchup, Team, Tournament } from "@/types";
import { EMPTY_TEAM_FOLDERS } from "@/lib/myTeamFolders";
import type { MetaDocument, MetaTournamentDocument } from "@/lib/meta/metaDocument";

const DB_NAME = "vgc-match-planner";
const DB_VERSION = 6;
const LEGACY_MY_TEAM_STORE = "myTeam";
const LEGACY_MY_TEAM_KEY = "current";
const MY_TEAMS_STORE = "myTeams";
const META_STORE = "meta";
const ACTIVE_TEAM_ID_KEY = "activeTeamId";
const OPPONENTS_STORE = "opponents";
const TOURNAMENTS_STORE = "tournaments";
const CALC_SETS_STORE = "calcSets";
// The metagame summary per regulation (see useMeta) — a local copy of public
// data, never synced to the user's account. Not META_STORE, which is app state.
const METAGAME_STORE = "metagame";

// IndexedDB stays the source of truth for every read/write below, signed in
// or not — these two only get touched when a user is actually signed in
// (see currentUid()), layering cross-device sync on top rather than
// replacing local storage.
const teamsSync = createCollectionSync<Team>("teams");
const opponentsSync = createCollectionSync<Opponent>("opponents");
const tournamentsSync = createCollectionSync<Tournament>("tournaments");
const calcSetsSync = createCollectionSync<CalcSet>("calcSets");

// Every save* below writes to IndexedDB immediately (cheap, local, no reason
// to delay it) but debounces the Firestore push per record — a notes
// textarea's onChange fires on every keystroke, and pushing on every one of
// those used to flood Firestore's write stream fast enough to throw
// "resource-exhausted: Write stream exhausted maximum allowed queued
// writes" (see keyedDebounce.ts's doc comment for the full story). One
// instance per collection since a plain id is already unique within it, no
// need to prefix keys.
const CLOUD_PUSH_DEBOUNCE_MS = 800;
const teamCloudPushDebouncer = createKeyedDebouncer(CLOUD_PUSH_DEBOUNCE_MS);
const opponentCloudPushDebouncer = createKeyedDebouncer(CLOUD_PUSH_DEBOUNCE_MS);
const tournamentCloudPushDebouncer = createKeyedDebouncer(CLOUD_PUSH_DEBOUNCE_MS);
const calcSetCloudPushDebouncer = createKeyedDebouncer(CLOUD_PUSH_DEBOUNCE_MS);

function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

// Cloud sync failures never block a local save — but silently swallowing
// them entirely (the previous behavior) makes a real misconfiguration (e.g.
// Firestore security rules rejecting every write) indistinguishable from
// "briefly offline." Logging keeps local-first behavior while still
// surfacing genuine problems in the console.
function logCloudSyncError(context: string, error: unknown): void {
  console.error(`[cloud sync] ${context} failed:`, error);
}

let dbPromise: Promise<IDBPDatabase> | undefined;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains(OPPONENTS_STORE)) {
          db.createObjectStore(OPPONENTS_STORE);
        }
        if (!db.objectStoreNames.contains(TOURNAMENTS_STORE)) {
          db.createObjectStore(TOURNAMENTS_STORE);
        }
        if (!db.objectStoreNames.contains(CALC_SETS_STORE)) {
          db.createObjectStore(CALC_SETS_STORE);
        }
        if (!db.objectStoreNames.contains(METAGAME_STORE)) {
          db.createObjectStore(METAGAME_STORE);
        }

        // v3 introduced multiple "My Team"s: the old single-record `myTeam` store
        // becomes a `myTeams` store keyed by team id, plus a `meta` store tracking
        // which one is active. Migrate any existing single team into that shape
        // rather than discarding it.
        if (oldVersion < 3) {
          const hadLegacyStore = db.objectStoreNames.contains(LEGACY_MY_TEAM_STORE);
          const legacyTeam = hadLegacyStore
            ? ((await transaction.objectStore(LEGACY_MY_TEAM_STORE).get(LEGACY_MY_TEAM_KEY)) as
                Team | undefined)
            : undefined;

          if (!db.objectStoreNames.contains(MY_TEAMS_STORE)) {
            db.createObjectStore(MY_TEAMS_STORE);
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE);
          }

          if (legacyTeam) {
            const migratedTeam: Team = { ...legacyTeam, name: legacyTeam.name ?? "Team 1" };
            await transaction.objectStore(MY_TEAMS_STORE).put(migratedTeam, migratedTeam.id);
            await transaction.objectStore(META_STORE).put(migratedTeam.id, ACTIVE_TEAM_ID_KEY);
          }

          if (hadLegacyStore) {
            db.deleteObjectStore(LEGACY_MY_TEAM_STORE);
          }
        }
      },
      // Without these, a schema-version bump (like this one, adding
      // TOURNAMENTS_STORE) hangs forever — not just errors — if another tab
      // still has an old-version connection open: IndexedDB blocks the
      // upgrade until every other connection closes, and idb's default is to
      // silently wait. `blocking` runs on that OLD tab's connection and
      // proactively closes it so the new one can proceed instead of the user
      // seeing a stuck "Loading…"; `blocked` at least logs so a still-hung
      // case (e.g. an old tab with unsaved work) isn't a silent mystery.
      blocking() {
        void dbPromise?.then((db) => db.close());
      },
      blocked(currentVersion) {
        console.error(
          `[storage] IndexedDB upgrade to v${DB_VERSION} blocked by an existing connection at v${currentVersion} — close other tabs with this app open.`,
        );
      },
    });
  }
  return dbPromise;
}

export async function getMyTeams(): Promise<Team[]> {
  const db = await getDb();
  const teams = await db.getAll(MY_TEAMS_STORE);
  return teams.map(normalizeTeam);
}

async function putTeamLocal(team: Team): Promise<void> {
  const db = await getDb();
  await db.put(MY_TEAMS_STORE, team, team.id);
}

async function deleteTeamLocal(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(MY_TEAMS_STORE, id);
}

// What each shared team's public copy was last published as (minus its
// timestamp) — so a save that doesn't change anything public, like typing
// in the team's notes, doesn't rewrite the shared doc.
const lastPublishedShare = new Map<string, string>();

/**
 * Publishes `team`'s public copy (see toSharedTeam) if it's shared and the
 * copy changed since the last publish from this session. Throws on failure
 * — the Share dialog awaits it to report e.g. a permissions error.
 */
export async function publishTeamShare(team: Team): Promise<void> {
  const uid = currentUid();
  if (!uid || !team.share) return;
  const shared = toSharedTeam(team, team.share, uid);
  const fingerprint = JSON.stringify({ ...shared, updatedAt: "" });
  if (lastPublishedShare.get(team.id) === fingerprint) return;
  await publishSharedTeam(shared);
  lastPublishedShare.set(team.id, fingerprint);
}

/**
 * Removes a team's public copy — "make private", or the team was deleted —
 * its matchups first (firestore.rules checks the team doc to allow that).
 * Throws on failure.
 */
export async function unpublishTeamShare(id: string): Promise<void> {
  lastPublishedShare.delete(id);
  if (!currentUid()) return;
  const matchups = await getSharedMatchups(id);
  await Promise.all(matchups.map((matchup) => dropSharedMatchup(id, matchup.id, true)));
  await unpublishSharedTeam(id);
}

// ── Shared matchups ──────────────────────────────────────────────────────────
// A team shared with its "matchups" section publishes each prepped opponent
// as sharedTeams/{teamId}/matchups/{opponentId} (see SharedMatchup and
// docs/full-share.md). Every opponent save updates them (live, like the team
// doc); reconcileSharedMatchups re-checks the whole set from the Team Report
// and the Share dialog, which have every list loaded.

// What each shared matchup (`${teamId}/${opponentId}`) was last published as
// (minus its timestamp), or "" once it's known not to be published — so an
// unchanged save doesn't rewrite it, and an opponent without prep is only
// deleted once.
const lastPublishedMatchup = new Map<string, string>();

function matchupKey(teamId: string, opponentId: string): string {
  return `${teamId}/${opponentId}`;
}

function matchupFingerprint(matchup: SharedMatchup): string {
  return JSON.stringify({ ...matchup, updatedAt: "" });
}

async function putSharedMatchup(teamId: string, opponent: Opponent): Promise<void> {
  const matchup = toSharedMatchup(opponent, teamId);
  const key = matchupKey(teamId, opponent.id);
  const fingerprint = matchupFingerprint(matchup);
  if (lastPublishedMatchup.get(key) === fingerprint) return;
  await publishSharedMatchup(teamId, matchup);
  lastPublishedMatchup.set(key, fingerprint);
}

async function dropSharedMatchup(teamId: string, opponentId: string, force = false): Promise<void> {
  const key = matchupKey(teamId, opponentId);
  if (!force && lastPublishedMatchup.get(key) === "") return;
  await unpublishSharedMatchup(teamId, opponentId);
  lastPublishedMatchup.set(key, "");
}

/** Whether `opponent` is one of `team`'s shared matchups: in its regulations, with prep for it. */
function isSharedMatchup(team: Team, opponent: Opponent): boolean {
  return (
    team.regulationIds.includes(opponent.regulationId) &&
    hasMatchupPrep(getPlanForTeam(opponent, team.id))
  );
}

async function teamsSharingMatchups(): Promise<Team[]> {
  return (await getMyTeams()).filter((team) => sharesSection(team.share, "matchups"));
}

/**
 * Follows an opponent's edit (yours or a prep group's) in every shared
 * team's matchups: published while it has prep for that team, removed once
 * it hasn't. Signed out, or with no team sharing matchups, it does nothing.
 */
export async function publishOpponentToShares(opponent: Opponent): Promise<void> {
  if (!currentUid()) return;
  const teams = await teamsSharingMatchups();
  await Promise.all(
    teams.map((team) =>
      isSharedMatchup(team, opponent)
        ? putSharedMatchup(team.id, opponent)
        : dropSharedMatchup(team.id, opponent.id),
    ),
  );
}

/** Removes deleted opponents from every shared team's matchups. */
export async function removeOpponentsFromShares(opponentIds: string[]): Promise<void> {
  if (!currentUid() || opponentIds.length === 0) return;
  const teams = await teamsSharingMatchups();
  await Promise.all(
    teams.flatMap((team) => opponentIds.map((id) => dropSharedMatchup(team.id, id))),
  );
}

/**
 * Makes `team`'s published matchups exactly `opponents` (see
 * opponentsToShare) — or none, when its share doesn't include matchups:
 * publishes what's new or changed, removes the rest. Needs every list
 * loaded, since whatever isn't passed is removed. Throws on failure.
 */
export async function reconcileSharedMatchups(team: Team, opponents: Opponent[]): Promise<void> {
  if (!currentUid() || !team.share) return;
  const wanted = sharesSection(team.share, "matchups") ? opponents : [];
  const published = await getSharedMatchups(team.id);
  for (const matchup of published) {
    lastPublishedMatchup.set(matchupKey(team.id, matchup.id), matchupFingerprint(matchup));
  }
  const wantedIds = new Set(wanted.map((opponent) => opponent.id));
  await Promise.all([
    ...wanted.map((opponent) => putSharedMatchup(team.id, opponent)),
    ...published
      .filter((matchup) => !wantedIds.has(matchup.id))
      .map((matchup) => dropSharedMatchup(team.id, matchup.id, true)),
  ]);
}

export async function saveMyTeam(team: Team): Promise<void> {
  // A collaborative team lives in Firestore (src/lib/firebase/collabTeams.ts),
  // never here — useMyTeams routes its edits there.
  if (team.collab) {
    console.error(`[teams] refused to save collaborative team ${team.id} as a personal one`);
    return;
  }
  await putTeamLocal(team);
  const uid = currentUid();
  if (uid) {
    teamCloudPushDebouncer.schedule(team.id, () => {
      void teamsSync.push(uid, team).catch((error) => logCloudSyncError("push team", error));
      // A shared team's public copy follows every edit (roster, name,
      // details), on the same debounce as the private push.
      void publishTeamShare(team).catch((error) => logCloudSyncError("publish shared team", error));
    });
  }
}

export async function deleteMyTeam(id: string, wasShared = false): Promise<void> {
  await deleteTeamLocal(id);
  teamCloudPushDebouncer.cancel(id);
  const uid = currentUid();
  if (uid) void teamsSync.remove(uid, id).catch((error) => logCloudSyncError("remove team", error));
  if (wasShared) {
    void unpublishTeamShare(id).catch((error) => logCloudSyncError("unpublish shared team", error));
  }
}

export async function getActiveTeamId(): Promise<string | null> {
  const db = await getDb();
  const id = await db.get(META_STORE, ACTIVE_TEAM_ID_KEY);
  return id ?? null;
}

async function putActiveTeamIdLocal(id: string | null): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.put(META_STORE, id, ACTIVE_TEAM_ID_KEY);
  } else {
    await db.delete(META_STORE, ACTIVE_TEAM_ID_KEY);
  }
}

export async function setActiveTeamId(id: string | null): Promise<void> {
  await putActiveTeamIdLocal(id);
  const uid = currentUid();
  if (uid) {
    void pushMetaDoc(uid, "state", { activeTeamId: id }).catch((error) =>
      logCloudSyncError("push activeTeamId", error),
    );
  }
}

// ── Team Library favorites ─────────────────────────────────────────────────
// The VGCPastes team ids ("MC780") starred in the Team Library — this
// device's copy in META_STORE, and the account's in users/{uid}/meta/libraryFavorites.

const LIBRARY_FAVORITES_KEY = "libraryFavorites";

export async function getLibraryFavorites(): Promise<string[]> {
  const db = await getDb();
  const ids = await db.get(META_STORE, LIBRARY_FAVORITES_KEY);
  return Array.isArray(ids) ? ids : [];
}

export async function setLibraryFavorites(ids: string[]): Promise<void> {
  const db = await getDb();
  await db.put(META_STORE, ids, LIBRARY_FAVORITES_KEY);
  const uid = currentUid();
  if (uid) {
    void pushMetaDoc(uid, LIBRARY_FAVORITES_KEY, { ids }).catch((error) =>
      logCloudSyncError("push library favorites", error),
    );
  }
}

/**
 * The account's favorites, once signed in: the cloud copy wins (a star
 * removed on another device stays removed); with none yet, this device's
 * are uploaded. Falls back to this device's on a failed read.
 */
export async function syncLibraryFavorites(uid: string): Promise<string[]> {
  const local = await getLibraryFavorites();
  try {
    const cloud = await pullMetaDoc<{ ids?: string[] }>(uid, LIBRARY_FAVORITES_KEY);
    if (cloud && Array.isArray(cloud.ids)) {
      const db = await getDb();
      await db.put(META_STORE, cloud.ids, LIBRARY_FAVORITES_KEY);
      return cloud.ids;
    }
    if (local.length > 0) await pushMetaDoc(uid, LIBRARY_FAVORITES_KEY, { ids: local });
  } catch (error) {
    logCloudSyncError("pull library favorites", error);
  }
  return local;
}

// ── My Teams folders ───────────────────────────────────────────────────────
// Your folders and which team is in which (MyTeamFolders, docs/team-folders.md)
// — this device's copy in META_STORE, the account's in users/{uid}/meta/teamFolders.

const TEAM_FOLDERS_KEY = "teamFolders";

function isTeamFolders(value: unknown): value is MyTeamFolders {
  const folders = value as MyTeamFolders | null;
  return !!folders && Array.isArray(folders.folders) && typeof folders.placement === "object";
}

export async function getTeamFolders(): Promise<MyTeamFolders> {
  const db = await getDb();
  const stored = await db.get(META_STORE, TEAM_FOLDERS_KEY);
  return isTeamFolders(stored) ? stored : EMPTY_TEAM_FOLDERS;
}

export async function setTeamFolders(folders: MyTeamFolders): Promise<void> {
  const db = await getDb();
  await db.put(META_STORE, folders, TEAM_FOLDERS_KEY);
  const uid = currentUid();
  if (uid) {
    void pushMetaDoc(uid, TEAM_FOLDERS_KEY, { ...folders }).catch((error) =>
      logCloudSyncError("push team folders", error),
    );
  }
}

/**
 * The account's folders, once signed in: whichever copy was changed last
 * wins (the account's, unless this device's is newer — e.g. folders made
 * before signing in); with none on the account yet, this device's are
 * uploaded. Falls back to this device's on a failed read.
 */
export async function syncTeamFolders(uid: string): Promise<MyTeamFolders> {
  const local = await getTeamFolders();
  try {
    const cloud = await pullMetaDoc<MyTeamFolders>(uid, TEAM_FOLDERS_KEY);
    if (isTeamFolders(cloud) && (cloud.updatedAt ?? "") >= (local.updatedAt ?? "")) {
      const db = await getDb();
      await db.put(META_STORE, cloud, TEAM_FOLDERS_KEY);
      return cloud;
    }
    if (local.folders.length > 0 || Object.keys(local.placement).length > 0) {
      await pushMetaDoc(uid, TEAM_FOLDERS_KEY, { ...local });
    }
  } catch (error) {
    logCloudSyncError("pull team folders", error);
  }
  return local;
}

export async function getOpponents(): Promise<Opponent[]> {
  const db = await getDb();
  const [opponents, activeTeamId] = await Promise.all([
    db.getAll(OPPONENTS_STORE),
    getActiveTeamId(),
  ]);
  return opponents.map((opponent) => normalizeOpponent(opponent, activeTeamId));
}

async function putOpponentLocal(opponent: Opponent): Promise<void> {
  const db = await getDb();
  await db.put(OPPONENTS_STORE, opponent, opponent.id);
}

async function deleteOpponentLocal(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(OPPONENTS_STORE, id);
}

export async function saveOpponent(opponent: Opponent): Promise<void> {
  await putOpponentLocal(opponent);
  const uid = currentUid();
  if (uid) {
    opponentCloudPushDebouncer.schedule(opponent.id, () => {
      void opponentsSync
        .push(uid, opponent)
        .catch((error) => logCloudSyncError("push opponent", error));
      void publishOpponentToShares(opponent).catch((error) =>
        logCloudSyncError("publish shared matchup", error),
      );
    });
  }
}

export async function deleteOpponent(id: string): Promise<void> {
  await deleteOpponentLocal(id);
  opponentCloudPushDebouncer.cancel(id);
  const uid = currentUid();
  if (uid) {
    void opponentsSync
      .remove(uid, id)
      .catch((error) => logCloudSyncError("remove opponent", error));
    void removeOpponentsFromShares([id]).catch((error) =>
      logCloudSyncError("remove shared matchup", error),
    );
  }
}

/**
 * Deletes exactly the given opponent ids — used by "Clear all data," which
 * (now that opponents are tagged by regulation) only clears whichever
 * regulation is currently being viewed, not literally every opponent ever
 * added. A blanket `db.clear()` would silently wipe other regulations' data
 * too, which is not what "clear all" means once there's more than one.
 */
export async function deleteOpponents(ids: string[]): Promise<void> {
  const db = await getDb();
  for (const id of ids) opponentCloudPushDebouncer.cancel(id);
  const uid = currentUid();
  if (uid) {
    void Promise.all(ids.map((id) => opponentsSync.remove(uid, id))).catch((error) =>
      logCloudSyncError("delete opponents", error),
    );
    void removeOpponentsFromShares(ids).catch((error) =>
      logCloudSyncError("remove shared matchups", error),
    );
  }
  await Promise.all(ids.map((id) => db.delete(OPPONENTS_STORE, id)));
}

/**
 * Pulls this user's cloud teams, reconciles them with what's already local
 * (last-write-wins by `updatedAt` — see createCollectionSync), and persists
 * the merged result back to IndexedDB before returning it. Called once per
 * sign-in by useMyTeams, not on every mutation — everyday saves/deletes
 * already push incrementally via saveMyTeam/deleteMyTeam above.
 */
export async function syncMyTeamsWithCloud(
  uid: string,
): Promise<{ teams: Team[]; activeTeamId: string | null }> {
  const [localTeams, localActiveId, remoteMeta] = await Promise.all([
    getMyTeams(),
    getActiveTeamId(),
    pullMetaDoc<{ activeTeamId: string | null }>(uid, "state"),
  ]);

  // Same fix as syncOpponentsWithCloud below — pullAndMerge can substitute in
  // a raw remote-sourced record that never went through normalizeTeam.
  const merged = (await teamsSync.pullAndMerge(uid, localTeams)).map(normalizeTeam);
  const mergedIds = new Set(merged.map((team) => team.id));
  const removedIds = localTeams.filter((team) => !mergedIds.has(team.id)).map((team) => team.id);
  await Promise.all([
    ...merged.map((team) => putTeamLocal(team)),
    ...removedIds.map((id) => deleteTeamLocal(id)),
  ]);

  const remoteActiveId = remoteMeta?.activeTeamId ?? null;
  const activeTeamId =
    remoteActiveId && merged.some((team) => team.id === remoteActiveId)
      ? remoteActiveId
      : localActiveId;
  if (activeTeamId !== localActiveId) {
    await putActiveTeamIdLocal(activeTeamId);
  }

  return { teams: merged, activeTeamId };
}

/** Same idea as syncMyTeamsWithCloud, for opponents — see its doc comment. */
export async function syncOpponentsWithCloud(uid: string): Promise<Opponent[]> {
  const localOpponents = await getOpponents();
  const activeTeamId = await getActiveTeamId();
  // pullAndMerge can substitute in a raw remote-sourced record (e.g. when the
  // cloud copy ties or wins on updatedAt) that never went through
  // normalizeOpponent — a record synced before a schema field (regulationId,
  // plansByTeamId, ...) existed would otherwise skip that backfill entirely
  // and silently vanish from anything that filters on it.
  const merged = (await opponentsSync.pullAndMerge(uid, localOpponents)).map((opponent) =>
    normalizeOpponent(opponent, activeTeamId),
  );
  const mergedIds = new Set(merged.map((opponent) => opponent.id));
  const removedIds = localOpponents
    .filter((opponent) => !mergedIds.has(opponent.id))
    .map((opponent) => opponent.id);
  await Promise.all([
    ...merged.map((opponent) => putOpponentLocal(opponent)),
    ...removedIds.map((id) => deleteOpponentLocal(id)),
  ]);
  return merged;
}

export async function getTournaments(): Promise<Tournament[]> {
  const db = await getDb();
  return db.getAll(TOURNAMENTS_STORE);
}

async function putTournamentLocal(tournament: Tournament): Promise<void> {
  const db = await getDb();
  await db.put(TOURNAMENTS_STORE, tournament, tournament.id);
}

async function deleteTournamentLocal(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(TOURNAMENTS_STORE, id);
}

export async function saveTournament(tournament: Tournament): Promise<void> {
  await putTournamentLocal(tournament);
  const uid = currentUid();
  if (uid) {
    tournamentCloudPushDebouncer.schedule(tournament.id, () => {
      void tournamentsSync
        .push(uid, tournament)
        .catch((error) => logCloudSyncError("push tournament", error));
    });
  }
}

export async function deleteTournament(id: string): Promise<void> {
  await deleteTournamentLocal(id);
  tournamentCloudPushDebouncer.cancel(id);
  const uid = currentUid();
  if (uid) {
    void tournamentsSync
      .remove(uid, id)
      .catch((error) => logCloudSyncError("remove tournament", error));
  }
}

/** Same idea as syncMyTeamsWithCloud/syncOpponentsWithCloud — no normalize step needed, Tournament has no legacy schema to backfill. */
export async function syncTournamentsWithCloud(uid: string): Promise<Tournament[]> {
  const localTournaments = await getTournaments();
  const merged = await tournamentsSync.pullAndMerge(uid, localTournaments);
  const mergedIds = new Set(merged.map((tournament) => tournament.id));
  const removedIds = localTournaments
    .filter((tournament) => !mergedIds.has(tournament.id))
    .map((tournament) => tournament.id);
  await Promise.all([
    ...merged.map((tournament) => putTournamentLocal(tournament)),
    ...removedIds.map((id) => deleteTournamentLocal(id)),
  ]);
  return merged;
}

export async function getCalcSets(): Promise<CalcSet[]> {
  const db = await getDb();
  return db.getAll(CALC_SETS_STORE);
}

async function putCalcSetLocal(set: CalcSet): Promise<void> {
  const db = await getDb();
  await db.put(CALC_SETS_STORE, set, set.id);
}

async function deleteCalcSetLocal(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(CALC_SETS_STORE, id);
}

export async function saveCalcSet(set: CalcSet): Promise<void> {
  await putCalcSetLocal(set);
  const uid = currentUid();
  if (uid) {
    calcSetCloudPushDebouncer.schedule(set.id, () => {
      void calcSetsSync.push(uid, set).catch((error) => logCloudSyncError("push calc set", error));
    });
  }
}

export async function deleteCalcSet(id: string): Promise<void> {
  await deleteCalcSetLocal(id);
  calcSetCloudPushDebouncer.cancel(id);
  const uid = currentUid();
  if (uid) {
    void calcSetsSync.remove(uid, id).catch((error) => logCloudSyncError("remove calc set", error));
  }
}

/** Same idea as syncTournamentsWithCloud — CalcSet has no legacy schema to backfill either. */
export async function syncCalcSetsWithCloud(uid: string): Promise<CalcSet[]> {
  const localSets = await getCalcSets();
  const merged = await calcSetsSync.pullAndMerge(uid, localSets);
  const mergedIds = new Set(merged.map((set) => set.id));
  const removedIds = localSets.filter((set) => !mergedIds.has(set.id)).map((set) => set.id);
  await Promise.all([
    ...merged.map((set) => putCalcSetLocal(set)),
    ...removedIds.map((id) => deleteCalcSetLocal(id)),
  ]);
  return merged;
}

/** This device's last copy of a regulation's metagame summary, if any. */
export async function getCachedMeta(regulationId: string): Promise<MetaDocument | null> {
  const db = await getDb();
  return ((await db.get(METAGAME_STORE, regulationId)) as MetaDocument | undefined) ?? null;
}

export async function saveCachedMeta(meta: MetaDocument): Promise<void> {
  const db = await getDb();
  await db.put(METAGAME_STORE, meta, meta.regulationId);
}

/** This device's copy of one event's summary — keyed "{regulationId}/{tournamentId}" in the same store. */
export async function getCachedMetaTournament(
  regulationId: string,
  tournamentId: string,
): Promise<MetaTournamentDocument | null> {
  const db = await getDb();
  return (
    ((await db.get(METAGAME_STORE, `${regulationId}/${tournamentId}`)) as
      MetaTournamentDocument | undefined) ?? null
  );
}

export async function saveCachedMetaTournament(meta: MetaTournamentDocument): Promise<void> {
  const db = await getDb();
  await db.put(METAGAME_STORE, meta, `${meta.regulationId}/${meta.tournament.id}`);
}
