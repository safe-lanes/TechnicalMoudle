import { useQuery } from "@tanstack/react-query";

interface ApprovalPolicy {
  superintendentLockEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

/**
 * Company approval policy (migration 137) — currently the Superintendent lock
 * toggle. Shore-configured, synced to ships; both sides READ it to render the
 * effective approval tier. Fail-safe default: lock ENABLED (matches the
 * server's fail-safe), so a fetch error never visually unlocks anything.
 */
export function useApprovalPolicy() {
  const { data, isLoading } = useQuery<ApprovalPolicy>({
    queryKey: ["/technical/api/approval-policy"],
    staleTime: 60_000,
  });
  return {
    superintendentLockEnabled: data?.superintendentLockEnabled ?? true,
    isLoading,
    policy: data,
  };
}

/**
 * The tier to RENDER (and gate buttons on): a stamped 'superintendent_locked'
 * behaves as 'superintendent_notification' while the company lock toggle is
 * OFF — mirrors the server's live enforcement downgrade exactly.
 */
export function effectiveApprovalTier(
  storedTier: string | null | undefined,
  superintendentLockEnabled: boolean
): string {
  const tier = storedTier || "standard";
  if (tier === "superintendent_locked" && !superintendentLockEnabled) {
    return "superintendent_notification";
  }
  return tier;
}
