import { useQuery } from "@tanstack/react-query";

/**
 * Reads the server's approval rollout flags so the client read-only gates track the
 * server resolver. `vesselScopeStrict` on (default): out-of-scope users get read-only
 * (no Approve/Reject); off: legacy behaviour (empty assignment list = fleet-wide).
 *
 * Fail-soft to STRICT (true) — matches the server default; a missing endpoint (older
 * server) errs on the safe, more-restrictive side rather than silently granting access.
 */
export function useApprovalScopeConfig(): { vesselScopeStrict: boolean } {
  const { data } = useQuery({
    queryKey: ["/technical/api/approvals/config"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<{ vesselScopeStrict: boolean }> => {
      const res = await fetch("/technical/api/approvals/config");
      if (!res.ok) return { vesselScopeStrict: true };
      return res.json();
    },
  });
  return { vesselScopeStrict: data?.vesselScopeStrict ?? true };
}
