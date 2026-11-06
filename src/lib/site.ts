import type { Metadata } from "next";

/**
 * What VGC Box is, in one place — the site's name, tagline and
 * descriptions, used by every page's metadata (titles, search snippets,
 * link previews), the sitemap and the home page's structured data. Keep
 * the home intro (messages' metagame.introTitle/introBody) in step.
 */
export const SITE_NAME = "VGC Box";

/** The public address — canonical links, the sitemap and link-preview images resolve against it. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vgcbox.vercel.app").replace(
  /\/$/,
  "",
);

export const TAGLINE = "The Pokémon VGC prep toolkit";

/** The site in one sentence (~155 characters: what search results show). */
export const SITE_DESCRIPTION =
  "Free Pokémon VGC toolkit: the metagame from official tournaments, a team builder, damage calculator, speed tiers, a team library and a matchup planner.";

/** The site in a paragraph — the README and structured data. */
export const SITE_ABOUT =
  "VGC Box brings together what you need to prepare for a Pokémon VGC tournament: see what official events are bringing, build your team and test it against the metagame, run the damage calcs that matter, check speed tiers, borrow ideas from the community's shared teams, and plan your leads and backs for every opponent. Free, in your browser, with an optional Google sign-in to sync across devices.";

/** Each public page's title (the root layout adds " · VGC Box") and search description. */
export const PAGES = {
  home: {
    title: "VGC Box — Pokémon VGC metagame, team builder & damage calculator",
    description:
      "See what official Pokémon VGC tournaments are bringing — the top Pokémon, their sets, cores and winning teams, updated weekly — and prepare your own team with free tools.",
  },
  metagame: {
    title: "Pokémon VGC Metagame — Usage, Sets & Winning Teams",
    description:
      "Usage from official Pokémon VGC tournaments: the most-used Pokémon, their common sets, items, moves and teammates, the top cores and every winning team. Updated weekly.",
  },
  damageCalc: {
    title: "Damage Calculator",
    description:
      "A Pokémon VGC damage calculator for level 50 doubles with Pokémon Champions Stat Points — calc your team's Pokémon against the metagame's common sets.",
  },
  speedTiers: {
    title: "Speed Tiers",
    description:
      "Pokémon VGC speed tiers for the current regulation: every Pokémon's Speed at level 50 — max, neutral and min, with and without a Choice Scarf.",
  },
  teamBuilder: {
    title: "Team Builder",
    description:
      "Build a Pokémon VGC team — Pokémon, items, abilities, moves and Stat Points — with the metagame's threats beside it, and export it as a Showdown paste.",
  },
  teamLibrary: {
    title: "Team Library — Pokémon VGC Teams & Pastes",
    description:
      "Search Pokémon VGC teams shared by the community, collected by the VGCPastes Repository — by Pokémon, item, player or event, with Pokepastes and rental codes.",
  },
  matchupPlanner: {
    title: "Matchup Planner",
    description:
      "Plan your Pokémon VGC games: add the teams you'll face and write a lead, a back and notes for each matchup.",
  },
  myTeams: {
    title: "My Teams",
    description:
      "Your Pokémon VGC teams in one place — team reports, common leads, damage calcs, coverage and matchup plans — saved in your browser and synced when you sign in.",
  },
  tournaments: {
    title: "Tournaments",
    description:
      "Log your Pokémon VGC tournament runs round by round: who you faced, what you brought and how each game went.",
  },
} as const;

export type PageKey = keyof typeof PAGES;

/** A public page's metadata: its title, description, canonical address and link-preview text. */
export function pageMetadata(key: PageKey, path: string): Metadata {
  const { title, description } = PAGES[key];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
    twitter: { title, description },
  };
}

/** A page that's someone's own data (a team, a tournament, an admin page): titled, but kept out of search. */
export function privateMetadata(title: string): Metadata {
  return {
    // Absolute: under a section whose layout sets a plain title, the root's
    // " · VGC Box" template doesn't reach it.
    title: { absolute: `${title} · ${SITE_NAME}` },
    robots: { index: false, follow: false },
    // Not the section's canonical address, which it would inherit.
    alternates: null,
  };
}

/** The routes worth indexing, for the sitemap. */
export const PUBLIC_ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/damage-calc", priority: 0.9 },
  { path: "/team-library", priority: 0.8 },
  { path: "/speed-tiers", priority: 0.8 },
  { path: "/team-builder", priority: 0.7 },
  { path: "/matchup-planner", priority: 0.6 },
  { path: "/teams", priority: 0.5 },
  { path: "/tournaments", priority: 0.4 },
];
