/**
 * Sync Dashboard
 *
 * Monitors sync status, triggers manual sync, shows history, conflicts, and file queue.
 * Used on both ship and shore servers.
 *
 * Route: /admin/sync-dashboard
 */

import { useState, useContext, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { VesselContext } from "@/contexts/VesselContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Cloud,
  CloudOff,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  Loader2,
  Zap,
  Activity,
  GitPullRequest,
} from "lucide-react";
import { useSyncInstanceInfo } from "@/hooks/useSyncInstanceInfo";
import AutoSyncSettingsCard from "@/components/sync/AutoSyncSettingsCard";

// ── Types ──

interface SyncBatch {
  id: number;
  batchUuid: string;
  vesselId: string;
  status: string;
  recordsSent: number;
  recordsReceived: number;
  conflictsFound: number;
  conflictsResolved: number;
  filesQueued: number;
  filesCompleted: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

interface SyncConflict {
  id: number;
  conflictUuid: string;
  batchId: number;
  tableName: string;
  rowId: string;
  fieldName: string;
  shipValue: string | null;
  shoreValue: string | null;
  shipChangedBy: string | null;
  shoreChangedBy: string | null;
  resolution: string | null;
  resolvedAt: string | null;
}

interface FileQueueItem {
  queueUuid: string;
  category: string;        // friendly module label (e.g. "Work Order") — never a path/key
  fileName: string;
  fileSize: number | null;
  direction: string;
  status: string;
  chunkOffset: number;
  totalChunks: number | null;
  retryCount: number;
  lastError: string | null;
  createdAt: string | null;
}

/**
 * MUST match SyncResult in server/modules/sync/syncEngine.ts.
 * It previously did not: this interface declared `status`, `recordsSent`,
 * `recordsReceived` and `filesProcessed`, none of which the server has ever
 * emitted — so `?? 0` fired every time and the panel reported 0 pushed / 0 pulled
 * / 0 files on EVERY sync, successful or not. `res.json()` is `any`, so the cast
 * silenced it. Only conflictsFound and durationMs were ever real.
 */
interface SyncTriggerResult {
  success: boolean;
  batchUuid: string | null;
  recordsPushed: number;
  recordsPulled: number;
  conflictsFound: number;
  conflictsAutoResolved: number;
  filesQueued: number;
  durationMs: number;
  error: string | null;
  remainingPush: number | null;
  remainingPull: number | null;
}

// ── Helpers ──

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "-";
  const absMs = Math.abs(ms);
  if (absMs < 1000) return `${absMs}ms`;
  return `${(absMs / 1000).toFixed(1)}s`;
}

function formatAge(iso: string | null): string {
  if (!iso) return "-";
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms) || ms < 0) return "-";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" /> Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" /> Failed
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> In Progress
        </Badge>
      );
    case "partial":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
          <AlertTriangle className="h-3 w-3 mr-1" /> Partial
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ── Component ──

