import type { ResearchProviderSource } from "./types";

// Live usage/limit status for each research vendor, read from each vendor's own usage
// endpoint -- shapes below are confirmed against real responses (2026-10-03), except
// ParlayAPI's, whose usage endpoint is documented but has no published response schema and
// was down when this was built. Its fields are shown as returned, never guessed at.

export type UsageRow = { label: string; value: string; detail?: string };

export type ProviderStatus = {
  source: ResearchProviderSource;
  name: string;
  live: boolean; // false = the app is serving this vendor's offline mock fixtures
  keyConfigured: boolean;
  state: "ok" | "error" | "no_key";
  message?: string;
  usage: UsageRow[];
  reset?: string;
  limitsNote: string;
  dashboardUrl: string;
};

const fmt = (n: number) => n.toLocaleString("en-US");

function errorMessage(status: number, vendor: string): string {
  if (status === 401 || status === 403) return `${vendor} rejected the API key (${status}).`;
  if (status === 429) return `${vendor} says you're over a rate limit right now (429).`;
  if (status >= 500) return `${vendor}'s servers are returning errors (${status}) -- an outage on their side, not your quota.`;
  return `${vendor} returned ${status}.`;
}

async function getJson(url: string, headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON error page
  }
  return { status: res.status, body };
}

type SgoLimit = { "max-requests"?: number | string; "current-requests"?: number; "max-entities"?: number | string; "current-entities"?: number };

async function sportsGameOddsStatus(): Promise<Omit<ProviderStatus, "source" | "name" | "live" | "dashboardUrl">> {
  const key = process.env.SPORTS_GAME_ODDS_API_KEY;
  const limitsNote = "Free \"amateur\" tier: 2,500 entities/month (one entity is roughly one event's worth of odds), 10 requests/minute.";
  if (!key) return { keyConfigured: false, state: "no_key", usage: [], limitsNote };
  try {
    const { status, body } = await getJson("https://api.sportsgameodds.com/v2/account/usage/", { "X-Api-Key": key });
    const data = (body as { data?: { tier?: string; rateLimits?: Record<string, SgoLimit> } } | null)?.data;
    if (status !== 200 || !data?.rateLimits) return { keyConfigured: true, state: "error", message: errorMessage(status, "SportsGameOdds"), usage: [], limitsNote };
    const month = data.rateLimits["per-month"] ?? {};
    const minute = data.rateLimits["per-minute"] ?? {};
    const maxEntities = typeof month["max-entities"] === "number" ? month["max-entities"] : null;
    const usedEntities = month["current-entities"] ?? 0;
    const usage: UsageRow[] = [
      maxEntities !== null
        ? { label: "This month", value: `${fmt(maxEntities - usedEntities)} entities left`, detail: `${fmt(usedEntities)} of ${fmt(maxEntities)} used` }
        : { label: "This month", value: `${fmt(usedEntities)} entities used`, detail: "no monthly cap" },
      { label: "This minute", value: `${fmt(minute["current-requests"] ?? 0)} of ${minute["max-requests"]} requests` },
    ];
    return {
      keyConfigured: true,
      state: "ok",
      usage,
      // SportsGameOdds' usage response doesn't include the billing-period anchor.
      reset: "Monthly allowance -- SportsGameOdds doesn't report the exact reset date.",
      limitsNote: data.tier ? limitsNote.replace("\"amateur\"", `"${data.tier}"`) : limitsNote,
    };
  } catch {
    return { keyConfigured: true, state: "error", message: "Couldn't reach SportsGameOdds.", usage: [], limitsNote };
  }
}

