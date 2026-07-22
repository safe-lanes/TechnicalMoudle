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

export const SAIL_ADMIN_BYPASS: { userType: string; role: string } = {
  userType: "Office",
  role: "Sail Admin",
};

export type ViewModeStatus = "idle" | "loading" | "error" | "blocked" | "resolved";

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
      const res = await fetch(
        `/technical/api/admin/role-view-mappings/resolve?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        throw new Error(`resolve failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: hasInputs && !isBypass,
    staleTime: 5 * 60 * 1000,
    retry: 1,
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
