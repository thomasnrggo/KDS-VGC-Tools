import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      new URL("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/**"),
      // Google account profile photos (Sign in with Google) — served from a
      // handful of lh*.googleusercontent.com subdomains, hence the wildcard.
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
