import { openDB, type IDBPDatabase } from "idb";
import type { Team } from "@/lib/team";
import { normalizeOpponent, type Opponent } from "@/lib/opponent";

const DB_NAME = "vgc-match-planner";
const DB_VERSION = 2;
const MY_TEAM_STORE = "myTeam";
const MY_TEAM_KEY = "current";
const OPPONENTS_STORE = "opponents";

let dbPromise: Promise<IDBPDatabase> | undefined;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(MY_TEAM_STORE)) {
          db.createObjectStore(MY_TEAM_STORE);
        }
        if (!db.objectStoreNames.contains(OPPONENTS_STORE)) {
          db.createObjectStore(OPPONENTS_STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function getMyTeam(): Promise<Team | null> {
  const db = await getDb();
  const team = await db.get(MY_TEAM_STORE, MY_TEAM_KEY);
  return team ?? null;
}

export async function saveMyTeam(team: Team): Promise<void> {
  const db = await getDb();
  await db.put(MY_TEAM_STORE, team, MY_TEAM_KEY);
}

export async function clearMyTeam(): Promise<void> {
  const db = await getDb();
  await db.delete(MY_TEAM_STORE, MY_TEAM_KEY);
}

export async function getOpponents(): Promise<Opponent[]> {
  const db = await getDb();
  const opponents = await db.getAll(OPPONENTS_STORE);
  return opponents.map(normalizeOpponent);
}

export async function saveOpponent(opponent: Opponent): Promise<void> {
  const db = await getDb();
  await db.put(OPPONENTS_STORE, opponent, opponent.id);
}

export async function deleteOpponent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(OPPONENTS_STORE, id);
}
