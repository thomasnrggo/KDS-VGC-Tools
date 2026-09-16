import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function MatchupPlannerLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="matchupPlanner">{children}</FeatureGate>;
}
