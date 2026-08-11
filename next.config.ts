import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      new URL("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/**"),
    ],
  },
};

export default nextConfig;
