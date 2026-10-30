import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function MetagameLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="metagame">{children}</FeatureGate>;
}
