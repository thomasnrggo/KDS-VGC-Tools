import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/site";
import { FeatureGate } from "@/components/FeatureGate";

export const metadata: Metadata = {
  ...pageMetadata("metagame", "/"),
  // The same page as the home page: search engines should list "/".
};

export default function MetagameLayout({ children }: { children: ReactNode }) {
  return <FeatureGate flagKey="metagame">{children}</FeatureGate>;
}
