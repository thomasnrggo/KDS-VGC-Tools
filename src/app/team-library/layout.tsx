import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/site";
import { FeatureGate } from "@/components/FeatureGate";

export const metadata: Metadata = pageMetadata("teamLibrary", "/team-library");

export default function TeamLibraryLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="teamLibrary">{children}</FeatureGate>;
}
