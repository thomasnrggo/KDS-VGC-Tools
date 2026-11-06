import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

/** Your plan against one opponent: titled, kept out of search. */
export const metadata: Metadata = privateMetadata("Matchup plan");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