export default function SyncDashboard() {
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const canEditSync = canEdit("admin-sync-dashboard");
  const { isShip } = useSyncInstanceInfo();
  const vesselCtx = useContext(VesselContext);
  const vessels = vesselCtx?.vessels ?? [];
  const [, setLocation] = useLocation();

  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStage, setSyncStage] = useState("");
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first vessel if only one exists (ship mode)
  useEffect(() => {
    if (!selectedVesselId && vessels.length === 1 && vessels[0].id !== "all") {
      setSelectedVesselId(vessels[0].id);
    }
  }, [vessels, selectedVesselId]);

  // ── Sync Batches (History) ──
  const batchesQuery = useQuery<SyncBatch[]>({
    queryKey: ["/technical/api/sync/batches", selectedVesselId],
    queryFn: async () => {
      const url = selectedVesselId
        ? `/technical/api/sync/batches?vesselId=${selectedVesselId}&limit=20`
        : `/technical/api/sync/batches?vesselId=all&limit=20`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  // ── Unresolved Conflicts ──
  const conflictsQuery = useQuery<SyncConflict[]>({
    queryKey: ["/technical/api/sync/conflicts", selectedVesselId],
    queryFn: async () => {
      if (!selectedVesselId) return [];
      const res = await fetch(`/technical/api/sync/conflicts?vesselId=${selectedVesselId}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!selectedVesselId,
    refetchInterval: 30_000,
  });

  // ── File Queue ──
  const fileQueueQuery = useQuery<{ files: FileQueueItem[]; count: number }>({
    queryKey: ["/technical/api/sync/file/queue", selectedVesselId],
    queryFn: async () => {
      if (!selectedVesselId) return { files: [], count: 0 };
      const res = await fetch(`/technical/api/sync/file/queue?vesselId=${selectedVesselId}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!selectedVesselId,
    refetchInterval: 30_000,
  });

  // ── File queue actions (B-P1.1): Retry re-queues (resumes from chunk_offset); Skip stops retrying ──
  const fileActionMutation = useMutation({
    mutationFn: async ({ queueUuid, action }: { queueUuid: string; action: "retry" | "skip" }) => {
      const res = await apiRequest("POST", `/technical/api/sync/file/${queueUuid}/${action}`, {});
      return res.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.action === "retry" ? "File re-queued" : "File skipped",
        description: vars.action === "retry"
          ? "Will resume on the next sync cycle."
          : "Marked handled; it will no longer retry.",
      });
      fileQueueQuery.refetch();
    },
    onError: (err: any) => {
      toast({ title: "Action failed", description: err?.message || "Could not update the file.", variant: "destructive" });
    },
  });

  // ── Combined Conflict Count (from conflict review endpoint) ──
  // Vessel-scoped (pilot 2026-07-26). This previously called the endpoint with NO vesselId, so
  // the header counted conflicts across the WHOLE FLEET while the panel below it listed only the
  // selected vessel — on shore with 18 vessels the two numbers could never agree. The endpoint
  // has always supported the filter (conflictReviewController.ts:40); the client just never
  // passed it. Fleet-wide totals belong on Fleet Overview, not on a vessel-scoped dashboard.
  const conflictCountQuery = useQuery<{ total: number; fromLog: number; fromOld: number }>({
    queryKey: ["/technical/api/sync/conflicts/review/count", selectedVesselId],
    queryFn: async () => {
      if (!selectedVesselId) return { total: 0, fromLog: 0, fromOld: 0 };
      const res = await fetch(`/technical/api/sync/conflicts/review/count?vesselId=${selectedVesselId}`);
      if (!res.ok) return { total: 0, fromLog: 0, fromOld: 0 };
      return res.json();
    },
    enabled: !!selectedVesselId,
    refetchInterval: 30_000,
  });
  const totalConflictCount = conflictCountQuery.data?.total ?? 0;

  // ── Sync Trigger ──
  const syncMutation = useMutation({
    mutationFn: async (vesselId: string): Promise<SyncTriggerResult> => {
      const res = await apiRequest("POST", "/technical/api/sync/trigger", { vesselId });
      return res.json();
    },
    onMutate: () => {
      setSyncProgress(5);
      setSyncStage("Initiating sync session...");
      setSyncLog([`[${new Date().toLocaleTimeString()}] Sync initiated...`]);
    },
    onSuccess: (data) => {
      // HTTP 200 only means the request came back — the controller returns 200 even
      // when success is false. Read the payload, not the status code: a sync that
      // failed to apply rows must never render as "Sync complete".
      const failed = data.success === false;
      const hasErrors = Boolean(data.error);
      const headline = failed
        ? "SYNC FAILED"
        : hasErrors
          ? "Sync finished WITH ERRORS — some records did not apply"
          : "Sync complete";

      setSyncProgress(100);
      setSyncStage(failed ? "Sync failed" : hasErrors ? "Finished with errors" : "Sync complete!");
      const logLines = [
        `[${new Date().toLocaleTimeString()}] ${headline}`,
        `  Records pushed: ${data.recordsPushed ?? 0}`,
        `  Records pulled: ${data.recordsPulled ?? 0}`,
        `  Conflicts: ${data.conflictsFound ?? 0}`,
        `  Files queued: ${data.filesQueued ?? 0}`,
        `  Duration: ${formatDuration(data.durationMs)}`,
      ];
      // A non-zero remainder is NOT a fault — undelivered records now stay queued and
      // retry instead of being silently dropped (migration 147). Surface it so support
      // reads it as "still to send", not as data loss.
      if (data.remainingPush) logLines.push(`  Still to send: ${data.remainingPush}`);
      if (data.remainingPull) logLines.push(`  Still to receive: ${data.remainingPull}`);
      // Split the joined error string so each failure is its own line — previously the
      // whole block was one run-on line and only the first was legible.
      if (data.error) {
        String(data.error)
          .split("\n")
          .filter((l) => l.trim())
          .forEach((l) => logLines.push(`  Error: ${l.trim()}`));
      }
      setSyncLog((prev) => [...prev, ...logLines]);

      toast({
        title: failed ? "Sync Failed" : hasErrors ? "Sync Finished With Errors" : "Sync Complete",
        description: failed || hasErrors
          ? "Some records did not apply — see the sync log below."
          : `Pushed ${data.recordsPushed ?? 0}, pulled ${data.recordsPulled ?? 0} records`,
        variant: failed || hasErrors ? "destructive" : undefined,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/technical/api/sync/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/sync/conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/sync/file/queue"] });

      setTimeout(() => {
        setSyncProgress(0);
        setSyncStage("");
      }, 3000);
    },
    onError: (err: any) => {
      setSyncProgress(0);
      setSyncStage("");
      setSyncLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SYNC FAILED: ${err.message}`,
      ]);
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  // Progress simulation while sync is running
  useEffect(() => {
    if (!syncMutation.isPending || syncProgress >= 90) return;
    const interval = setInterval(() => {
      setSyncProgress((p) => {
        if (p >= 85) return p;
        const increment = p < 30 ? 8 : p < 60 ? 5 : 2;
        const newP = Math.min(p + increment, 85);
        // Update stage
        if (newP < 15) setSyncStage("Initiating sync session...");
        else if (newP < 40) setSyncStage("Pushing local changes...");
        else if (newP < 75) setSyncStage("Pulling shore updates...");
        else setSyncStage("Processing file queue...");
        return newP;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [syncMutation.isPending, syncProgress]);

  // Auto-scroll sync log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [syncLog]);

  // ── Conflict Resolution ──
  const resolveMutation = useMutation({
    mutationFn: async ({
      conflictUuid,
      resolution,
    }: {
      conflictUuid: string;
      resolution: string;
    }) => {
      const res = await apiRequest("POST", "/technical/api/sync/resolve-conflict", {
        conflictUuid,
        resolution,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Conflict Resolved" });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/sync/conflicts"] });
    },
    onError: (err: any) => {
      toast({ title: "Resolution Failed", description: err.message, variant: "destructive" });
    },
  });

  const batches = batchesQuery.data ?? [];
  const conflicts = conflictsQuery.data ?? [];
  const fileQueue = fileQueueQuery.data?.files ?? [];
  const lastBatch = batches[0];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black" data-testid="page-title-sync-dashboard">
            Sync Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor sync status, trigger sync, and resolve conflicts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
            <SelectTrigger className="w-[240px]" data-testid="select-vessel-sync">
              <SelectValue placeholder="Select vessel..." />
            </SelectTrigger>
            <SelectContent>
              {vessels
                .filter((v) => v.id !== "all")
                .map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name || v.code || v.id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              batchesQuery.refetch();
              conflictsQuery.refetch();
              fileQueueQuery.refetch();
            }}
            data-testid="btn-refresh-all"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Section A: Status Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last Sync
            </div>
            <div className="text-lg font-semibold mt-1">
              {lastBatch ? formatDateTime(lastBatch.completedAt || lastBatch.startedAt) : "Never"}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Last Status
            </div>
            <div className="mt-1">{lastBatch ? statusBadge(lastBatch.status) : <Badge variant="outline">N/A</Badge>}</div>
          </CardContent>
        </Card>
        <Card
          className="border-l-4 border-l-amber-500 cursor-pointer hover:shadow-md hover:bg-amber-50/40 transition-all"
          onClick={() => setLocation("/admin/sync-conflicts")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLocation("/admin/sync-conflicts"); } }}
          role="link"
          tabIndex={0}
          aria-label={`Conflicts — ${totalConflictCount} need resolution. Click to review.`}
          data-testid="tile-conflicts-nav"
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Conflicts
            </div>
            <div className="text-lg font-semibold mt-1">
              {totalConflictCount}
              {totalConflictCount > 0 && (
                <span className="text-xs text-amber-600 ml-1">need resolution</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              File Queue
            </div>
            <div className="text-lg font-semibold mt-1">
              {fileQueue.length} {fileQueue.length === 1 ? "file" : "files"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section B: Sync Now (ship-only — sync is ship-initiated) ── */}
      {isShip && selectedVesselId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Sync Now
            </CardTitle>
            <CardDescription>Trigger a manual sync cycle for the selected vessel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canEditSync && (
              <Button
                onClick={() => syncMutation.mutate(selectedVesselId)}
                disabled={syncMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="btn-sync-now"
              >
                {syncMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            )}

            {/* Progress */}
            {(syncMutation.isPending || syncProgress > 0) && (
              <div className="space-y-2">
                <Progress value={syncProgress} className="h-2" />
                <p className="text-sm text-muted-foreground">{syncStage}</p>
              </div>
            )}

            {/* Log Output */}
            {syncLog.length > 0 && (
              <ScrollArea className="h-[160px] rounded-md border bg-gray-50 p-3">
                <div className="space-y-1 font-mono text-xs">
                  {syncLog.map((line, i) => (
                    <div
                      key={i}
                      className={
                        // Order matters: FAILED and Error must win before the
                        // "complete" test, or an error line renders green/grey.
                        line.includes("FAILED") || line.includes("Error:")
                          ? "text-red-600"
                          : line.includes("WITH ERRORS")
                            ? "text-amber-600 font-semibold"
                            : line.includes("Still to")
                              ? "text-amber-600"
                              : line.includes("complete")
                                ? "text-green-600"
                                : "text-gray-700"
                      }
                    >
                      {line}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            )}

            {/* Summary after completion */}
            {syncMutation.isSuccess && syncMutation.data && (
              <div className="grid grid-cols-5 gap-3">
                {[
                  {
                    icon: ArrowUpCircle,
                    label: "Pushed",
                    value: syncMutation.data.recordsPushed ?? 0,
                    color: "text-blue-600",
                  },
                  {
                    icon: ArrowDownCircle,
                    label: "Pulled",
                    value: syncMutation.data.recordsPulled ?? 0,
                    color: "text-green-600",
                  },
                  {
                    icon: AlertTriangle,
                    label: "Conflicts",
                    value: syncMutation.data.conflictsFound ?? 0,
                    color: "text-amber-600",
                  },
                  {
                    icon: FileText,
                    label: "Files",
                    value: syncMutation.data.filesQueued ?? 0,
                    color: "text-purple-600",
                  },
                  {
                    icon: Clock,
                    label: "Duration",
                    value: formatDuration(syncMutation.data.durationMs),
                    color: "text-gray-600",
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="text-center rounded-lg border p-2">
                    <Icon className={`h-5 w-5 mx-auto ${color}`} />
                    <div className="font-semibold text-sm mt-1">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Auto-Sync Settings (ship-only — the scheduler runs here) ── */}
      {isShip && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Auto-Sync Settings
            </CardTitle>
            <CardDescription>
              Configure automatic background sync for this vessel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AutoSyncSettingsCard />
          </CardContent>
        </Card>
      )}

      {/* ── Section C: Recent Sync History ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Recent Sync History
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => batchesQuery.refetch()}>
              <RefreshCw className={`h-4 w-4 mr-1 ${batchesQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cloud className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>No sync history yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Pushed</TableHead>
                    <TableHead className="text-right">Pulled</TableHead>
                    <TableHead className="text-right">Conflicts</TableHead>
                    <TableHead className="text-right">Files</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.batchUuid}>
                      <TableCell className="text-sm">{formatDateTime(b.startedAt)}</TableCell>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{b.recordsSent}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {b.recordsReceived}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {b.conflictsFound}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {b.filesCompleted}/{b.filesQueued}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatDuration(b.durationMs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Section D: Unresolved Conflicts ── */}
      {selectedVesselId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitPullRequest className="h-5 w-5 text-amber-500" />
                Unresolved Conflicts
                {conflicts.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {conflicts.length}
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => conflictsQuery.refetch()}>
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${conflictsQuery.isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {conflicts.length === 0 ? (
              /* Two distinct empty states. Some conflicts are resolvable inline here; others are
                 only actionable on Conflict Review. Showing "all synced" whenever THIS list was
                 empty contradicted the count directly above it. The user is never shown the
                 reason — just one honest number and a way to act on it. */
              totalConflictCount > 0 ? (
                <div className="text-center py-8" data-testid="conflicts-needs-review">
                  <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-amber-400" />
                  <p className="font-medium">
                    {totalConflictCount} {totalConflictCount === 1 ? "conflict needs" : "conflicts need"} review
                  </p>
                  <Button
                    variant="link"
                    className="mt-1"
                    onClick={() => setLocation("/admin/sync-conflicts")}
                    data-testid="link-open-conflict-review"
                  >
                    Open Conflict Review →
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-300" />
                  <p>No conflicts - all synced!</p>
                </div>
              )
            ) : (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Row</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Ship Value</TableHead>
                      <TableHead>Shore Value</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflicts.map((c) => (
                      <TableRow key={c.conflictUuid || c.id}>
                        <TableCell className="font-mono text-sm">{c.tableName}</TableCell>
                        <TableCell className="font-mono text-sm max-w-[120px] truncate">
                          {c.rowId}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{c.fieldName}</TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate text-blue-700">
                          {c.shipValue ?? "-"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate text-green-700">
                          {c.shoreValue ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {canEditSync && (
                              <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                resolveMutation.mutate({
                                  conflictUuid: c.conflictUuid,
                                  resolution: "ship_wins",
                                })
                              }
                              disabled={resolveMutation.isPending}
                            >
                              Ship Wins
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                resolveMutation.mutate({
                                  conflictUuid: c.conflictUuid,
                                  resolution: "shore_wins",
                                })
                              }
                              disabled={resolveMutation.isPending}
                            >
                              Shore Wins
                            </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
            {conflicts.length > 0 && totalConflictCount > conflicts.length && (
              /* The table shows only what can be resolved inline. Without this the row count
                 would silently disagree with the total above. */
              <div className="pt-2 text-center">
                <Button
                  variant="link"
                  onClick={() => setLocation("/admin/sync-conflicts")}
                  data-testid="link-open-conflict-review-all"
                >
                  Open Conflict Review to see all {totalConflictCount} conflicts →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Section E: File Queue ── */}
      {selectedVesselId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-500" />
                File Queue
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => fileQueueQuery.refetch()}>
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${fileQueueQuery.isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fileQueue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-300" />
                <p>No files awaiting transfer</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Retries</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fileQueue.map((f) => (
                    <TableRow key={f.queueUuid}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{f.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={f.fileName}>{f.fileName}</TableCell>
                      <TableCell className="text-sm">
                        {f.fileSize ? `${(f.fileSize / 1024).toFixed(0)} KB` : "-"}
                      </TableCell>
                      <TableCell>{statusBadge(f.status)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{f.retryCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate" title={f.lastError ?? ""}>
                        {f.lastError ?? "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatAge(f.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditSync && (
                            <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={fileActionMutation.isPending}
                            onClick={() => fileActionMutation.mutate({ queueUuid: f.queueUuid, action: "retry" })}
                            title="Re-queue (resumes from last sent chunk)"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={fileActionMutation.isPending || f.status === "skipped"}
                            onClick={() => fileActionMutation.mutate({ queueUuid: f.queueUuid, action: "skip" })}
                            title="Stop retrying this file"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Skip
                          </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
