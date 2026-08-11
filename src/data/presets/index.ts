import type { TeamPreset } from "@/types";
import { REGULATION_M_B_M_4_RAW } from "./regulationMbM4";

/**
 * Every "load default set" option available in the Opponents section, newest
 * first. Add a preset by dropping a new `export const X_RAW = \`...\`` module
 * next to regulationMbM4.ts and registering it here — don't edit an existing
 * entry's rawPaste in place once a regulation is locked in, since that'd
 * silently change what "load default set" produces for anyone who already
 * used it. Add a new preset (new id) instead.
 */
export const TEAM_PRESETS: TeamPreset[] = [
  {
    id: "regulation-m-b-m-4",
    label: "Regulation M-B (M-4)",
    rawPaste: REGULATION_M_B_M_4_RAW,
  },
];
