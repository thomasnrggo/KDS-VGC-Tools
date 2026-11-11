import { collabSubDocs, type CollabTeamChanges } from "./collabTeam";
import { listPlans } from "./matchupPlans";
import { sameValue } from "./sameValue";
import { parseStatPoints } from "./stats/calculateFinalStats";
import { formatSpeciesDisplayName } from "./species/formatSpeciesDisplayName";
import { calcThreat } from "./teamCalcs";
import { speciesIdentity } from "./teamIdentity";
import type {
  ActivityAction,
  CalcActivity,
  CollabCalcDoc,
  CollabCombinationDoc,
  CombinationActivity,
  EditedBy,
  MatchupPlan,
  ParsedPokemon,
  PlanPart,
  RosterActivity,
  RosterMonActivity,
  StatKey,
  Team,
  TeamActivity,
  TeamActivityChange,
  TeamActivityUndo,
} from "@/types";

/**
 * A collaborative team's activity log (docs/collaborative-teams.md): what
 * an edit adds to it — in detail: which Pokémon, moves and items, which
 * combinations and calcs, which parts of a plan — and how someone's edits
 * to the same thing within a few minutes become one entry instead of one per
 * pause in their typing.
 */

/** Someone's edits to the same thing this close together are one entry. */
export const ACTIVITY_MERGE_WINDOW_MS = 10 * 60 * 1000;
/** How long an entry is kept (Firestore's TTL policy on `expireAt` deletes it after). */
export const ACTIVITY_TTL_DAYS = 30;

export interface ActivityDraft {
  change: TeamActivityChange;
  undo?: TeamActivityUndo;
  /**
   * The values after the edit, for recomputing the details when an entry is
   * extended (against what it replaced first — see mergeActivity). Never stored.
   */
  after?: { fields?: Record<string, unknown>; plan?: MatchupPlan };
}

// ── Roster ───────────────────────────────────────────────────────────────────

const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];

