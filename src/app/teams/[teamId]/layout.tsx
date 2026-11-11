import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

/** Someone's own team (saved in their browser): titled, kept out of search. */
export const metadata: Metadata = privateMetadata("Team overview");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
