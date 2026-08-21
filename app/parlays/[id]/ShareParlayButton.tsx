"use client";

import { useState } from "react";

import { CheckIcon, ShareIcon } from "@/components/ui/icons";

// The parlay page itself already requires login (requireUserAndGroup), so "sharing" just
// means handing someone the URL to paste/open -- the native share sheet (texting apps,
// mainly) if the browser supports it, otherwise a clipboard copy with inline feedback.
export function ShareParlayButton({ parlayId, title }: { parlayId: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/parlays/${parlayId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User backed out of the share sheet, or the browser rejected it -- either way,
        // fall through to a plain clipboard copy rather than leaving them with nothing.
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      title={copied ? "Copied!" : "Share"}
      onClick={share}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted opacity-80 transition hover:bg-white/5 hover:text-foreground hover:opacity-100"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-win" /> : <ShareIcon className="h-4 w-4" />}
    </button>
  );
}
