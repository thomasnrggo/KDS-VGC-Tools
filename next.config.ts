import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      new URL("https://raw.githubusercontent.com/HybridShivam/Pokemon/master/assets/images/**"),
    ],
  },
};

export default nextConfig;
