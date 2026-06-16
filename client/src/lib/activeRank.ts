import { getAccessToken } from "./authToken";

let activeRank: string | null = null;
const listeners = new Set<(rank: string | null) => void>();

const API_PREFIX = "/technical/api";

export function isApiUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith(API_PREFIX) || url.startsWith("/" + API_PREFIX.replace(/^\//, ""))) {
    return true;
  }
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith(API_PREFIX);
  } catch {
    return false;
  }
}

export function getActiveRank(): string | null {
  return activeRank;
}

export function setActiveRank(rank: string | null | undefined): boolean {
  const next = rank && rank.trim() ? rank.trim() : null;
  if (next === activeRank) return false;
  activeRank = next;
  for (const listener of Array.from(listeners)) {
    try {
      listener(activeRank);
    } catch (err) {
      console.error("[activeRank] listener error:", err);
    }
  }
  return true;
}

export function subscribeActiveRank(listener: (rank: string | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let installed = false;

export function installRankFetchInterceptor(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rank = getActiveRank();
    const token = getAccessToken();
    if (!rank && !token) {
      return originalFetch(input, init);
    }

    let url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    }

    if (!isApiUrl(url)) {
      return originalFetch(input, init);
    }

    if (input instanceof Request) {
      const merged = new Headers(input.headers);
      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => {
          merged.set(key, value);
        });
      }
      if (rank && !merged.has("x-rank")) {
        merged.set("x-rank", rank);
      }
      if (token && !merged.has("authorization")) {
        merged.set("Authorization", `Bearer ${token}`);
      }
      return originalFetch(input, { ...init, headers: merged });
    }

    const headers = new Headers(init?.headers);
    if (rank && !headers.has("x-rank")) {
      headers.set("x-rank", rank);
    }
    if (token && !headers.has("authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return originalFetch(input, { ...init, headers });
  };
}
