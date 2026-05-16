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
  id: number;
  queueUuid: string;
  sourceTable: string;
  fileName: string;
  fileSize: number | null;
  direction: string;
  status: string;
  chunkOffset: number;
  totalChunks: number | null;
  retryCount: number;
}

interface SyncTriggerResult {
  batchUuid: string;
  status: string;
  recordsSent: number;
  recordsReceived: number;
  conflictsFound: number;
  filesProcessed: number;
  durationMs: number;
  error?: string;
}

// ── Helpers ──

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "-";
  const absMs = Math.abs(ms);
  if (absMs < 1000) return `${absMs}ms`;
  return `${(absMs / 1000).toFixed(1)}s`;
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

  // ── Combined Conflict Count (from conflict review endpoint) ──
  const conflictCountQuery = useQuery<{ total: number; fromLog: number; fromOld: number }>({
    queryKey: ["/technical/api/sync/conflicts/review/count"],
    queryFn: async () => {
      const res = await fetch("/technical/api/sync/conflicts/review/count");
      if (!res.ok) return { total: 0, fromLog: 0, fromOld: 0 };
      return res.json();
    },
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
      setSyncProgress(100);
      setSyncStage("Sync complete!");
      const logLines = [
        `[${new Date().toLocaleTimeString()}] Sync ${data.status || "complete"}`,
        `  Records pushed: ${data.recordsSent ?? 0}`,
        `  Records pulled: ${data.recordsReceived ?? 0}`,
        `  Conflicts: ${data.conflictsFound ?? 0}`,
        `  Files processed: ${data.filesProcessed ?? 0}`,
        `  Duration: ${formatDuration(data.durationMs)}`,
      ];
      if (data.error) logLines.push(`  Error: ${data.error}`);
      setSyncLog((prev) => [...prev, ...logLines]);

      toast({
        title: "Sync Complete",
        description: `Pushed ${data.recordsSent ?? 0}, pulled ${data.recordsReceived ?? 0} records`,
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
            <div className="text-lg font-semibold mt-1">{fileQueue.length} pending</div>
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
                        line.includes("FAILED")
                          ? "text-red-600"
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
                    value: syncMutation.data.recordsSent ?? 0,
                    color: "text-blue-600",
                  },
                  {
                    icon: ArrowDownCircle,
                    label: "Pulled",
                    value: syncMutation.data.recordsReceived ?? 0,
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
                    value: syncMutation.data.filesProcessed ?? 0,
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
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-300" />
                <p>No conflicts - all synced!</p>
              </div>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
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
                <p>No pending file transfers</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-right">Retry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fileQueue.map((f) => (
                    <TableRow key={f.queueUuid || f.id}>
                      <TableCell className="text-sm max-w-[200px] truncate">{f.fileName}</TableCell>
                      <TableCell className="font-mono text-xs">{f.sourceTable}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {f.direction === "ship_to_shore" ? "Ship\u2192Shore" : "Shore\u2192Ship"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {f.fileSize ? `${(f.fileSize / 1024).toFixed(0)} KB` : "-"}
                      </TableCell>
                      <TableCell>{statusBadge(f.status)}</TableCell>
                      <TableCell>
                        {f.totalChunks ? (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={(f.chunkOffset / f.totalChunks) * 100}
                              className="h-2 w-16"
                            />
                            <span className="text-xs text-muted-foreground">
                              {f.chunkOffset}/{f.totalChunks}
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{f.retryCount}</TableCell>
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
