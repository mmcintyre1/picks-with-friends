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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
