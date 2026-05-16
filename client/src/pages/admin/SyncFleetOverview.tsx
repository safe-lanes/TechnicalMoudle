/**
 * Shore Admin — Fleet Sync Overview
 *
 * Shows ALL vessels' sync status on one screen, plus DB-persisted sync settings.
 * ONLY visible on shore server (hidden on ship via useSyncInstanceInfo).
 *
 * Route: /admin/sync-fleet
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSyncInstanceInfo } from "@/hooks/useSyncInstanceInfo";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Ship,
  Cloud,
  CloudOff,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  RefreshCw,
  Globe,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Wifi,
  WifiOff,
  Eye,
  HardDrive,
} from "lucide-react";

// ── Types ──

interface FleetVessel {
  vessel_id: string;
  vessel_name: string;
  instance_id: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_checkpoint: string | null;
  pending_changes: number;
  unresolved_conflicts: number;
  pending_files: number;
}

interface SyncSettingRow {
  id: number;
  settingKey: string;
  settingValue: string | null;
  settingType: string | null;
  description: string | null;
  isEditable: boolean;
}

// ── Helpers ──

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function vesselSyncStatus(v: FleetVessel): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  if (!v.instance_id && !v.last_sync_at) {
    return {
      label: "Not Provisioned",
      color: "bg-gray-100 text-gray-600 border-gray-200",
      icon: <CloudOff className="h-3 w-3 mr-1" />,
    };
  }
  if (!v.last_sync_at) {
    return {
      label: "Never Synced",
      color: "bg-gray-100 text-gray-600 border-gray-200",
      icon: <CloudOff className="h-3 w-3 mr-1" />,
    };
  }
  const hoursSince =
    (Date.now() - new Date(v.last_sync_at).getTime()) / (1000 * 60 * 60);
  if (v.unresolved_conflicts > 0) {
    return {
      label: "Conflicts",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: <XCircle className="h-3 w-3 mr-1" />,
    };
  }
  if (hoursSince > 48) {
    return {
      label: "Overdue",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: <XCircle className="h-3 w-3 mr-1" />,
    };
  }
  if (hoursSince > 24 || v.pending_changes > 0) {
    return {
      label: "Stale",
      color: "bg-amber-100 text-amber-700 border-amber-200",
      icon: <AlertTriangle className="h-3 w-3 mr-1" />,
    };
  }
  return {
    label: "Synced",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: <CheckCircle className="h-3 w-3 mr-1" />,
  };
}

// ── Main Component ──

export default function SyncFleetOverview() {
  const { isShip } = useSyncInstanceInfo();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editedSettings, setEditedSettings] = useState<
    Record<string, string>
  >({});
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // ── Ship guard ──
  if (isShip) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-600 mb-2">
            Shore Only
          </h2>
          <p className="text-gray-500 mb-4">
            Fleet Sync Overview is only available on the shore server.
          </p>
          <Button onClick={() => setLocation("/admin/sync-dashboard")}>
            Go to Sync Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Data queries ──
  const {
    data: fleetData,
    isLoading: fleetLoading,
    refetch: refetchFleet,
  } = useQuery<{ vessels: FleetVessel[] }>({
    queryKey: ["/technical/api/sync/fleet-overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/technical/api/sync/fleet-overview");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: settingsData, refetch: refetchSettings } = useQuery<{
    settings: SyncSettingRow[];
  }>({
    queryKey: ["/technical/api/sync/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/technical/api/sync/settings");
      return res.json();
    },
  });

  const { data: batchData } = useQuery<any[]>({
    queryKey: ["/technical/api/sync/batches", "all", 50],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        "/technical/api/sync/batches?vesselId=all&limit=50"
      );
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const res = await apiRequest("PUT", "/technical/api/sync/settings", {
        settings,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Sync engine will reload on next cycle." });
      setEditedSettings({});
      refetchSettings();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Per-vessel sync trigger removed — sync is ship-initiated. A future 'Request Sync'
  // feature (shore sets a flag, ship's scheduler honors it) is tracked separately.

  const vessels = fleetData?.vessels ?? [];
  const settings = settingsData?.settings ?? [];
  const batches = batchData ?? [];

  // ── Summary stats ──
  const totalVessels = vessels.length;
  const syncedLast24h = vessels.filter((v) => {
    if (!v.last_sync_at) return false;
    return (
      Date.now() - new Date(v.last_sync_at).getTime() < 24 * 60 * 60 * 1000
    );
  }).length;
  const staleCount = vessels.filter((v) => {
    if (!v.last_sync_at) return false;
    return (
      Date.now() - new Date(v.last_sync_at).getTime() > 48 * 60 * 60 * 1000
    );
  }).length;
  const totalConflicts = vessels.reduce(
    (sum, v) => sum + v.unresolved_conflicts,
    0
  );

  // ── Settings helpers ──
  function getSettingValue(key: string): string {
    if (key in editedSettings) return editedSettings[key];
    const s = settings.find((s) => s.settingKey === key);
    return s?.settingValue ?? "";
  }

  function setSettingValue(key: string, value: string) {
    setEditedSettings((prev) => ({ ...prev, [key]: value }));
  }

  function hasUnsavedChanges(): boolean {
    return Object.keys(editedSettings).length > 0;
  }

  async function testConnection() {
    const shoreUrl = getSettingValue("shore_url");
    if (!shoreUrl) {
      setTestResult({ connected: false, message: "Shore URL is empty" });
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await apiRequest(
        "POST",
        "/technical/api/sync/settings/test-connection",
        { shoreUrl }
      );
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ connected: false, message: err.message });
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-7 w-7 text-blue-600" />
            Fleet Sync Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Shore-side fleet-wide sync monitoring and configuration
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchFleet()}
          disabled={fleetLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${fleetLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Section A: Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Vessels</p>
                <p className="text-2xl font-bold">{totalVessels}</p>
              </div>
              <Ship className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Synced (24h)</p>
                <p className="text-2xl font-bold text-green-600">
                  {syncedLast24h}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Stale ({">"}48h)</p>
                <p
                  className={`text-2xl font-bold ${
                    staleCount > 0 ? "text-amber-600" : "text-gray-400"
                  }`}
                >
                  {staleCount}
                </p>
              </div>
              <AlertTriangle
                className={`h-8 w-8 ${
                  staleCount > 0 ? "text-amber-400" : "text-gray-300"
                }`}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Conflicts</p>
                <p
                  className={`text-2xl font-bold ${
                    totalConflicts > 0 ? "text-red-600" : "text-gray-400"
                  }`}
                >
                  {totalConflicts}
                </p>
              </div>
              <XCircle
                className={`h-8 w-8 ${
                  totalConflicts > 0 ? "text-red-400" : "text-gray-300"
                }`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section B: Fleet Vessel Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Fleet Vessels</CardTitle>
          <CardDescription>
            All vessels sorted by most stale first. Auto-refreshes every 60s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fleetLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Instance</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Conflicts</TableHead>
                  <TableHead className="text-right">Files</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vessels.map((v) => {
                  const status = vesselSyncStatus(v);
                  return (
                    <TableRow key={v.vessel_id}>
                      <TableCell className="font-medium">
                        {v.vessel_name}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 font-mono">
                        {v.instance_id || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {relativeTime(v.last_sync_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${status.color} hover:${status.color}`}
                        >
                          {status.icon} {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {v.pending_changes > 0 ? (
                          <span className="text-amber-600 font-medium">
                            {v.pending_changes}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.unresolved_conflicts > 0 ? (
                          <span className="text-red-600 font-medium">
                            {v.unresolved_conflicts}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.pending_files > 0 ? (
                          <span className="text-blue-600 font-medium">
                            {v.pending_files}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setLocation("/admin/sync-dashboard")
                          }
                          title="View Dashboard"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setLocation("/admin/sync-provisioning")
                          }
                          title="Provision"
                        >
                          <HardDrive className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {vessels.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-gray-400 py-8"
                    >
                      No vessels found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section C: Sync Settings */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-500" />
                  <CardTitle className="text-lg">Sync Settings</CardTitle>
                </div>
                {settingsOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <CardDescription>
                Database-persisted sync configuration. Changes take effect on
                next sync cycle.
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Shore URL + Test Connection */}
              <div className="space-y-2">
                <Label>Shore URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={getSettingValue("shore_url")}
                    onChange={(e) =>
                      setSettingValue("shore_url", e.target.value)
                    }
                    placeholder="https://pms.safelanes.com/technical/api"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testConnection}
                    disabled={testLoading}
                  >
                    {testLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Wifi className="h-4 w-4 mr-1" />
                    )}
                    Test
                  </Button>
                </div>
                {testResult && (
                  <div
                    className={`text-sm flex items-center gap-1 ${
                      testResult.connected
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {testResult.connected ? (
                      <Wifi className="h-3 w-3" />
                    ) : (
                      <WifiOff className="h-3 w-3" />
                    )}
                    {testResult.message}
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  {
                    settings.find((s) => s.settingKey === "shore_url")
                      ?.description
                  }
                </p>
              </div>

              {/* Instance ID */}
              <div className="space-y-2">
                <Label>Instance ID</Label>
                <Input
                  value={getSettingValue("instance_id")}
                  onChange={(e) =>
                    setSettingValue("instance_id", e.target.value)
                  }
                  placeholder="SHORE-AWS or SHIP-V003"
                />
                <p className="text-xs text-gray-400">
                  {
                    settings.find((s) => s.settingKey === "instance_id")
                      ?.description
                  }
                </p>
              </div>

              {/* Boolean toggles */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <Label>Auto-Sync</Label>
                    <p className="text-xs text-gray-400">
                      Enable automatic scheduled sync
                    </p>
                  </div>
                  <Switch
                    checked={getSettingValue("auto_sync_enabled") === "true"}
                    onCheckedChange={(checked) =>
                      setSettingValue(
                        "auto_sync_enabled",
                        checked ? "true" : "false"
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <Label>Local Mode</Label>
                    <p className="text-xs text-gray-400">Dev only — direct function calls</p>
                  </div>
                  <Switch
                    checked={getSettingValue("local_mode") === "true"}
                    onCheckedChange={(checked) =>
                      setSettingValue(
                        "local_mode",
                        checked ? "true" : "false"
                      )
                    }
                  />
                </div>
              </div>

              {/* Numeric settings */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    key: "sync_interval_minutes",
                    label: "Sync Interval (min)",
                  },
                  { key: "max_retries", label: "Max Retries" },
                  { key: "chunk_size", label: "Chunk Size" },
                  {
                    key: "request_timeout_seconds",
                    label: "Timeout (sec)",
                  },
                  {
                    key: "field_log_retention_days",
                    label: "Log Retention (days)",
                  },
                  {
                    key: "batch_retention_days",
                    label: "Batch Retention (days)",
                  },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      value={getSettingValue(key)}
                      onChange={(e) => setSettingValue(key, e.target.value)}
                      className="h-8"
                    />
                  </div>
                ))}
              </div>

              {/* Save button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => updateSettingsMutation.mutate(editedSettings)}
                  disabled={
                    !hasUnsavedChanges() || updateSettingsMutation.isPending
                  }
                >
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Settings
                  {hasUnsavedChanges() && (
                    <Badge className="ml-2 bg-blue-500 text-white">
                      {Object.keys(editedSettings).length}
                    </Badge>
                  )}
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section D: Recent Fleet Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Fleet Activity</CardTitle>
          <CardDescription>
            Last 50 sync events across all vessels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Instance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Conflicts</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.slice(0, 50).map((b: any) => (
                <TableRow key={b.batchUuid || b.id}>
                  <TableCell className="text-sm">
                    {b.startedAt
                      ? new Date(b.startedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-gray-500">
                    {b.initiatedByInstance || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        b.status === "completed"
                          ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
                          : b.status === "failed"
                          ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
                          : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100"
                      }
                    >
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {b.recordsSent ?? 0}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {b.recordsReceived ?? 0}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {b.conflictsFound > 0 ? (
                      <span className="text-red-600">{b.conflictsFound}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-500">
                    {b.durationMs != null
                      ? `${(Math.abs(b.durationMs) / 1000).toFixed(1)}s`
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {batches.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-gray-400 py-8"
                  >
                    No sync activity yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
