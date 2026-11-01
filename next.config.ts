import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only "N" bubble defaults to bottom-left, right on top of the phone tab bar.
  devIndicators: { position: "top-right" },
  images: {
    // ESPN's team-logo CDN, used by ScheduleBrowser's team badges.
    remotePatterns: [{ protocol: "https", hostname: "a.espncdn.com" }],
  },
};

export default nextConfig;
