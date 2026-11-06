import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

/** A round of your own tournament: titled, kept out of search. */
export const metadata: Metadata = privateMetadata("Round");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
