// All display timestamps in this app render server-side (Server Components), where the
// runtime's default timezone is whatever the host uses (Netlify's functions default to
// UTC) -- not the group's actual timezone. Hardcoding Eastern here since that's where the
// group actually is; `toLocaleString` with no explicit `timeZone` silently uses the
// server's, not the viewer's, which is what caused times to read several hours off.
const EASTERN_TZ = "America/New_York";

export function formatGameTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: EASTERN_TZ,
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, { timeZone: EASTERN_TZ });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { timeZone: EASTERN_TZ });
}
