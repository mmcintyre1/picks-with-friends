import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Picks with Friends",
    short_name: "Picks",
    description: "Group parlay tracking for the crew.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e16",
    theme_color: "#0a0e16",
    // Single 1254x1254 source, declared at the two standard manifest sizes -- browsers
    // downscale from it. Not marked "maskable": the ticket shape's margins are close to
    // Android's safe-zone minimum, so letting the OS pad/letterbox it as a regular icon
    // is safer than promising it survives an aggressive circular/adaptive crop.
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
