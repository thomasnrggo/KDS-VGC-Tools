import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

/** The admin pages: titled, kept out of search. */
export const metadata: Metadata = privateMetadata("Admin");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
