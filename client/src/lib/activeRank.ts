import { getAccessToken } from "./authToken";

let activeRank: string | null = null;
const listeners = new Set<(rank: string | null) => void>();

/**
 * Audit Phase 0 — identity threading. In integrated SAILERP the authenticated identity lives
 * in AuthContext.currentUser; we mirror the audit-relevant fields here so the fetch interceptor
 * can forward them to PMS on every /technical/api call (parallel to x-rank). The server reads
 * these in mockAuthMiddleware and stamps them onto audit records. Empty in standalone dev.
 */
export interface ActiveIdentity {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  userType?: string | null;
  role?: string | null;
}
let activeIdentity: ActiveIdentity = {};

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

export function getActiveIdentity(): ActiveIdentity {
  return activeIdentity;
}

/** Set (or clear, with {}) the forwarded identity. Trims/normalizes blanks to null. */
export function setActiveIdentity(identity: ActiveIdentity | null | undefined): void {
  const norm = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  activeIdentity = identity
    ? {
        userId: norm(identity.userId),
        name: norm(identity.name),
        email: norm(identity.email),
        userType: norm(identity.userType),
        role: norm(identity.role),
      }
    : {};
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
    const token = getAccessToken();              // (b) replit-work auth: Bearer token
    const identity = getActiveIdentity();        // (c) Phase 0 audit: x-user-* identity
    const hasIdentity = !!(
      identity.userId ||
      identity.name ||
      identity.email ||
      identity.userType ||
      identity.role
    );
    // Office users have a null rank — still forward identity. Skip only when rank, token AND
    // identity are ALL absent (preserves the audit fix: null-rank office users still forward identity).
    if (!rank && !token && !hasIdentity) {
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

    // Inject auth/audit headers without overwriting any the caller already set.
    const applyAuthHeaders = (h: Headers) => {
      if (rank && !h.has("x-rank")) h.set("x-rank", rank);                                   // (a) x-rank
      if (token && !h.has("authorization")) h.set("Authorization", `Bearer ${token}`);        // (b) Bearer token
      if (identity.userId && !h.has("x-user-id")) h.set("x-user-id", encodeURIComponent(identity.userId)); // (c) x-user-*
      if (identity.name && !h.has("x-user-name")) h.set("x-user-name", encodeURIComponent(identity.name));
      if (identity.email && !h.has("x-user-email")) h.set("x-user-email", encodeURIComponent(identity.email));
      if (identity.userType && !h.has("x-user-type")) h.set("x-user-type", encodeURIComponent(identity.userType));
      if (identity.role && !h.has("x-user-role")) h.set("x-user-role", encodeURIComponent(identity.role));
    };

    if (input instanceof Request) {
      const merged = new Headers(input.headers);
      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => {
          merged.set(key, value);
        });
      }
      applyAuthHeaders(merged);
      return originalFetch(input, { ...init, headers: merged });
    }

    const headers = new Headers(init?.headers);
    applyAuthHeaders(headers);
    return originalFetch(input, { ...init, headers });
  };
}
