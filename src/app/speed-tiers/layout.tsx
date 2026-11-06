import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/site";
import { FeatureGate } from "@/components/FeatureGate";

export const metadata: Metadata = pageMetadata("speedTiers", "/speed-tiers");

export default function SpeedTiersLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="speedTiers">{children}</FeatureGate>;
}
