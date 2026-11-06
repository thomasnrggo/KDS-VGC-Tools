import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

/** A prep group's invite: titled, kept out of search. */
export const metadata: Metadata = privateMetadata("Prep group");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
