import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // ESPN's team-logo CDN, used by ScheduleBrowser's team badges.
    remotePatterns: [{ protocol: "https", hostname: "a.espncdn.com" }],
  },
};

export default nextConfig;
