import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface RejectionHistoryEntry {
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionComments: string | null;
  /** Distinguishes approver (pending-approval) rejections from superintendent completion rejections */
  rejectionType?: 'approver_rejection' | 'superintendent_completion_rejection';
}

interface RejectionHistoryBadgeProps {
  workOrderId: string;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function RejectionHistoryBadge({ workOrderId }: RejectionHistoryBadgeProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError } = useQuery<RejectionHistoryEntry[]>({
    queryKey: ["/technical/api/work-orders", workOrderId, "rejection-history"],
    queryFn: async () => {
      const res = await fetch(
        `/technical/api/work-orders/${encodeURIComponent(workOrderId)}/rejection-history`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return (await res.json()) as RejectionHistoryEntry[];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const latest = data && data.length > 0 ? data[0] : null;
  const earlier = data && data.length > 1 ? data.slice(1) : [];

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            role="button"
            aria-label="View previous rejection details"
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white cursor-help focus:outline-none focus:ring-2 focus:ring-red-400"
            style={{ background: "#E53935" }}
            data-testid={`badge-resubmitted-${workOrderId}`}
          >
            Resubmitted
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-sm bg-white text-gray-900 border border-gray-200 shadow-lg p-3"
          data-testid={`tooltip-rejection-history-${workOrderId}`}
        >
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading rejection history…
            </div>
          )}
          {isError && (
            <div className="text-xs text-red-600">
              Could not load rejection history.
            </div>
          )}
          {!isLoading && !isError && !latest && (
            <div className="text-xs text-gray-600">
              No prior rejection details available.
            </div>
          )}
          {!isLoading && !isError && latest && (
            <div className="space-y-2 text-xs">
              <div className="font-semibold text-gray-900 text-[11px] uppercase tracking-wide">
                Previous Rejection
              </div>
              <div>
                <span className="font-medium text-gray-700">Reason: </span>
                <span
                  className="text-gray-900 whitespace-pre-wrap"
                  data-testid={`text-rejection-reason-${workOrderId}`}
                >
                  {latest.rejectionComments?.trim() || "No reason recorded"}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-700">
                <div>
                  <span className="font-medium">Rejected by: </span>
                  <span data-testid={`text-rejected-by-${workOrderId}`}>
                    {latest.rejectedBy || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">When: </span>
                  <span data-testid={`text-rejected-at-${workOrderId}`}>
                    {formatDate(latest.rejectedAt)}
                  </span>
                </div>
              </div>
              {earlier.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide mb-1">
                    Earlier rejections ({earlier.length})
                  </div>
                  <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {earlier.map((entry, idx) => (
                      <li
                        key={`${entry.rejectedAt}-${idx}`}
                        className="text-gray-700"
                        data-testid={`item-rejection-history-${workOrderId}-${idx}`}
                      >
                        <span className="text-gray-500">
                          {formatDate(entry.rejectedAt)} —{" "}
                          {entry.rejectedBy || "Unknown"}:
                        </span>{" "}
                        <span className="text-gray-900">
                          {entry.rejectionComments?.trim() || "No reason recorded"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
