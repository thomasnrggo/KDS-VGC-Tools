import type { TeamListPages } from "./fillTeamList";

/**
 * What the team list dialog remembers on this device besides the player
 * profile (src/lib/playerProfile.ts): each team's Battle Team number / name,
 * and which pages were last chosen.
 */
const BATTLE_TEAMS_KEY = "teamListBattleTeams";
const PAGES_KEY = "teamListPages";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full — the PDF still downloads, it just isn't remembered.
  }
}

export function loadBattleTeam(teamId: string): string {
  return read<Record<string, string>>(BATTLE_TEAMS_KEY)?.[teamId] ?? "";
}

export function saveBattleTeam(teamId: string, battleTeam: string) {
  const battleTeams = read<Record<string, string>>(BATTLE_TEAMS_KEY) ?? {};
  if (battleTeam.trim()) battleTeams[teamId] = battleTeam;
  else delete battleTeams[teamId];
  write(BATTLE_TEAMS_KEY, battleTeams);
}

export function loadPages(): TeamListPages {
  const saved = read<TeamListPages>(PAGES_KEY);
  return saved === "staff" || saved === "both" ? saved : "opponents";
}

export function savePages(pages: TeamListPages) {
  write(PAGES_KEY, pages);
}