async function sharpApiStatus(): Promise<Omit<ProviderStatus, "source" | "name" | "live" | "dashboardUrl">> {
  const key = process.env.SHARPAPI_KEY;
  const limitsNote = "Free tier: 12 requests/minute and 2 sportsbooks (DraftKings + FanDuel), data delayed 60s. No daily or monthly cap.";
  if (!key) return { keyConfigured: false, state: "no_key", usage: [], limitsNote };
  try {
    const { status, body } = await getJson("https://api.sharpapi.io/api/v1/account/usage", { "X-API-Key": key });
    const data = (body as { data?: { requests_today?: number; rate_limit?: { limit?: number; remaining?: number; reset?: number } } } | null)?.data;
    if (status !== 200 || !data?.rate_limit) return { keyConfigured: true, state: "error", message: errorMessage(status, "SharpAPI"), usage: [], limitsNote };
    const rl = data.rate_limit;
    const usage: UsageRow[] = [
      { label: "This minute", value: `${rl.remaining ?? "?"} of ${rl.limit ?? "?"} requests left` },
      { label: "Today", value: `${fmt(data.requests_today ?? 0)} request${data.requests_today === 1 ? "" : "s"}` },
    ];
    const reset = rl.reset ? `Per-minute window resets ${new Date(rl.reset * 1000).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET.` : undefined;
    return { keyConfigured: true, state: "ok", usage, reset, limitsNote };
  } catch {
    return { keyConfigured: true, state: "error", message: "Couldn't reach SharpAPI.", usage: [], limitsNote };
  }
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function parlayApiStatus(): Promise<Omit<ProviderStatus, "source" | "name" | "live" | "dashboardUrl">> {
  const key = process.env.PARLAY_API_KEY;
  const limitsNote = "Free tier: 1,000 credits/month (a whole-slate Game Lines pull is ~3 credits; one game's props ~3). $5/mo Starter tier raises this to 20,000.";
  if (!key) return { keyConfigured: false, state: "no_key", usage: [], limitsNote };
  try {
    const { status, body } = await getJson("https://parlay-api.com/v1/usage", { "X-API-Key": key.trim() });
    if (status !== 200 || !body || typeof body !== "object") {
      return { keyConfigured: true, state: "error", message: errorMessage(status, "ParlayAPI"), usage: [], limitsNote };
    }
    // No published response schema -- show the top-level scalar fields exactly as returned
    // rather than guessing which ones mean "remaining" or "resets at".
    const usage = Object.entries(body as Record<string, unknown>)
      .filter(([, v]) => typeof v === "number" || typeof v === "string" || typeof v === "boolean")
      .slice(0, 10)
      .map(([k, v]) => ({ label: humanizeKey(k), value: typeof v === "number" ? fmt(v) : String(v) }));
    return { keyConfigured: true, state: "ok", usage, limitsNote };
  } catch {
    return { keyConfigured: true, state: "error", message: "Couldn't reach ParlayAPI.", usage: [], limitsNote };
  }
}

const META: Record<ResearchProviderSource, { name: string; envFlag: string; liveValue: string; dashboardUrl: string }> = {
  parlayapi: { name: "ParlayAPI", envFlag: "PARLAYAPI_PROVIDER", liveValue: "parlayapi", dashboardUrl: "https://parlay-api.com/dashboard" },
  sportsgameodds: { name: "SportsGameOdds", envFlag: "SPORTSGAMEODDS_PROVIDER", liveValue: "sportsgameodds", dashboardUrl: "https://sportsgameodds.com" },
  sharpapi: { name: "SharpAPI", envFlag: "SHARPAPI_PROVIDER", liveValue: "sharpapi", dashboardUrl: "https://sharpapi.io" },
};

const FETCHERS: Record<ResearchProviderSource, () => ReturnType<typeof parlayApiStatus>> = {
  parlayapi: parlayApiStatus,
  sportsgameodds: sportsGameOddsStatus,
  sharpapi: sharpApiStatus,
};

export async function getProviderStatuses(order: ResearchProviderSource[]): Promise<ProviderStatus[]> {
  return Promise.all(
    order.map(async (source) => {
      const meta = META[source];
      const status = await FETCHERS[source]();
      return {
        source,
        name: meta.name,
        live: process.env[meta.envFlag] === meta.liveValue,
        dashboardUrl: meta.dashboardUrl,
        ...status,
      };
    }),
  );
}
