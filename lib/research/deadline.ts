// Per-request cap for every external odds/stats call. Without one, a single vendor that hangs
// keeps the whole federated response waiting until Netlify kills the function at 30s, and the
// phone gets nothing -- even though the other providers answered in a second or two.
export const VENDOR_FETCH_TIMEOUT_MS = 8000;

// How long a federated lookup waits for its slowest provider before answering with whoever
// has responded. Under Netlify's 30s function limit with room to spare.
export const FEDERATION_DEADLINE_MS = 12000;

// Above this, a provider's time is logged so a slow vendor shows up by name in `netlify logs`.
const SLOW_LOG_MS = 3000;

// Rejects if `promise` hasn't settled within `ms`, and logs slow-but-finished work. The
// underlying request still finishes (or hits its own fetch timeout) in the background; this
// only stops the caller from waiting on it.
export function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} gave no answer within ${ms}ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => {
    clearTimeout(timer);
    const took = Date.now() - started;
    if (took > SLOW_LOG_MS) console.warn(`[research] slow: ${label} took ${took}ms`);
  });
}

// True for the error a fetch throws when its AbortSignal.timeout fires.
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
