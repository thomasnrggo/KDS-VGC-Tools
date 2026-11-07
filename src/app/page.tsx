import type { Metadata } from "next";
import { HomeGate } from "@/components/HomeGate";
import { MetagamePage } from "@/components/MetagamePage";
import { REGULATIONS } from "@/data/regulations";
import { getMetaSnapshot } from "@/lib/meta/serverMeta";
import { PAGES, SITE_ABOUT, SITE_NAME, SITE_URL, pageMetadata } from "@/lib/site";

// Static, and rebuilt in the background at most once an hour (the
// metagame job writes weekly): every visitor gets the rendered metagame at
// once, and search engines read it. Each rebuild is one Firestore read
// (serverMeta). Must be a literal: Next reads it at build time.
export const revalidate = 3600;

export const metadata: Metadata = {
  ...pageMetadata("home", "/"),
  // The site's name leads already: no " · VGC Box" after it.
  title: { absolute: PAGES.home.title },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_ABOUT,
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  inLanguage: ["en", "es"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

/**
 * The home page: the metagame, with the intro — or the Matchup Planner
 * while the Metagame section is switched off. Rendered on the server from
 * a snapshot of the current regulation's metagame (see serverMeta).
 */
export default async function Home() {
  const initialMeta = await getMetaSnapshot(REGULATIONS[0]?.id ?? "");
  return (
    <>
      {/* What the site is, for search engines (schema.org). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <HomeGate>
        <MetagamePage showIntro initialMeta={initialMeta} />
      </HomeGate>
    </>
  );
}
