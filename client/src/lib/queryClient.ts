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
