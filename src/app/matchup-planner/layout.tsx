import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/site";
import { FeatureGate } from "@/components/FeatureGate";

export const metadata: Metadata = pageMetadata("matchupPlanner", "/matchup-planner");

export default function MatchupPlannerLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="matchupPlanner">{children}</FeatureGate>;
}
