import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Picks with Friends",
    short_name: "Picks",
    description: "Group parlay tracking for the crew.",
    start_url: "/",
    display: "standalone",
    // Matches --color-page/--background in app/globals.css exactly (the "Night Broadcast"
    // palette) -- these were previously a close-but-not-exact #0a0e16, which is why the PWA
    // splash screen visibly flashed a different shade than the app itself on startup.
    background_color: "#0a0e1a",
    theme_color: "#0a0e1a",
    // Single 512x512 source (a bold "PwF" lettermark, replacing the old green checklist
    // icon), declared at the two standard manifest sizes -- browsers downscale from it. Not
    // marked "maskable": untested against Android's adaptive-icon safe-zone crop, so letting
    // the OS pad/letterbox it as a regular icon is safer than promising it survives one.
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
