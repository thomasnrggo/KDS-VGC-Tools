import { hasRichText } from "./richText";
import type { GamePlan, MatchupPlan, PlanPicks } from "@/types";

/**
 * A matchup can hold several plans (Plan A, B, C…). Plan A lives in
 * MatchupPlan's own fields — so everything that already reads a plan (the
 * Matchup Planner card, variants, prep groups) keeps working — and Plans B,
 * C… in `morePlans`. These helpers turn that into one ordered list and back:
 * reordering just changes which plan sits in the own fields.
 */

export const EMPTY_PICKS: PlanPicks = {
  leadPair: [null, null],
  backPair: [null, null],
  leadMega: [true, true],
  backMega: [true, true],
};

const PLAN_A_ID = "plan-a";

function newPlanId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `plan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Every plan of a matchup, Plan A first. */
export function listPlans(matchup: MatchupPlan): GamePlan[] {
  const planA: GamePlan = {
    id: matchup.planId ?? PLAN_A_ID,
    leadPair: matchup.leadPair,
    backPair: matchup.backPair,
    leadMega: matchup.leadMega,
    backMega: matchup.backMega,
    backAlt: matchup.backAlt,
    notes: matchup.notes,
    theirs: matchup.theirs,
  };
  return [planA, ...(matchup.morePlans ?? [])];
}

/** Writes an ordered plan list back: the first becomes Plan A (the own fields), the rest `morePlans`. */
export function withPlans(matchup: MatchupPlan, plans: GamePlan[]): MatchupPlan {
  const [first, ...rest] = plans;
  return {
    ...matchup,
    planId: first.id === PLAN_A_ID ? matchup.planId : first.id,
    leadPair: first.leadPair,
    backPair: first.backPair,
    leadMega: first.leadMega,
    backMega: first.backMega,
    backAlt: first.backAlt,
    notes: first.notes,
    theirs: first.theirs,
    morePlans: rest.length > 0 ? rest : undefined,
  };
}

/** Adds an empty plan at the end. Plan A gets a real id first, so it keeps its place in a list. */
export function addPlan(matchup: MatchupPlan): MatchupPlan {
  const plans = listPlans(matchup).map((plan) =>
    plan.id === PLAN_A_ID ? { ...plan, id: newPlanId() } : plan,
  );
  return withPlans(matchup, [...plans, { ...EMPTY_PICKS, id: newPlanId(), notes: "" }]);
}

/** Removes a plan; the last one left is cleared instead (a matchup always has Plan A). */
export function removePlan(matchup: MatchupPlan, index: number): MatchupPlan {
  const plans = listPlans(matchup);
  if (plans.length === 1) {
    return withPlans(matchup, [{ ...EMPTY_PICKS, id: plans[0].id, notes: "", theirs: undefined }]);
  }
  return withPlans(
    matchup,
    plans.filter((_, i) => i !== index),
  );
}

/** Moves a plan up (-1) or down (+1); moving one to the top makes it Plan A. */
export function movePlan(matchup: MatchupPlan, index: number, direction: -1 | 1): MatchupPlan {
  const plans = listPlans(matchup);
  const target = index + direction;
  if (target < 0 || target >= plans.length) return matchup;
  const next = [...plans];
  [next[index], next[target]] = [next[target], next[index]];
  return withPlans(matchup, next);
}

export function updatePlanAt(
  matchup: MatchupPlan,
  index: number,
  updater: (plan: GamePlan) => GamePlan,
): MatchupPlan {
  const plans = listPlans(matchup);
  return withPlans(
    matchup,
    plans.map((plan, i) => (i === index ? updater(plan) : plan)),
  );
}

/** "A", "B", … "Z", then "27", "28"… — a plan's letter by position. */
export function planLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

/**
 * Plan notes are rich text (HTML). Notes saved before that were plain text,
 * so they're turned into paragraphs — one per line — the first time an
 * editor shows them.
 */
export function notesToHtml(notes: string): string {
  if (!notes || notes.trimStart().startsWith("<")) return notes;
  const escape = (line: string) =>
    line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return notes
    .split("\n")
    .map((line) => `<p>${escape(line)}</p>`)
    .join("");
}

/**
 * The opponent's expected picks as one line — "Garchomp - Farigiraf &
 * Charizard - Venusaur" (lead & back) — for the planner card, which doesn't
 * show their picks as sprites. Empty slots are skipped; "" when none are set.
 */
export function theirPicksSummary(
  picks: PlanPicks | undefined,
  theirTeam: { species: string }[],
  speciesName: (species: string) => string,
): string {
  if (!picks) return "";
  const pair = (slots: PlanPicks["leadPair"]) =>
    slots
      .flatMap((slot) => {
        const mon = slot === null ? undefined : theirTeam[slot];
        return mon ? [speciesName(mon.species)] : [];
      })
      .join(" - ");
  return [pair(picks.leadPair), pair(picks.backPair)].filter(Boolean).join(" & ");
}

/**
 * Whether you've prepped this matchup at all — any plan with a pick or game
 * plan text, "What they do", or a note on one of their Pokémon. The Team
 * Report's Matchups tab lists the ones that have.
 */
export function hasMatchupPrep(matchup: MatchupPlan): boolean {
  const planned = listPlans(matchup).some(
    (plan) =>
      hasRichText(plan.notes) ||
      [
        ...plan.leadPair,
        ...plan.backPair,
        ...(plan.theirs ? [...plan.theirs.leadPair, ...plan.theirs.backPair] : []),
      ].some((slot) => slot !== null),
  );
  return (
    planned ||
    hasRichText(matchup.scoutingNotes) ||
    Object.values(matchup.pokemonNotes ?? {}).some((note) => hasRichText(note))
  );
}
