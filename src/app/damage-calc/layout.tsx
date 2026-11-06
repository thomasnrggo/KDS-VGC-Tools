import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/site";

/** Open to everyone (no feature flag) — the layout only gives it its title and description. */
export const metadata: Metadata = pageMetadata("damageCalc", "/damage-calc");

export default function DamageCalcLayout({ children }: { children: ReactNode }) {
  return children;
}
