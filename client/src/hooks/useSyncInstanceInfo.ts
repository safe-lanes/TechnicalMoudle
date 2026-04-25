/**
 * Hook to determine if this instance is a ship or shore server.
 * Caches the result - instance type doesn't change during a session.
 *
 * Usage:
 *   const { isShip, isShore, instanceId } = useSyncInstanceInfo();
 *   if (isShore) { // show fleet overview }
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SyncInstanceInfo {
  instanceId: string;
  isShore: boolean;
  isShip: boolean;
  instanceType: "ship" | "shore";
}

export function useSyncInstanceInfo() {
  const { data, isLoading } = useQuery<SyncInstanceInfo>({
    queryKey: ["/technical/api/sync/instance-info"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/technical/api/sync/instance-info");
      return res.json();
    },
    staleTime: Infinity, // Never refetch — instance type doesn't change
    gcTime: Infinity,
  });

  return {
    isShip: data?.isShip ?? false,
    isShore: data?.isShore ?? true, // Default to shore for backward compatibility
    instanceId: data?.instanceId ?? "UNKNOWN",
    instanceType: data?.instanceType ?? "shore",
    isLoading,
  };
}
