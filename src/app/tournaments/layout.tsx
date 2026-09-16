import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function TournamentsLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="tournaments">{children}</FeatureGate>;
}
