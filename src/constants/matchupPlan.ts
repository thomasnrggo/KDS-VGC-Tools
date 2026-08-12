import type { MatchupPlan } from "@/types";

export const EMPTY_PLAN: MatchupPlan = {
  leadPair: [null, null],
  backPair: [null, null],
  leadMega: [true, true],
  backMega: [true, true],
  notes: "",
};
