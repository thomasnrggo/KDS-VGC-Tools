import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/site";

export const metadata: Metadata = privateMetadata("Player profile");

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
