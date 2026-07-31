/**
 * Shared server-driven view-mode resolution (Task #324).
 *
 * Replaces the hardcoded mapLoggedRoleToUIRole() at every auth call site.
 * Policy:
 *   • HARDCODED BYPASS: Office/'Sail Admin' resolves to Sail_Admin locally,
 *     no network — a bad DB mapping can never lock out the fixer role.
 *   • FAIL CLOSED: server errors → status 'error' (block + retry);
 *     unmapped/unknown roles or codes outside the known UIRole set →
 *     status 'blocked'. No default-open fallthrough.
 *
 * Both AuthContext and UIRoleContext call this with the same inputs; the
 * shared TanStack cache key means one network request per login.
 */
import { useQuery } from "@tanstack/react-query";
import type { UIRole } from "@shared/uiRoles";
import { UI_ROLES } from "@shared/uiRoles";
import { peekAccessToken } from "@/lib/authToken";

export const SAIL_ADMIN_BYPASS: { userType: string; role: string } = {
  userType: "Office",
  role: "Sail Admin",
};

export type ViewModeStatus =
  | "idle"
  | "loading"
  | "error"
  | "blocked"
  | "resolved"
  | "unauthenticated";

/** Error carrying the HTTP status so auth failures (401/403) are distinguishable. */
class ResolveHttpError extends Error {
  constructor(
    public readonly status: number,
    /** Whether an Authorization header was attached to the failed request. */
    public readonly hadToken: boolean,
  ) {
    super(`resolve failed: ${status}`);
  }
}

function isAuthFailure(error: unknown): boolean {
  return (
    error instanceof ResolveHttpError &&
    (error.status === 401 || error.status === 403)
  );
}

export interface ViewModeResolution {
  uiRole: UIRole | null;
  status: ViewModeStatus;
  /** Machine-readable reason when blocked (ROLE_NOT_FOUND / ROLE_NOT_MAPPED / UNKNOWN_MODE). */
  reason: string | null;
  retry: () => void;
}

interface ResolveResponse {
  mode: string | null;
  reason: string | null;
}

function isKnownUIRole(mode: string | null): mode is UIRole {
  return !!mode && (UI_ROLES as string[]).includes(mode);
}

export function useViewModeResolution(
  userType: string | null | undefined,
  role: string | null | undefined,
): ViewModeResolution {
  const hasInputs = !!userType && !!role;
  const isBypass =
    userType === SAIL_ADMIN_BYPASS.userType && role === SAIL_ADMIN_BYPASS.role;

  const query = useQuery<ResolveResponse>({
    // Explicit segmented key (not a template string) so prefix invalidation works.
    queryKey: ["/technical/api/admin/role-view-mappings/resolve", userType, role],
    queryFn: async () => {
      const params = new URLSearchParams({
        userType: userType || "",
        role: role || "",
      });
      // Attach the Bearer explicitly (same pattern as apiRequest/getQueryFn in
      // lib/queryClient) instead of relying solely on the global fetch
      // interceptor — a silent token-read failure would otherwise send this
      // request with no Authorization header at all. peekAccessToken (not
      // getAccessToken) so a missing token does NOT trigger the token-layer
      // redirect: the request goes out, the server 401s, and the gate — the
      // single redirect authority — clears the stale session before /login.
      const token = peekAccessToken();
      const res = await fetch(
        `/technical/api/admin/role-view-mappings/resolve?${params.toString()}`,
        {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Field-diagnosable 401s: say whether a token was even attached, so
          // "server rejected the session" vs "token never decrypted locally"
          // can be told apart from the vessel's browser console.
          console.warn(
            `[view-mode] resolve returned ${res.status} — access token ${
              token ? "WAS attached (server rejected the session)" : "was NOT attached (local token read/decrypt failed)"
            }`,
          );
        }
        throw new ResolveHttpError(res.status, !!token);
      }
      return res.json();
    },
    enabled: hasInputs && !isBypass,
    staleTime: 5 * 60 * 1000,
    // Retrying an expired/invalid session (401/403) can never succeed — skip
    // the retry for auth failures; transient failures keep one retry.
    retry: (failureCount, error) => !isAuthFailure(error) && failureCount < 1,
  });

  if (isBypass) {
    return { uiRole: "Sail_Admin", status: "resolved", reason: null, retry: () => {} };
  }
  if (!hasInputs) {
    return { uiRole: null, status: "idle", reason: null, retry: () => {} };
  }
  if (query.isLoading) {
    return { uiRole: null, status: "loading", reason: null, retry: () => query.refetch() };
  }
  if (query.isError && isAuthFailure(query.error)) {
    // Session expired/invalid (401/403). Still fail-closed — no mode is ever
    // guessed — but the gate can send the user back to login (non-Replit only).
    return { uiRole: null, status: "unauthenticated", reason: "UNAUTHENTICATED", retry: () => query.refetch() };
  }
  if (query.isError || !query.data) {
    // FAIL CLOSED on transport/server failure — never guess a mode.
    return { uiRole: null, status: "error", reason: "RESOLVE_FAILED", retry: () => query.refetch() };
  }
  const { mode, reason } = query.data;
  if (!isKnownUIRole(mode)) {
    return {
      uiRole: null,
      status: "blocked",
      reason: reason || "UNKNOWN_MODE",
      retry: () => query.refetch(),
    };
  }
  return { uiRole: mode, status: "resolved", reason: null, retry: () => query.refetch() };
}
