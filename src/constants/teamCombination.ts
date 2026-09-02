import { generateId } from "@/lib/id";
import type { TeamCombination } from "@/types";

/** A fresh, empty combination — each needs its own id (there can be many per team), so this is a factory rather than a static constant like EMPTY_PLAN. */
export function createEmptyCombination(): TeamCombination {
  return {
    id: generateId(),
    leadPair: [null, null],
    backPair: [null, null],
    leadMega: [true, true],
    backMega: [true, true],
    notes: "",
  };
}
