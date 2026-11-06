import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

/** Editing your own team: titled, kept out of search. */
export const metadata: Metadata = privateMetadata("Edit team");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
