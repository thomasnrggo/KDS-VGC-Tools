/**
 * The player's tournament details (/profile), used to fill in the team list
 * PDF (src/lib/teamListPdf). Signed in, they're saved to the account's own
 * `users/{uid}/meta/playerProfile` — readable only by that account (see
 * firestore.rules) — so they follow you between devices; this device keeps a
 * copy either way, which is all there is when signed out. Never shared, never
 * saved with a team.
 */
export type AgeDivision = "juniors" | "seniors" | "masters";

export interface PlayerProfile {
  playerName: string;
  trainerName: string;
  switchProfile: string;
  division: AgeDivision | null;
  playerId: string;
  /** "YYYY-MM-DD", as a date input gives it. */
  birthDate: string;
  supportId: string;
}

export const PLAYER_PROFILE_DOC = "playerProfile";
const STORAGE_KEY = "teamListPlayer";

export const EMPTY_PLAYER_PROFILE: PlayerProfile = {
  playerName: "",
  trainerName: "",
  switchProfile: "",
  division: null,
  playerId: "",
  birthDate: "",
  supportId: "",
};

const DIVISIONS: AgeDivision[] = ["juniors", "seniors", "masters"];
const TEXT_FIELDS = [
  "playerName",
  "trainerName",
  "switchProfile",
  "playerId",
  "birthDate",
  "supportId",
] as const;

/** Whatever was stored (an older shape, a hand-edited doc) → a full, clean profile. */
export function normalizePlayerProfile(value: unknown): PlayerProfile {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const profile: PlayerProfile = { ...EMPTY_PLAYER_PROFILE };
  for (const key of TEXT_FIELDS) {
    if (typeof source[key] === "string") profile[key] = (source[key] as string).slice(0, 100);
  }
  if (DIVISIONS.includes(source.division as AgeDivision)) {
    profile.division = source.division as AgeDivision;
  }
  return profile;
}

export function isEmptyPlayerProfile(profile: PlayerProfile): boolean {
  return TEXT_FIELDS.every((key) => !profile[key].trim()) && !profile.division;
}

export function samePlayerProfile(a: PlayerProfile, b: PlayerProfile): boolean {
  return TEXT_FIELDS.every((key) => a[key] === b[key]) && a.division === b.division;
}

export function loadLocalPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizePlayerProfile(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...EMPTY_PLAYER_PROFILE };
  }
}

export function saveLocalPlayerProfile(profile: PlayerProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Private mode or storage full — it just isn't remembered on this device.
  }
}
