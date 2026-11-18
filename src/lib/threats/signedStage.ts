/** A stat stage as players write it: "+1", "−1", "±0". */
export function signedStage(stage: number): string {
  if (stage > 0) return `+${stage}`;
  if (stage < 0) return `−${-stage}`;
  return "±0";
}
