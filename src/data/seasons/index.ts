import type { Season } from "@/types";
import { REGULATION_M_B_M_4_RAW } from "./regulationMbM4";

/**
 * Offline/failure fallback for useSeasons() — the real, editable season list
 * lives in Firestore's public `seasons` collection (see
 * src/lib/firebase/seasons.ts), managed via /admin/seasons. This is only
 * what renders if that read fails (offline, Firestore outage), so the
 * "Load default set" buttons never just disappear. Dates are approximate —
 * this entry predates season tracking being modeled at all, so there's no
 * authoritative start/end on record; correct them via the admin page once
 * this is seeded into Firestore for real.
 */
export const FALLBACK_SEASONS: Season[] = [
  {
    id: "regulation-m-b-m-4",
    regulationId: "regulation-m-b",
    label: "M-4",
    startDate: "2026-07-01",
    endDate: "2026-08-04",
    rawPaste: REGULATION_M_B_M_4_RAW,
  },
];
