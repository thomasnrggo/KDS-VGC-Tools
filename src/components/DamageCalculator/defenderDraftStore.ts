import type { StatOverrides } from "@/lib/stats/applyStatOverrides";
import type { SidebarEntry } from "./RosterPokemonPicker";

/** The right side's work in progress — its roster, which entry is open, its Mega toggle and Stat Point/nature edits — kept so leaving the page and coming back resumes it. */
export interface DefenderDraft {
  sidebar: SidebarEntry[];
  selectedIndex: number | null;
  mega: boolean;
  statOverrides: StatOverrides;
}

const STORAGE_KEY = "damageCalcDefender";

/** Read once per page load: `undefined` = not read yet, `null` = nothing (usable) saved. */
let cached: DefenderDraft | null | undefined;

function isDraft(value: unknown): value is DefenderDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<DefenderDraft>;
  return (
    Array.isArray(draft.sidebar) &&
    draft.sidebar.every((entry) => typeof entry?.pokemon?.species === "string") &&
    (draft.selectedIndex === null || typeof draft.selectedIndex === "number") &&
    typeof draft.mega === "boolean" &&
    typeof draft.statOverrides === "object"
  );
}

export function readDefenderDraft(): DefenderDraft | null {
  if (cached === undefined) {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
      cached = isDraft(parsed) ? parsed : null;
    } catch {
      cached = null;
    }
  }
  return cached;
}

export function writeDefenderDraft(draft: DefenderDraft): void {
  cached = draft;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable (private browsing etc.) — the draft just isn't remembered.
  }
}
