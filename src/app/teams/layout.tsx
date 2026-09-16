import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function TeamsLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="teams">{children}</FeatureGate>;
}
