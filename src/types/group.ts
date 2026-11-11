import type { MatchupPlan, Opponent } from "./opponent";
import type { EditedBy, Team, TeamCalc, TeamCombination } from "./team";
import type { StatKey } from "./stats";

/** A member as shown in a prep group (name and avatar from their Google account when they joined). */
export interface GroupMember {
  name: string;
  photoURL?: string;
}

/**
 * A prep group: a shared opponent list several players build together for
 * an event, each keeping their own picks and notes private. Stored at
 * `groups/{id}` in Firestore. See docs/prep-groups.md.
 */
export interface PrepGroup {
  id: string;
  name: string;
  /** The event's regulation — the group's opponents all belong to it. */
  regulationId: string;
  ownerUid: string;
  /** Member uids, the owner included — what the security rules and "my groups" query check. */
  memberUids: string[];
  members: Record<string, GroupMember>;
  /** The current invite link's code (see GroupInvite); resetting the link replaces it. */
  inviteCode: string;
  /** Set on a collaborative team's own group (docs/collaborative-teams.md): its opponents are the team's matchups, with shared plans. */
  teamId?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** `groupInvites/{code}` — knowing the code (from the invite link) is what lets someone join. */
export interface GroupInvite {
  groupId: string;
  groupName: string;
  /** Set when the group is a collaborative team's (PrepGroup.teamId) — the join page then opens the team. */
  teamId?: string;
}

/** A group opponent as stored in the group: everything but your private plan fields. */
export type SharedOpponent = Omit<Opponent, "plansByTeamId" | "copiedPlanFrom">;

/** `users/{uid}/groupPlans/{groupId}_{opponentId}` — your private plans for one group opponent. */
export interface GroupPlanDoc {
  id: string;
  groupId: string;
  opponentId: string;
  plansByTeamId: Record<string, MatchupPlan>;
  copiedPlanFrom?: Record<string, string>;
  updatedAt: string;
}

/**
 * `groups/{groupId}/plans/{opponentId}` — on a collaborative team's group
 * (PrepGroup.teamId), the one plan every member shares for an opponent.
 * See docs/collaborative-teams.md.
 */
export interface SharedPlanDoc {
  opponentId: string;
  plan: MatchupPlan;
  updatedBy?: EditedBy;
  updatedAt: string;
}

/**
 * `teams/{teamId}` — a collaborative team's own fields. Its combinations and
 * calcs are subcollections (one doc each, with a `sortOrder`), so members
 * adding them at once never collide; what only matters to one member (list
 * order, archived, sharing) isn't here. See docs/collaborative-teams.md.
 */
export type CollabTeamDoc = Omit<
  Team,
  "combinations" | "calcs" | "share" | "sortOrder" | "archivedAt" | "collab"
> & {
  groupId: string;
  ownerUid: string;
  /** When the team became collaborative — where it sorts in each member's list. */
  createdAt: string;
  updatedBy?: EditedBy;
};

/** A combination or calc as stored in a collaborative team's subcollection. */
export type CollabCombinationDoc = TeamCombination & { sortOrder: number };
export type CollabCalcDoc = TeamCalc & { sortOrder: number };

/**
 * What one activity entry of a collaborative team says happened (see
 * TeamActivity) — structured, so each language words it its own way.
 */
export type TeamActivityChange =
  | { kind: "created" }
  | { kind: "joined" }
  | { kind: "left" }
  | { kind: "removedMember"; memberName: string }
  /** The team's own fields (name, roster, notes, overview…), by Team key. */
  | {
      kind: "fields";
      fields: string[];
      /** What changed in the roster, Pokémon by Pokémon. */
      roster?: RosterActivity;
      /** A rename. */
      name?: { from: string; to: string };
    }
  | {
      kind: "combinations";
      added: number;
      changed: number;
      removed: number;
      items?: CombinationActivity[];
    }
  | { kind: "calcs"; added: number; changed: number; removed: number; items?: CalcActivity[] }
  | {
      kind: "plan";
      opponentId: string;
      opponentLabel: string;
      /** Which parts of the plan changed (see PlanPart). */
      parts?: PlanPart[];
    };

export type ActivityAction = "added" | "changed" | "removed";

/** One Pokémon's edit: its moves, item, ability, nature, Stat Points. */
export interface RosterMonActivity {
  species: string;
  movesAdded?: string[];
  movesRemoved?: string[];
  item?: { from: string | null; to: string | null };
  ability?: { from: string | null; to: string | null };
  nature?: { from: string | null; to: string | null };
  /**
   * Its Stat Points that changed, stat by stat. (`true` on an entry saved
   * before they were listed: they changed, but not how.)
   */
  spread?: StatPointChange[] | boolean;
}

/** One stat's Stat Points, before and after (0-32). */
export interface StatPointChange {
  stat: StatKey;
  from: number;
  to: number;
}

export interface RosterActivity {
  /** Species added and removed. */
  added: string[];
  removed: string[];
  edited: RosterMonActivity[];
}

/** A combination added, changed or removed, by the species it picks. */
export interface CombinationActivity {
  id: string;
  action: ActivityAction;
  leads: string[];
  back: string[];
}

/** A calc added, changed or removed: whose, against what, which side. */
export interface CalcActivity {
  id: string;
  action: ActivityAction;
  /** The team's Pokémon it's filed under (species), when known. */
  species: string | null;
  /** The other Pokémon in it, as the calc names it. */
  against: string | null;
  side: "offensive" | "defensive" | null;
}

/** The parts of a matchup plan an edit can change. */
export type PlanPart = "plans" | "picks" | "theirPicks" | "notes" | "scouting" | "pokemonNotes";

/**
 * What an entry can put back (a later "Restore"): the values the edit
 * replaced, as they were before the first edit it covers.
 */
export interface TeamActivityUndo {
  /** The team's fields before (null: the field wasn't set). */
  fields?: Record<string, unknown>;
  /** Combinations and calcs the edits removed or changed, as they were. */
  combinations?: CollabCombinationDoc[];
  calcs?: CollabCalcDoc[];
  /** The plan before (null: there wasn't one). */
  plan?: MatchupPlan | null;
}

/**
 * `teams/{teamId}/activity/{id}` — one entry of a collaborative team's
 * activity log (docs/collaborative-teams.md). Someone's edits to the same
 * thing within a few minutes are one entry. Members add entries and can only
 * extend their own; `expireAt` lets Firestore's TTL drop old ones.
 */
export interface TeamActivity {
  id: string;
  by: EditedBy;
  /** When it started, and when the last edit it covers happened. */
  at: string;
  lastAt: string;
  change: TeamActivityChange;
  undo?: TeamActivityUndo;
  expireAt: Date;
}
