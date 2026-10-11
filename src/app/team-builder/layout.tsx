import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function TeamBuilderLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="teamBuilder">{children}</FeatureGate>;
}
