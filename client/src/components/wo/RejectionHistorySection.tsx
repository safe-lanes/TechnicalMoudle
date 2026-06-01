import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import type { RejectionHistoryEntry } from "./RejectionHistoryBadge";

type EntityType = "work-order" | "change-request";

interface RejectionHistorySectionProps {
  entityType?: EntityType;
  entityId?: string | number;
  workOrderId?: string;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function buildEndpoint(entityType: EntityType, entityId: string | number): string {
  const id = encodeURIComponent(String(entityId));
  switch (entityType) {
    case "change-request":
      return `/technical/api/change-requests/${id}/rejection-history`;
    case "work-order":
    default:
      return `/technical/api/work-orders/${id}/rejection-history`;
  }
}

function buildQueryKey(entityType: EntityType, entityId: string | number): unknown[] {
  switch (entityType) {
    case "change-request":
      return ["/technical/api/change-requests", entityId, "rejection-history"];
    case "work-order":
    default:
      return ["/technical/api/work-orders", entityId, "rejection-history"];
  }
}

export function RejectionHistorySection(props: RejectionHistorySectionProps) {
  const entityType: EntityType = props.entityType ?? "work-order";
  const entityId = props.entityId ?? props.workOrderId ?? "";
  const testIdSuffix = String(entityId);

  const { data, isLoading, isError } = useQuery<RejectionHistoryEntry[]>({
    queryKey: buildQueryKey(entityType, entityId),
    queryFn: async () => {
      const res = await fetch(buildEndpoint(entityType, entityId), {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return (await res.json()) as RejectionHistoryEntry[];
    },
    enabled: Boolean(entityId),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div
        className="rounded-md border border-gray-200 bg-gray-50 p-4 flex items-center gap-2 text-sm text-gray-600"
        data-testid={`section-rejection-history-loading-${testIdSuffix}`}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading rejection history…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        data-testid={`section-rejection-history-error-${testIdSuffix}`}
      >
        Could not load rejection history.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 p-4"
      data-testid={`section-rejection-history-${testIdSuffix}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-700" />
        <h3
          className="text-sm font-bold text-red-800 uppercase tracking-wide"
          data-testid={`heading-rejection-history-${testIdSuffix}`}
        >
          Rejection History ({data.length})
        </h3>
      </div>
      <ul className="space-y-3">
        {data.map((entry, idx) => {
          const isSuperRejection = entry.rejectionType === 'superintendent_completion_rejection';
          return (
            <li
              key={`${entry.rejectedAt ?? "unknown"}-${idx}`}
              className={`rounded-md border p-3 ${isSuperRejection ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-white'}`}
              data-testid={`item-rejection-history-${testIdSuffix}-${idx}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
                <span
                  className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${isSuperRejection ? 'bg-amber-200 text-amber-800' : 'bg-red-100 text-red-800'}`}
                  data-testid={`badge-rejection-type-${testIdSuffix}-${idx}`}
                >
                  {isSuperRejection ? 'Superintendent — Completion Rejected' : 'Approver — Pending Approval Rejected'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700 mb-1">
                <div>
                  <span className="font-medium">Rejected by: </span>
                  <span
                    className="text-gray-900"
                    data-testid={`text-rejection-history-by-${testIdSuffix}-${idx}`}
                  >
                    {entry.rejectedBy || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">When: </span>
                  <span
                    className="text-gray-900"
                    data-testid={`text-rejection-history-at-${testIdSuffix}-${idx}`}
                  >
                    {formatDate(entry.rejectedAt)}
                  </span>
                </div>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Reason: </span>
                <span
                  className="text-gray-900 whitespace-pre-wrap"
                  data-testid={`text-rejection-history-reason-${testIdSuffix}-${idx}`}
                >
                  {entry.rejectionComments?.trim() || "No reason recorded"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
