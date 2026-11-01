import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the home network use the dev server (e.g. http://192.168.1.21:3001).
  // Without this Next blocks its JS for non-localhost origins, so the page renders but no
  // button works.
  allowedDevOrigins: ["192.168.1.20", "192.168.1.*"],
  // Dev-only "N" bubble defaults to bottom-left, right on top of the phone tab bar.
  devIndicators: { position: "top-right" },
  images: {
    // ESPN's team-logo CDN, used by ScheduleBrowser's team badges.
    remotePatterns: [{ protocol: "https", hostname: "a.espncdn.com" }],
  },
};

export default nextConfig;
