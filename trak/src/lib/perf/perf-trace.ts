const NAVIGATION_ID_HEADER = "x-trak-nav-id";
const PERF_SOURCE_HEADER = "x-trak-perf-source";
const CLIENT_NAVIGATION_KEY = "__TRAK_PERF_NAVIGATION_ID__";

type PerfHeaderValue = string | number | boolean | null | undefined;

declare global {
  interface Window {
    __TRAK_PERF_NAVIGATION_ID__?: string | null;
  }
}

export function isClientPerfDebugEnabled() {
  return process.env.NEXT_PUBLIC_PERF_DEBUG === "1";
}

export function isServerPerfDebugEnabled() {
  return process.env.PERF_DEBUG === "1";
}

export function createPerfNavigationId(prefix = "nav") {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

export function setCurrentPerfNavigationId(navigationId?: string | null) {
  if (typeof window === "undefined") return;
  window[CLIENT_NAVIGATION_KEY] = navigationId ?? null;
}

export function getCurrentPerfNavigationId() {
  if (typeof window === "undefined") return null;
  return window[CLIENT_NAVIGATION_KEY] ?? null;
}

export function buildClientPerfHeaders(input?: {
  navigationId?: string | null;
  source?: string | null;
  extra?: Record<string, PerfHeaderValue>;
}) {
  const headers = new Headers();
  const navigationId = input?.navigationId ?? getCurrentPerfNavigationId();

  if (navigationId) {
    headers.set(NAVIGATION_ID_HEADER, navigationId);
  }

  if (input?.source) {
    headers.set(PERF_SOURCE_HEADER, input.source);
  }

  if (input?.extra) {
    for (const [key, value] of Object.entries(input.extra)) {
      if (value == null) continue;
      headers.set(`x-trak-perf-${key}`, String(value));
    }
  }

  return Object.fromEntries(headers.entries());
}

export function getPerfRequestContext(
  request:
    | Request
    | {
        headers?: Headers;
      }
) {
  const headers = request.headers instanceof Headers ? request.headers : new Headers();

  return {
    navigationId: headers.get(NAVIGATION_ID_HEADER),
    source: headers.get(PERF_SOURCE_HEADER),
  };
}

export function formatPerfContext(context: {
  navigationId?: string | null;
  source?: string | null;
}) {
  const parts: string[] = [];
  if (context.navigationId) parts.push(`nav=${context.navigationId}`);
  if (context.source) parts.push(`source=${context.source}`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function logClientPerf(message: string) {
  if (!isClientPerfDebugEnabled()) return;
  console.log(message);
}

export function logClientInvalidation(
  scope: string,
  queryKey: readonly unknown[] | unknown[],
  extra?: string
) {
  if (!isClientPerfDebugEnabled()) return;
  const serializedKey = JSON.stringify(queryKey);
  console.log(
    `[PERF] client invalidate scope=${scope} key=${serializedKey}${extra ? ` ${extra}` : ""}`
  );
}
