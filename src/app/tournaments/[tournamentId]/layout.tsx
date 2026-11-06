import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

/** One of your own tournaments: titled, kept out of search. */
export const metadata: Metadata = privateMetadata("Tournament");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
