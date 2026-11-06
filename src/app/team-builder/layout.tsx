import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/site";
import { FeatureGate } from "@/components/FeatureGate";

export const metadata: Metadata = pageMetadata("teamBuilder", "/team-builder");

/** Building a team is part of My Teams, so it's on and off with that section. */
export default function TeamBuilderLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="teams">{children}</FeatureGate>;
}