function sameName(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function valueChange(
  from: string | undefined,
  to: string | undefined,
): { from: string | null; to: string | null } | undefined {
  return sameName(from, to) ? undefined : { from: from || null, to: to || null };
}

/** One Pokémon's edit, or null when nothing shown changed. */
function monActivity(before: ParsedPokemon, after: ParsedPokemon): RosterMonActivity | null {
  const beforeMoves = before.moves ?? [];
  const afterMoves = after.moves ?? [];
  const movesAdded = afterMoves.filter((move) => !beforeMoves.some((m) => sameName(m, move)));
  const movesRemoved = beforeMoves.filter((move) => !afterMoves.some((m) => sameName(m, move)));
  const change: RosterMonActivity = { species: after.species };
  if (movesAdded.length > 0) change.movesAdded = movesAdded;
  if (movesRemoved.length > 0) change.movesRemoved = movesRemoved;
  const item = valueChange(before.item, after.item);
  if (item) change.item = item;
  const ability = valueChange(before.ability, after.ability);
  if (ability) change.ability = ability;
  const nature = valueChange(before.nature, after.nature);
  if (nature) change.nature = nature;
  const beforePoints = parseStatPoints(before.evs);
  const afterPoints = parseStatPoints(after.evs);
  const spread = STAT_KEYS.flatMap((stat) =>
    beforePoints[stat] === afterPoints[stat]
      ? []
      : [{ stat, from: beforePoints[stat], to: afterPoints[stat] }],
  );
  if (spread.length > 0) change.spread = spread;
  return Object.keys(change).length > 1 ? change : null;
}

/**
 * What changed between two rosters, Pokémon by Pokémon — matched by
 * species, not slot, so removing one doesn't read as every later one
 * changing. Null when nothing did.
 */
export function rosterActivity(
  before: ParsedPokemon[],
  after: ParsedPokemon[],
): RosterActivity | null {
  const unmatched = [...before];
  const added: string[] = [];
  const edited: RosterMonActivity[] = [];
  for (const mon of after) {
    const index = unmatched.findIndex(
      (old) => speciesIdentity(old.species) === speciesIdentity(mon.species),
    );
    if (index === -1) {
      added.push(mon.species);
      continue;
    }
    const [old] = unmatched.splice(index, 1);
    const change = monActivity(old, mon);
    if (change) edited.push(change);
  }
  const removed = unmatched.map((mon) => mon.species);
  return added.length + removed.length + edited.length > 0 ? { added, removed, edited } : null;
}

// ── Combinations and calcs ───────────────────────────────────────────────────

function speciesAt(roster: ParsedPokemon[], slot: number | null | undefined): string[] {
  return slot === null || slot === undefined || !roster[slot] ? [] : [roster[slot].species];
}

function combinationActivity(
  doc: CollabCombinationDoc,
  action: ActivityAction,
  roster: ParsedPokemon[],
): CombinationActivity {
  return {
    id: doc.id,
    action,
    leads: doc.leadPair.flatMap((slot) => speciesAt(roster, slot)),
    back: [...doc.backPair, doc.backAlt].flatMap((slot) => speciesAt(roster, slot)),
  };
}

function calcActivity(
  doc: CollabCalcDoc,
  action: ActivityAction,
  roster: ParsedPokemon[],
): CalcActivity {
  const own = roster.find((mon) => doc.species && speciesIdentity(mon.species) === doc.species);
  const threat = calcThreat(doc);
  return {
    id: doc.id,
    action,
    species: own?.species ?? null,
    against: threat ? formatSpeciesDisplayName(threat.spriteKey) : null,
    side: doc.side,
  };
}

function listDiff<T extends { id: string }>(
  before: T[],
  changes: { put: T[]; remove: string[] },
): { added: T[]; changed: T[]; changedBefore: T[]; removed: T[] } {
  const beforeById = new Map(before.map((doc) => [doc.id, doc]));
  const added = changes.put.filter((doc) => !beforeById.has(doc.id));
  // A doc only moved (another was removed above it) didn't change.
  const changed = changes.put.filter((doc) => {
    const old = beforeById.get(doc.id);
    return !!old && !sameValue({ ...old, sortOrder: 0 }, { ...doc, sortOrder: 0 });
  });
  return {
    added,
    changed,
    changedBefore: changed.map((doc) => beforeById.get(doc.id)!),
    removed: changes.remove.flatMap((id) => beforeById.get(id) ?? []),
  };
}

function countItems<T extends { action: ActivityAction }>(items: T[]) {
  return {
    added: items.filter((item) => item.action === "added").length,
    changed: items.filter((item) => item.action === "changed").length,
    removed: items.filter((item) => item.action === "removed").length,
  };
}

// ── Plans ────────────────────────────────────────────────────────────────────

/** Which parts of a matchup plan differ (see PlanPart). */
export function planParts(before: MatchupPlan | null | undefined, after: MatchupPlan): PlanPart[] {
  const beforePlans = before ? listPlans(before) : [];
  const afterPlans = listPlans(after);
  const parts = new Set<PlanPart>();
  if (beforePlans.length !== afterPlans.length) parts.add("plans");
  afterPlans.forEach((plan, index) => {
    const old = beforePlans[index];
    const picks = (p: typeof plan | undefined) =>
      p && {
        leadPair: p.leadPair,
        backPair: p.backPair,
        backAlt: p.backAlt ?? null,
        leadMega: p.leadMega,
        backMega: p.backMega,
      };
    if (!sameValue(picks(old), picks(plan))) parts.add("picks");
    if (!sameValue(old?.theirs ?? null, plan.theirs ?? null)) parts.add("theirPicks");
    if (!sameValue(old?.notes ?? "", plan.notes ?? "")) parts.add("notes");
  });
  if (!sameValue(before?.scoutingNotes ?? "", after.scoutingNotes ?? "")) parts.add("scouting");
  if (!sameValue(before?.pokemonNotes ?? {}, after.pokemonNotes ?? {})) parts.add("pokemonNotes");
  const order: PlanPart[] = ["plans", "picks", "theirPicks", "notes", "scouting", "pokemonNotes"];
  return order.filter((part) => parts.has(part));
}

// ── Drafts ───────────────────────────────────────────────────────────────────

/** The fields entry's details, from the values before and after. */
function fieldDetails(
  fields: string[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Pick<Extract<TeamActivityChange, { kind: "fields" }>, "roster" | "name"> {
  const details: Pick<Extract<TeamActivityChange, { kind: "fields" }>, "roster" | "name"> = {};
  if (fields.includes("pokemon") && Array.isArray(after.pokemon)) {
    const roster = rosterActivity(
      (before.pokemon as ParsedPokemon[] | null) ?? [],
      after.pokemon as ParsedPokemon[],
    );
    if (roster) details.roster = roster;
  }
  if (fields.includes("name") && typeof after.name === "string") {
    details.name = { from: String(before.name ?? ""), to: after.name };
  }
  return details;
}

/** The activity of one edit of a collaborative team (see diffCollabTeam): its fields, combinations and calcs. */
export function activityFromTeamChanges(before: Team, changes: CollabTeamChanges): ActivityDraft[] {
  const drafts: ActivityDraft[] = [];
  const changedKeys = Object.keys(changes.fields);
  // The paste is the roster written out: it's the roster that changed.
  const fields = changedKeys.flatMap((key) =>
    key === "rawPaste" ? (changedKeys.includes("pokemon") ? [] : ["pokemon"]) : [key],
  );
  const previous = before as unknown as Record<string, unknown>;
  if (fields.length > 0) {
    const undoFields = Object.fromEntries(changedKeys.map((key) => [key, previous[key] ?? null]));
    const afterFields = changes.fields as Record<string, unknown>;
    drafts.push({
      change: { kind: "fields", fields, ...fieldDetails(fields, previous, afterFields) },
      undo: { fields: undoFields },
      after: { fields: afterFields },
    });
  }

  const beforeRoster = before.pokemon;
  const afterRoster = (changes.fields.pokemon as ParsedPokemon[] | undefined) ?? before.pokemon;
  const beforeDocs = collabSubDocs(before);

  const combos = listDiff(beforeDocs.combinations, changes.combinations);
  const comboItems = [
    ...combos.added.map((doc) => combinationActivity(doc, "added", afterRoster)),
    ...combos.changed.map((doc) => combinationActivity(doc, "changed", afterRoster)),
    ...combos.removed.map((doc) => combinationActivity(doc, "removed", beforeRoster)),
  ];
  if (comboItems.length > 0) {
    const replaced = [...combos.changedBefore, ...combos.removed];
    drafts.push({
      change: { kind: "combinations", ...countItems(comboItems), items: comboItems },
      ...(replaced.length > 0 && { undo: { combinations: replaced } }),
    });
  }

  const calcs = listDiff(beforeDocs.calcs, changes.calcs);
  const calcItems = [
    ...calcs.added.map((doc) => calcActivity(doc, "added", afterRoster)),
    ...calcs.changed.map((doc) => calcActivity(doc, "changed", afterRoster)),
    ...calcs.removed.map((doc) => calcActivity(doc, "removed", beforeRoster)),
  ];
  if (calcItems.length > 0) {
    const replaced = [...calcs.changedBefore, ...calcs.removed];
    drafts.push({
      change: { kind: "calcs", ...countItems(calcItems), items: calcItems },
      ...(replaced.length > 0 && { undo: { calcs: replaced } }),
    });
  }
  return drafts;
}

/** The activity of an edited matchup plan. */
export function planActivity(
  opponentId: string,
  opponentLabel: string,
  before: MatchupPlan | undefined,
  after: MatchupPlan,
): ActivityDraft {
  return {
    change: { kind: "plan", opponentId, opponentLabel, parts: planParts(before, after) },
    undo: { plan: before ?? null },
    after: { plan: after },
  };
}

// ── Merging ──────────────────────────────────────────────────────────────────

/** Which entries can be merged: the same kind of edit to the same thing. Membership events never are. */
function mergeKey(change: TeamActivityChange): string | null {
  switch (change.kind) {
    case "fields":
    case "combinations":
    case "calcs":
      return change.kind;
    case "plan":
      return `plan:${change.opponentId}`;
    default:
      return null;
  }
}

/** Whether `draft` by `uid` at `now` continues `entry` (the same person and thing, minutes apart). */
export function continuesActivity(
  entry: TeamActivity,
  draft: ActivityDraft,
  uid: string,
  now: string,
): boolean {
  const key = mergeKey(draft.change);
  return (
    key !== null &&
    entry.by.uid === uid &&
    mergeKey(entry.change) === key &&
    new Date(now).getTime() - new Date(entry.lastAt).getTime() < ACTIVITY_MERGE_WINDOW_MS
  );
}

function mergeDocs<T extends { id: string }>(first: T[] = [], later: T[] = []): T[] | undefined {
  const ids = new Set(first.map((doc) => doc.id));
  const merged = [...first, ...later.filter((doc) => !ids.has(doc.id))];
  return merged.length > 0 ? merged : undefined;
}

function mergeUndo(
  first: TeamActivityUndo | undefined,
  later: TeamActivityUndo | undefined,
): TeamActivityUndo | undefined {
  if (!first) return later;
  if (!later) return first;
  // The earliest value of each thing is what it was before the whole entry.
  const merged: TeamActivityUndo = {};
  const fields = { ...later.fields, ...first.fields };
  if (Object.keys(fields).length > 0) merged.fields = fields;
  const combinations = mergeDocs(first.combinations, later.combinations);
  if (combinations) merged.combinations = combinations;
  const calcs = mergeDocs(first.calcs, later.calcs);
  if (calcs) merged.calcs = calcs;
  if ("plan" in first) merged.plan = first.plan;
  else if ("plan" in later) merged.plan = later.plan;
  return merged;
}

/**
 * The same combination or calc edited again within an entry: added then
 * changed is still added; added then removed never happened; changed then
 * removed is removed.
 */
function mergeItems<T extends { id: string; action: ActivityAction }>(first: T[], later: T[]): T[] {
  const byId = new Map(first.map((item) => [item.id, item]));
  for (const item of later) {
    const earlier = byId.get(item.id);
    if (!earlier) byId.set(item.id, item);
    else if (earlier.action === "added" && item.action === "removed") byId.delete(item.id);
    else if (earlier.action === "added") byId.set(item.id, { ...item, action: "added" });
    else byId.set(item.id, item);
  }
  return [...byId.values()];
}

function mergeChange(
  first: TeamActivityChange,
  later: TeamActivityChange,
  undo: TeamActivityUndo | undefined,
  after: ActivityDraft["after"],
): TeamActivityChange {
  if (first.kind === "fields" && later.kind === "fields") {
    const fields = [...new Set([...first.fields, ...later.fields])];
    // The details compare what was there before the first edit with now.
    return {
      kind: "fields",
      fields,
      ...(first.roster && { roster: first.roster }),
      ...(first.name && { name: first.name }),
      ...(after?.fields && fieldDetails(fields, undo?.fields ?? {}, after.fields)),
    };
  }
  if (first.kind === "combinations" && later.kind === "combinations") {
    const items = mergeItems(first.items ?? [], later.items ?? []);
    return { kind: "combinations", ...countItems(items), items };
  }
  if (first.kind === "calcs" && later.kind === "calcs") {
    const items = mergeItems(first.items ?? [], later.items ?? []);
    return { kind: "calcs", ...countItems(items), items };
  }
  if (first.kind === "plan" && later.kind === "plan" && after?.plan) {
    return { ...later, parts: planParts(undo?.plan, after.plan) };
  }
  return later;
}

/** `entry` extended by `draft` (see continuesActivity). */
export function mergeActivity(
  entry: TeamActivity,
  draft: ActivityDraft,
  now: string,
): TeamActivity {
  const undo = mergeUndo(entry.undo, draft.undo);
  const merged: TeamActivity = {
    ...entry,
    change: mergeChange(entry.change, draft.change, undo, draft.after),
    lastAt: now,
    expireAt: activityExpiry(now),
  };
  if (undo) merged.undo = undo;
  return merged;
}

/** Whether an entry still says anything (edits that cancel out, e.g. a calc added then removed, don't). */
export function isEmptyActivity(entry: TeamActivity): boolean {
  const { change } = entry;
  if (change.kind === "combinations" || change.kind === "calcs") {
    return change.added + change.changed + change.removed === 0;
  }
  if (change.kind === "fields" && change.fields.length === 1 && change.fields[0] === "pokemon") {
    return change.roster === undefined;
  }
  if (change.kind === "plan") return change.parts?.length === 0;
  return false;
}

export function activityExpiry(now: string): Date {
  return new Date(new Date(now).getTime() + ACTIVITY_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** A new entry for `draft`. */
export function newActivity(
  id: string,
  draft: ActivityDraft,
  by: EditedBy,
  now: string,
): TeamActivity {
  const entry: TeamActivity = {
    id,
    by,
    at: now,
    lastAt: now,
    change: draft.change,
    expireAt: activityExpiry(now),
  };
  if (draft.undo) entry.undo = draft.undo;
  return entry;
}
