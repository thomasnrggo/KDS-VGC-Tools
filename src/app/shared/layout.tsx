import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

/** A team report someone shared by link: titled, kept out of search. */
export const metadata: Metadata = privateMetadata("Shared team report");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
