import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSharedTeamOnServer } from "@/lib/firebase/sharedTeamServer";
import { SITE_NAME, privateMetadata } from "@/lib/site";
import { sharedTeamSummary } from "@/lib/sharedTeam";

interface Props {
  params: Promise<{ teamId: string }>;
}

/**
 * A shared team's link preview (WhatsApp, Discord, X…): its name and roster
 * instead of the site's own — opengraph-image.tsx beside this draws the
 * sprites. Still kept out of search, like every shared report.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId } = await params;
  const team = await getSharedTeamOnServer(teamId);
  if (!team) return privateMetadata("Shared team report");

  const title = team.name.trim() || "Shared team";
  const description = `${sharedTeamSummary(team)} — a Pokémon VGC team shared on ${SITE_NAME}.`;
  return {
    ...privateMetadata(title),
    description,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: `/shared/${teamId}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
