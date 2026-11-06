import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/site";
import { FeatureGate } from "@/components/FeatureGate";

export const metadata: Metadata = pageMetadata("tournaments", "/tournaments");

export default function TournamentsLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="tournaments">{children}</FeatureGate>;
}
