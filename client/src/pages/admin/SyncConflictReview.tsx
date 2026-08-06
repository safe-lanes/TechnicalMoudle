/**
 * Sync Conflict Review
 *
 * Unified view over sync_conflict_log (new per-field stale-skip rejections)
 * and sync_conflicts (older pull/resolve conflicts).
 *
 * Route: /admin/sync-conflicts
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertTriangle,
} from "lucide-react";

// ── Types ──

interface ConflictSide {
  value: string | null;
  changedAt: string | null;
  instanceId: string;
  userId: string | null;
  userName: string;
  locationLabel: string;
}

interface EnrichedConflict {
  id: number;
  source: "log" | "old";
  detectedAt: string;
  batchUuid: string | null;
  tableName: string;
  tableDisplayName: string;
  rowUuid: string;
  recordDisplay: string;
  fieldName: string;
  fieldDisplayName: string;
  winner: ConflictSide;
  rejected: ConflictSide;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedAction: string | null;
}

interface ConflictListResponse {
  rows: EnrichedConflict[];
  total: number;
}

// ── Helpers ──

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function truncateValue(value: string | null, max = 120): string {
  if (value === null || value === undefined) return "(null)";
  if (value.length <= max) return value;
  return value.substring(0, max) + "...";
}

// ── Component ──

export default function SyncConflictReview() {
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const canEditConflicts = canEdit("admin-sync-conflicts");

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("unresolved");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "apply" | "dismiss";
    conflict: EnrichedConflict | null;
  }>({ open: false, action: "apply", conflict: null });

  // ── Data Queries ──

  const conflictsQuery = useQuery<ConflictListResponse>({
    queryKey: [
      "/technical/api/sync/conflicts/review",
      statusFilter,
      tableFilter,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("resolved", statusFilter === "resolved" ? "true" : "false");
      if (tableFilter !== "all") params.set("tableName", tableFilter);
      params.set("limit", String(pageSize));
      params.set("offset", String(page * pageSize));

      const res = await fetch(
        `/technical/api/sync/conflicts/review?${params}`
      );
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const tablesQuery = useQuery<{ tables: string[] }>({
    queryKey: ["/technical/api/sync/conflicts/review/tables"],
    queryFn: async () => {
      const res = await fetch("/technical/api/sync/conflicts/review/tables");
      if (!res.ok) return { tables: [] };
      return res.json();
    },
  });

  // ── Mutations ──

  const applyMutation = useMutation({
    mutationFn: async ({
      id,
      source,
    }: {
      id: number;
      source: "log" | "old";
    }) => {
      const res = await apiRequest(
        "POST",
        `/technical/api/sync/conflicts/review/${id}/apply-incoming`,
        { source }
      );
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Conflict resolved",
        description: "Incoming value applied — will sync on next cycle",
      });
      queryClient.invalidateQueries({
        queryKey: ["/technical/api/sync/conflicts/review"],
      });
      setConfirmDialog({ open: false, action: "apply", conflict: null });
    },
    onError: (err: any) => {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async ({
      id,
      source,
    }: {
      id: number;
      source: "log" | "old";
    }) => {
      const res = await apiRequest(
        "POST",
        `/technical/api/sync/conflicts/review/${id}/dismiss`,
        { source }
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Conflict dismissed" });
      queryClient.invalidateQueries({
        queryKey: ["/technical/api/sync/conflicts/review"],
      });
      setConfirmDialog({ open: false, action: "dismiss", conflict: null });
    },
    onError: (err: any) => {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const rows = conflictsQuery.data?.rows ?? [];
  const total = conflictsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const tables = tablesQuery.data?.tables ?? [];
  const isActioning = applyMutation.isPending || dismissMutation.isPending;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1
          className="text-2xl font-bold text-black"
          data-testid="page-title-conflict-review"
        >
          Sync Conflict Review
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and resolve field-level sync conflicts between ship and shore
        </p>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={tableFilter}
          onValueChange={(v) => {
            setTableFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {tables.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => conflictsQuery.refetch()}
        >
          <RefreshCw
            className={`h-4 w-4 ${conflictsQuery.isFetching ? "animate-spin" : ""}`}
          />
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">
          {total} conflict{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Conflict Cards ── */}
      {conflictsQuery.isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32 pt-6">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
            <h3 className="text-lg font-semibold text-gray-700">
              No conflicts to review
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              All your synced changes are in agreement.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((conflict) => (
            <Card
              key={`${conflict.source}-${conflict.id}`}
              className="overflow-hidden"
            >
              <CardContent className="pt-5 pb-4">
                {/* Header row */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {conflict.tableDisplayName}
                  </Badge>
                  <span
                    className="text-sm font-medium text-gray-800 truncate max-w-[400px]"
                    title={conflict.recordDisplay}
                  >
                    {conflict.recordDisplay}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto" title={formatDateTime(conflict.detectedAt)}>
                    {formatTimeAgo(conflict.detectedAt)}
                  </span>
                </div>

                {/* Field name */}
                <div className="mb-3">
                  <span className="text-xs text-muted-foreground">Field: </span>
                  <code className="text-sm font-semibold bg-gray-100 px-2 py-0.5 rounded">
                    {conflict.fieldDisplayName}
                  </code>
                </div>

                {/* Two-column comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Winner (kept) */}
                  <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-semibold text-green-700 uppercase">
                        Your value (kept)
                      </span>
                    </div>
                    <div
                      className="text-sm font-mono bg-white rounded border px-2 py-1.5 mb-2 break-all min-h-[32px]"
                      title={conflict.winner.value ?? ""}
                    >
                      {truncateValue(conflict.winner.value)}
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div>
                        <span className="text-gray-400">Changed by: </span>
                        <span className="font-medium">
                          {conflict.winner.userName}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Location: </span>
                        {conflict.winner.locationLabel}
                      </div>
                      {conflict.winner.changedAt && (
                        <div>
                          <span className="text-gray-400">When: </span>
                          {formatDateTime(conflict.winner.changedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rejected (incoming) */}
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-xs font-semibold text-red-700 uppercase">
                        Incoming value (rejected)
                      </span>
                    </div>
                    <div
                      className="text-sm font-mono bg-white rounded border px-2 py-1.5 mb-2 break-all min-h-[32px]"
                      title={conflict.rejected.value ?? ""}
                    >
                      {truncateValue(conflict.rejected.value)}
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div>
                        <span className="text-gray-400">Changed by: </span>
                        <span className="font-medium">
                          {conflict.rejected.userName}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Location: </span>
                        {conflict.rejected.locationLabel}
                      </div>
                      {conflict.rejected.changedAt && (
                        <div>
                          <span className="text-gray-400">When: </span>
                          {formatDateTime(conflict.rejected.changedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resolved badge or action buttons */}
                {conflict.isResolved ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Shield className="h-4 w-4" />
                    <span>
                      Resolved:{" "}
                      <span className="font-medium">
                        {conflict.resolvedAction === "APPLY_INCOMING"
                          ? "Incoming applied"
                          : conflict.resolvedAction === "DISMISS"
                            ? "Dismissed"
                            : conflict.resolvedAction || "Resolved"}
                      </span>
                    </span>
                    {conflict.resolvedAt && (
                      <span className="text-xs text-gray-400">
                        {formatDateTime(conflict.resolvedAt)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    {canEditConflicts && (
                      <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setConfirmDialog({
                          open: true,
                          action: "apply",
                          conflict,
                        })
                      }
                      disabled={isActioning}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                      Apply incoming value
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setConfirmDialog({
                          open: true,
                          action: "dismiss",
                          conflict,
                        })
                      }
                      disabled={isActioning}
                    >
                      Dismiss
                    </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Confirmation Dialog ── */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open)
            setConfirmDialog({ open: false, action: "apply", conflict: null });
        }}
      >
        <DialogContent>
          {confirmDialog.conflict && confirmDialog.action === "apply" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Apply incoming value?
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 pt-2">
                    <p>
                      This will change{" "}
                      <strong>
                        {confirmDialog.conflict.fieldDisplayName}
                      </strong>{" "}
                      for{" "}
                      <strong>{confirmDialog.conflict.recordDisplay}</strong>
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded border p-2 bg-red-50">
                        <div className="text-xs text-gray-500 mb-1">
                          Current value
                        </div>
                        <code className="text-xs break-all">
                          {truncateValue(
                            confirmDialog.conflict.winner.value,
                            80
                          )}
                        </code>
                      </div>
                      <div className="rounded border p-2 bg-green-50">
                        <div className="text-xs text-gray-500 mb-1">
                          Will change to
                        </div>
                        <code className="text-xs break-all">
                          {truncateValue(
                            confirmDialog.conflict.rejected.value,
                            80
                          )}
                        </code>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The change will sync to the other side on the next sync
                      cycle. A new field log will be recorded under your name.
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setConfirmDialog({
                      open: false,
                      action: "apply",
                      conflict: null,
                    })
                  }
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    applyMutation.mutate({
                      id: confirmDialog.conflict!.id,
                      source: confirmDialog.conflict!.source,
                    })
                  }
                  disabled={applyMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {applyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  Confirm and apply
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmDialog.conflict && confirmDialog.action === "dismiss" && (
            <>
              <DialogHeader>
                <DialogTitle>Dismiss this conflict?</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-2 pt-2">
                    <p>
                      Your current value (
                      <code className="text-xs">
                        {truncateValue(
                          confirmDialog.conflict.winner.value,
                          60
                        )}
                      </code>
                      ) will be kept.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      The other side will continue to show their value until they
                      review the conflict on their end.
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setConfirmDialog({
                      open: false,
                      action: "dismiss",
                      conflict: null,
                    })
                  }
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    dismissMutation.mutate({
                      id: confirmDialog.conflict!.id,
                      source: confirmDialog.conflict!.source,
                    })
                  }
                  disabled={dismissMutation.isPending}
                >
                  {dismissMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  Confirm dismissal
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
