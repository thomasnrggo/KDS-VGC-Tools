import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";

/** Building a team is part of My Teams, so it's on and off with that section. */
export default function TeamBuilderLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="teams">{children}</FeatureGate>;
}
