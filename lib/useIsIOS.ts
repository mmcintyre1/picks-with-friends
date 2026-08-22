"use client";

import { useSyncExternalStore } from "react";

// Never actually changes after mount, so there's nothing to subscribe to -- this value
// only exists so useSyncExternalStore knows never to re-invoke getSnapshot on its own.
function subscribe() {
  return () => {};
}

function getSnapshot(): boolean {
  const isAppleUA = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // iPadOS 13+ reports as "MacIntel" with no "iPad" in the UA string -- a real Mac never
  // has touch support, which is what actually distinguishes the two.
  const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleUA || isTouchMac;
}

function getServerSnapshot(): boolean {
  return false;
}

// iOS's numeric/decimal virtual keyboards have no minus key at all; Android's generally
// do, so this stays scoped to iOS specifically instead of falling back to a plain-text
// keyboard for everyone. useSyncExternalStore (not useState+useEffect) is the pattern
// React itself recommends for a client-only value like this -- it renders
// getServerSnapshot's value during SSR/hydration and lets React reconcile the real client
// value afterward without a manual setState-in-effect render pass.
export function useIsIOS(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
