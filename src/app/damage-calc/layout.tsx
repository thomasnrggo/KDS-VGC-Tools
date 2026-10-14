import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function DamageCalcLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="damageCalc">{children}</FeatureGate>;
}
