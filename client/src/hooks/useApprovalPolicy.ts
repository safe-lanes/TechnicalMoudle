import { useQuery } from "@tanstack/react-query";

interface VesselApprovalPolicy {
  vesselId: string;
  superintendentLockEnabled?: boolean | null;
}

/**
 * Vessel-specific Superintendent approval lock (migration 168). Missing
 * settings deliberately resolve to OFF, matching the requested default and
 * the server's authoritative policy resolution.
 */
export function useApprovalPolicy() {
  const { data: settings = [], isLoading } = useQuery<VesselApprovalPolicy[]>({
    queryKey: ["/technical/api/pms-vessel-settings"],
    staleTime: 60_000,
  });

  const isSuperintendentLockEnabled = (vesselId: string | null | undefined) =>
    !!vesselId && settings.find((setting) => setting.vesselId === vesselId)?.superintendentLockEnabled === true;

  return {
    isSuperintendentLockEnabled,
    isLoading,
    settings,
  };
}

/**
 * The tier to RENDER (and gate buttons on): a stamped 'superintendent_locked'
 * behaves as 'superintendent_notification' while its vessel lock is OFF —
 * mirrors the server's live enforcement downgrade exactly.
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
