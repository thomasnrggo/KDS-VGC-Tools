import { openDB, type IDBPDatabase } from "idb";
import { normalizeOpponent } from "@/lib/opponent";
import { normalizeTeam } from "@/lib/team";
import { auth, createCollectionSync, pullMetaDoc, pushMetaDoc } from "@/lib/firebase";
import type { Opponent, Team, Tournament } from "@/types";

const DB_NAME = "vgc-match-planner";
const DB_VERSION = 4;
const LEGACY_MY_TEAM_STORE = "myTeam";
const LEGACY_MY_TEAM_KEY = "current";
const MY_TEAMS_STORE = "myTeams";
const META_STORE = "meta";
const ACTIVE_TEAM_ID_KEY = "activeTeamId";
const OPPONENTS_STORE = "opponents";
const TOURNAMENTS_STORE = "tournaments";

// IndexedDB stays the source of truth for every read/write below, signed in
// or not — these two only get touched when a user is actually signed in
// (see currentUid()), layering cross-device sync on top rather than
// replacing local storage.
const teamsSync = createCollectionSync<Team>("teams");
const opponentsSync = createCollectionSync<Opponent>("opponents");
const tournamentsSync = createCollectionSync<Tournament>("tournaments");

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

        // v3 introduced multiple "My Team"s: the old single-record `myTeam` store
        // becomes a `myTeams` store keyed by team id, plus a `meta` store tracking
        // which one is active. Migrate any existing single team into that shape
        // rather than discarding it.
        if (oldVersion < 3) {
          const hadLegacyStore = db.objectStoreNames.contains(LEGACY_MY_TEAM_STORE);
          const legacyTeam = hadLegacyStore
            ? ((await transaction.objectStore(LEGACY_MY_TEAM_STORE).get(LEGACY_MY_TEAM_KEY)) as
                | Team
                | undefined)
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

export async function saveMyTeam(team: Team): Promise<void> {
  await putTeamLocal(team);
  const uid = currentUid();
  if (uid) void teamsSync.push(uid, team).catch((error) => logCloudSyncError("push team", error));
}

export async function deleteMyTeam(id: string): Promise<void> {
  await deleteTeamLocal(id);
  const uid = currentUid();
  if (uid) void teamsSync.remove(uid, id).catch((error) => logCloudSyncError("remove team", error));
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
    void opponentsSync.push(uid, opponent).catch((error) => logCloudSyncError("push opponent", error));
  }
}

export async function deleteOpponent(id: string): Promise<void> {
  await deleteOpponentLocal(id);
  const uid = currentUid();
  if (uid) {
    void opponentsSync.remove(uid, id).catch((error) => logCloudSyncError("remove opponent", error));
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
  const uid = currentUid();
  if (uid) {
    void Promise.all(ids.map((id) => opponentsSync.remove(uid, id))).catch((error) =>
      logCloudSyncError("delete opponents", error),
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
    void tournamentsSync
      .push(uid, tournament)
      .catch((error) => logCloudSyncError("push tournament", error));
  }
}

export async function deleteTournament(id: string): Promise<void> {
  await deleteTournamentLocal(id);
  const uid = currentUid();
  if (uid) {
    void tournamentsSync.remove(uid, id).catch((error) => logCloudSyncError("remove tournament", error));
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
