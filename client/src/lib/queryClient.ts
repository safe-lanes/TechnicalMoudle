import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { installRankFetchInterceptor } from "./activeRank";

installRankFetchInterceptor();

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Stale time configuration for different data types
 * - Critical data (components, jobs, work orders): 2 minutes
 * - Reference data (vessels, categories): 5 minutes
 * - This ensures eventual consistency while still providing good performance
 */
export const STALE_TIMES = {
  CRITICAL: 2 * 60 * 1000,    // 2 minutes for frequently changing data
  REFERENCE: 5 * 60 * 1000,   // 5 minutes for reference/master data
  STATIC: 30 * 60 * 1000,     // 30 minutes for rarely changing data
} as const;

/**
 * Invalidate every cached query whose first queryKey element is a string that
 * matches one of the given URL prefixes (exact, or followed by `/` or `?`).
 *
 * The shared fetcher (getQueryFn) loads data using ONLY queryKey[0], so the full
 * request URL — including `?itemType=...&vesselIds=...&scope=...` and pagination —
 * is stored as that first element. TanStack Query compares key elements by exact
 * deep-equality, so a plain `invalidateQueries({ queryKey: ['/x/123'] })` will NOT
 * match a list stored under `['/x/123?itemType=ROB']` or under a different scope
 * segment (e.g. `all` vs `my` vs a vessel id). Matching on the URL prefix instead
 * refreshes every variant of a list regardless of its query-string parameters or
 * vessel scope.
 *
 * Convention for new mutations: invalidate the list's base URL via this helper
 * rather than reconstructing the exact full-URL key by hand.
 */
export function invalidateByUrlPrefix(prefixes: string | string[]) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key0 = query.queryKey?.[0];
      if (typeof key0 !== "string") return false;
      return list.some(
        (p) => key0 === p || key0.startsWith(`${p}/`) || key0.startsWith(`${p}?`),
      );
    },
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: STALE_TIMES.CRITICAL, // Default to 2 minutes for safety
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
