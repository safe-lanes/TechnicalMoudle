import { useContext, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VesselContext } from "@/contexts/VesselContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, Ship } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NrAlert {
  id: number;
  vesselId: string;
  reportId: number | null;
  alertType: string;
  severity: string;
  message: string;
  metricValue: string | null;
  thresholdValue: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
}

interface PaginatedAlerts {
  data: NrAlert[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<string, string> = {
  HIGH_CONSUMPTION: "High Consumption",
  VERY_HIGH_CONSUMPTION: "Very High Consumption",
  LOW_ROB: "Low ROB",
  CRITICAL_ROB: "Critical ROB",
  AE_HOURS_SPIKE: "AE Hours Spike",
  CII_BAND_DROP: "CII Band Drop",
  NEGATIVE_ROB_RISK: "Negative ROB Risk",
};

const MANUAL_ACK_TYPES = new Set(["AE_HOURS_SPIKE", "CII_BAND_DROP", "NEGATIVE_ROB_RISK"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
        <AlertCircle className="h-3 w-3" />
        Critical
      </Badge>
    );
  }
  if (severity === "warning") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Warning
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
      <Bell className="h-3 w-3" />
      Info
    </Badge>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Alert row component ───────────────────────────────────────────────────────

function AlertRow({
  alert,
  canAck,
  onAck,
  isAcking,
}: {
  alert: NrAlert;
  canAck: boolean;
  onAck: (id: number) => void;
  isAcking: boolean;
}) {
  const label = ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType;
  const isActive = !alert.acknowledgedAt;
  const needsManualAck = MANUAL_ACK_TYPES.has(alert.alertType);

  return (
    <TableRow
      data-testid={`row-alert-${alert.id}`}
      className={alert.severity === "critical" && isActive ? "bg-red-50/40" : undefined}
    >
      <TableCell className="w-32">
        <SeverityBadge severity={alert.severity} />
      </TableCell>
      <TableCell className="font-medium text-sm w-44">
        <span data-testid={`text-alert-type-${alert.id}`}>{label}</span>
        {needsManualAck && isActive && (
          <span className="ml-1 text-xs text-amber-600">(manual ack)</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-gray-700 max-w-sm">
        <span data-testid={`text-alert-message-${alert.id}`}>{alert.message}</span>
      </TableCell>
      <TableCell className="text-xs text-gray-500 w-36">
        {formatDate(alert.createdAt)}
      </TableCell>
      <TableCell className="w-36 text-xs text-gray-500">
        {alert.acknowledgedAt ? (
          <span data-testid={`text-ack-by-${alert.id}`}>
            {alert.acknowledgedBy === "system" ? "Auto-resolved" : `By: ${alert.acknowledgedBy}`}
            <br />
            {formatDate(alert.acknowledgedAt)}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </TableCell>
      <TableCell className="w-28 text-right">
        {isActive && canAck && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            data-testid={`button-ack-alert-${alert.id}`}
            onClick={() => onAck(alert.id)}
            disabled={isAcking}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Acknowledge
          </Button>
        )}
        {isActive && !canAck && (
          <Badge variant="outline" className="text-xs text-gray-500">Active</Badge>
        )}
        {!isActive && (
          <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50">
            <CheckCircle2 className="h-3 w-3 mr-0.5" /> Resolved
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AlertsPanel() {
  const vesselCtx = useContext(VesselContext);
  const vesselId = vesselCtx?.vesselId ?? "";
  const { isOfficeUser, isPMSAdmin } = useAuth();
  const canAck = isOfficeUser || isPMSAdmin;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [historyPage, setHistoryPage] = useState(1);
  const LIMIT = 20;

  // ── Active alerts ──────────────────────────────────────────────────────────
  const activeQuery = useQuery<NrAlert[]>({
    queryKey: ["/technical/api/nr-alerts", vesselId, "active"],
    queryFn: async () => {
      if (!vesselId) return [];
      const res = await fetch(`/technical/api/nr-alerts/${vesselId}`);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    enabled: !!vesselId,
    refetchInterval: 60_000,
  });

  // ── Paginated history ──────────────────────────────────────────────────────
  const historyQuery = useQuery<PaginatedAlerts>({
    queryKey: ["/technical/api/nr-alerts", vesselId, "all", historyPage],
    queryFn: async () => {
      if (!vesselId) return { data: [], total: 0, page: 1, limit: LIMIT, totalPages: 0 };
      const res = await fetch(`/technical/api/nr-alerts/${vesselId}/all?page=${historyPage}&limit=${LIMIT}`);
      if (!res.ok) throw new Error("Failed to fetch alert history");
      return res.json();
    },
    enabled: !!vesselId,
  });

  // ── Acknowledge mutation ───────────────────────────────────────────────────
  const ackMutation = useMutation({
    mutationFn: (alertId: number) =>
      apiRequest("PATCH", `/technical/api/nr-alerts/${alertId}/acknowledge`),
    onSuccess: () => {
      toast({ title: "Alert acknowledged", description: "The alert has been marked as resolved." });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/nr-alerts", vesselId] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to acknowledge", description: err.message, variant: "destructive" });
    },
  });

  const handleAck = (alertId: number) => ackMutation.mutate(alertId);

  // ── Empty vessel state ─────────────────────────────────────────────────────
  if (!vesselId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Ship className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Select a vessel to view alerts.</p>
        </div>
      </div>
    );
  }

  const activeAlerts = activeQuery.data ?? [];
  const criticalCount = activeAlerts.filter(a => a.severity === "critical").length;
  const warningCount = activeAlerts.filter(a => a.severity === "warning").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Alerts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Threshold-based alerts generated from noon report submissions.
          </p>
        </div>
        {activeAlerts.length > 0 && (
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge className="bg-red-100 text-red-800 border-red-200 gap-1 text-sm px-3 py-1" data-testid="badge-critical-count">
                <AlertCircle className="h-3.5 w-3.5" />
                {criticalCount} Critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1 text-sm px-3 py-1" data-testid="badge-warning-count">
                <AlertTriangle className="h-3.5 w-3.5" />
                {warningCount} Warning
              </Badge>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-alerts">
            Active
            {activeAlerts.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                {activeAlerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-alert-history">History</TabsTrigger>
        </TabsList>

        {/* ── Active Alerts Tab ────────────────────────────────────────────── */}
        <TabsContent value="active" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5 text-blue-600" />
                Active Alerts
                {!activeQuery.isLoading && (
                  <span className="text-sm font-normal text-gray-500">
                    ({activeAlerts.length} unresolved)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : activeAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No active alerts</p>
                  <p className="text-gray-400 text-xs mt-1">
                    All thresholds are within normal range.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Triggered</TableHead>
                        <TableHead>Resolved</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeAlerts.map(alert => (
                        <AlertRow
                          key={alert.id}
                          alert={alert}
                          canAck={canAck}
                          onAck={handleAck}
                          isAcking={ackMutation.isPending}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info card for non-office users */}
          {!canAck && activeAlerts.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-sm text-amber-800">
                  Alerts can only be acknowledged by Shore Office or Admin users.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── History Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alert History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !historyQuery.data || historyQuery.data.data.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No alert history available.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Severity</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Triggered</TableHead>
                          <TableHead>Resolved by</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyQuery.data.data.map(alert => (
                          <AlertRow
                            key={alert.id}
                            alert={alert}
                            canAck={canAck}
                            onAck={handleAck}
                            isAcking={ackMutation.isPending}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {historyQuery.data.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-500">
                        Showing {((historyPage - 1) * LIMIT) + 1}–
                        {Math.min(historyPage * LIMIT, historyQuery.data.total)} of{" "}
                        {historyQuery.data.total} alerts
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="button-prev-page"
                          onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                          disabled={historyPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-gray-700">
                          Page {historyPage} of {historyQuery.data.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="button-next-page"
                          onClick={() => setHistoryPage(p => Math.min(historyQuery.data!.totalPages, p + 1))}
                          disabled={historyPage === historyQuery.data.totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
