import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function SpeedTiersLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="speedTiers">{children}</FeatureGate>;
}
