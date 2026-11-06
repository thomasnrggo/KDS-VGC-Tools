import type { Metadata } from "next";
import { HomeGate } from "@/components/HomeGate";
import { MetagamePage } from "@/components/MetagamePage";
import { PAGES, SITE_ABOUT, SITE_NAME, SITE_URL, pageMetadata } from "@/lib/site";

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

/** The home page: the metagame, with the intro — or the Matchup Planner while the Metagame section is switched off. */
export default function Home() {
  return (
    <>
      {/* What the site is, for search engines (schema.org). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <HomeGate>
        <MetagamePage showIntro />
      </HomeGate>
    </>
  );
}
