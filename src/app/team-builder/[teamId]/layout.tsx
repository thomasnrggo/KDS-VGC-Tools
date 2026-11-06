import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

/** Building one of your own teams: titled, kept out of search. */
export const metadata: Metadata = privateMetadata("Team Builder");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
