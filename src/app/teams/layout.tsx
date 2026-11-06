import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/site";
import { FeatureGate } from "@/components/FeatureGate";

export const metadata: Metadata = pageMetadata("myTeams", "/teams");

export default function TeamsLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="teams">{children}</FeatureGate>;
}
