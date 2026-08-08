"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// No websockets/polling in this app -- if you background the tab/PWA and someone else
// picks, locks, or grades while you're away, you'd otherwise only see it after a manual
// reload. Re-runs the current route's Server Components (a plain data refetch, not a full
// page reload) whenever the tab/PWA regains focus or visibility.
export function RevalidateOnFocus() {
  const router = useRouter();

  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}
