import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function TeamLibraryLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="teamLibrary">{children}</FeatureGate>;
}
