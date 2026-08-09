import { openDB, type IDBPDatabase } from "idb";
import { normalizeOpponent } from "@/lib/opponent";
import type { Opponent, Team } from "@/types";

const DB_NAME = "vgc-match-planner";
const DB_VERSION = 3;
const LEGACY_MY_TEAM_STORE = "myTeam";
const LEGACY_MY_TEAM_KEY = "current";
const MY_TEAMS_STORE = "myTeams";
const META_STORE = "meta";
const ACTIVE_TEAM_ID_KEY = "activeTeamId";
const OPPONENTS_STORE = "opponents";

let dbPromise: Promise<IDBPDatabase> | undefined;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains(OPPONENTS_STORE)) {
          db.createObjectStore(OPPONENTS_STORE);
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
    });
  }
  return dbPromise;
}

export async function getMyTeams(): Promise<Team[]> {
  const db = await getDb();
  return db.getAll(MY_TEAMS_STORE);
}

export async function saveMyTeam(team: Team): Promise<void> {
  const db = await getDb();
  await db.put(MY_TEAMS_STORE, team, team.id);
}

export async function deleteMyTeam(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(MY_TEAMS_STORE, id);
}

export async function getActiveTeamId(): Promise<string | null> {
  const db = await getDb();
  const id = await db.get(META_STORE, ACTIVE_TEAM_ID_KEY);
  return id ?? null;
}

export async function setActiveTeamId(id: string | null): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.put(META_STORE, id, ACTIVE_TEAM_ID_KEY);
  } else {
    await db.delete(META_STORE, ACTIVE_TEAM_ID_KEY);
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

export async function saveOpponent(opponent: Opponent): Promise<void> {
  const db = await getDb();
  await db.put(OPPONENTS_STORE, opponent, opponent.id);
}

export async function deleteOpponent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(OPPONENTS_STORE, id);
}
