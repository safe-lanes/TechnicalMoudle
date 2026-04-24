import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ColDef,
  IRowNode,
  SelectionChangedEvent,
} from "ag-grid-community";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import WOAgGridTable from "@/components/WOAgGridTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  buildAnomalyColumnDefs,
  timeAgo,
  type Anomaly,
  type AnomalyDetails,
  type AnomalyStats,
} from "@/pages/pms/anomalyColumnDefs";
import {
  AlertTriangle,
  Calendar,
  BarChart3,
  TrendingDown,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Search,
  Clock,
  Filter,
  Eye,
  CheckSquare,
  RefreshCw,
  Shield,
} from "lucide-react";

interface CycleSkipBreakdown {
  rank: string;
  totalWOs: number;
  skippedWOs: number;
  rate: number;
  severity: "green" | "yellow" | "red";
}

interface BackdatedEntry {
  woCode: string;
  jobTitle: string;
  completionDate: string;
  submittedDate: string;
  daysDiff: number;
  performedBy: string;
}

interface BulkCompletionEvent {
  date: string;
  totalCompleted: number;
  overdueCompleted: number;
  performedBy: string;
}

interface ComplianceAnomalies {
  cycleSkipRate: {
    highestRate: number;
    highestRank: string;
    severity: "green" | "yellow" | "red";
    breakdown: CycleSkipBreakdown[];
  };
  backdatingFrequency: {
    percentage: number;
    severity: "green" | "yellow" | "red";
    recentBackdated: BackdatedEntry[];
  };
  bulkCompletions: {
    eventCount: number;
    severity: "green" | "yellow" | "red";
    events: BulkCompletionEvent[];
  };
  scheduleDrift: {
    averageDaysLate: number;
    severity: "green" | "yellow" | "red";
    median: number;
    worst: { woCode: string; jobTitle: string; daysLate: number } | null;
    bestOnTimeCount: number;
    trend: "increasing" | "decreasing" | "stable";
  };
}

const severityColors: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  red: { border: "#d32f2f", bg: "#FFEBEE", text: "#c62828", badge: "#d32f2f" },
  yellow: { border: "#f9a825", bg: "#FFF8E1", text: "#f57f17", badge: "#f9a825" },
  green: { border: "#2e7d32", bg: "#E8F5E9", text: "#1b5e20", badge: "#2e7d32" },
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function SeverityBadge({ severity }: { severity: "green" | "yellow" | "red" }) {
  const labels = { green: "Good", yellow: "Warning", red: "Alert" };
  const colors = severityColors[severity];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "10px",
        fontWeight: 600,
        color: "#fff",
        background: colors.badge,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
      data-testid={`badge-severity-${severity}`}
    >
      {labels[severity]}
    </span>
  );
}

function DetailModal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
      data-testid="modal-overlay"
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: wide ? "820px" : "720px",
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-content"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#212121", margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5" style={{ color: "#757575" }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CycleSkipDetails({ data, isRestricted }: { data: ComplianceAnomalies["cycleSkipRate"]; isRestricted: boolean }) {
  if (isRestricted) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#757575", fontSize: "13px" }}>
        Detailed crew breakdown is restricted to senior officers.
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
          <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Crew Member (Rank)</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Total WOs</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Skipped Cycles</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Skip Rate</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {data.breakdown.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }} data-testid={`row-skip-rate-${i}`}>
            <td style={{ padding: "8px", fontWeight: 500 }}>{row.rank}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{row.totalWOs}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{row.skippedWOs}</td>
            <td style={{ textAlign: "center", padding: "8px", fontWeight: 600, color: severityColors[row.severity].text }}>
              {row.rate}%
            </td>
            <td style={{ textAlign: "center", padding: "8px" }}>
              <SeverityBadge severity={row.severity} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BackdatingDetails({ data, isRestricted }: { data: ComplianceAnomalies["backdatingFrequency"]; isRestricted: boolean }) {
  if (data.recentBackdated.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#757575", fontSize: "13px" }}>
        No backdated entries found in the last 30 days.
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
          <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>WO Code</th>
          <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Job Title</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Completion Date</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Submitted Date</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Days Backdated</th>
          {!isRestricted && <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Performed By</th>}
        </tr>
      </thead>
      <tbody>
        {data.recentBackdated.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }} data-testid={`row-backdated-${i}`}>
            <td style={{ padding: "8px", fontWeight: 500 }}>{row.woCode}</td>
            <td style={{ padding: "8px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.jobTitle}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{formatDate(row.completionDate)}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{formatDate(row.submittedDate)}</td>
            <td style={{ textAlign: "center", padding: "8px", fontWeight: 600, color: "#d32f2f" }}>{row.daysDiff} days</td>
            {!isRestricted && <td style={{ padding: "8px" }}>{row.performedBy}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BulkCompletionDetails({ data, isRestricted }: { data: ComplianceAnomalies["bulkCompletions"]; isRestricted: boolean }) {
  if (data.events.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#757575", fontSize: "13px" }}>
        No bulk completion events detected in the last 90 days.
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
          <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Date</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>WOs Completed</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Overdue WOs</th>
          {!isRestricted && <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Performed By</th>}
        </tr>
      </thead>
      <tbody>
        {data.events.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }} data-testid={`row-bulk-event-${i}`}>
            <td style={{ padding: "8px", fontWeight: 500 }}>{formatDate(row.date)}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{row.totalCompleted}</td>
            <td style={{ textAlign: "center", padding: "8px", fontWeight: 600, color: "#d32f2f" }}>{row.overdueCompleted}</td>
            {!isRestricted && <td style={{ padding: "8px" }}>{row.performedBy}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScheduleDriftDetails({ data }: { data: ComplianceAnomalies["scheduleDrift"] }) {
  const trendLabels = { increasing: "Getting worse", decreasing: "Improving", stable: "Stable" };
  const trendColors = { increasing: "#d32f2f", decreasing: "#2e7d32", stable: "#757575" };

  return (
    <div style={{ padding: "8px 0", fontSize: "13px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px" }}>
          <div style={{ color: "#757575", fontSize: "11px", marginBottom: "4px" }}>Average Drift</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: severityColors[data.severity].text }}>
            {data.averageDaysLate} days late
          </div>
        </div>
        <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px" }}>
          <div style={{ color: "#757575", fontSize: "11px", marginBottom: "4px" }}>Median Drift</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#424242" }}>
            {data.median} days late
          </div>
        </div>
        <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px" }}>
          <div style={{ color: "#757575", fontSize: "11px", marginBottom: "4px" }}>Worst</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#d32f2f" }}>
            {data.worst ? `${data.worst.daysLate} days (${data.worst.woCode})` : "N/A"}
          </div>
          {data.worst && (
            <div style={{ fontSize: "11px", color: "#757575", marginTop: "2px" }}>{data.worst.jobTitle}</div>
          )}
        </div>
        <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px" }}>
          <div style={{ color: "#757575", fontSize: "11px", marginBottom: "4px" }}>On Time</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#2e7d32" }}>
            {data.bestOnTimeCount} WOs
          </div>
        </div>
      </div>
      <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: "#757575", fontSize: "12px" }}>Trend:</span>
        <span style={{ fontWeight: 600, color: trendColors[data.trend], fontSize: "13px" }}>
          {trendLabels[data.trend]}
        </span>
        {data.trend === "increasing" && <TrendingDown className="w-4 h-4" style={{ color: "#d32f2f", transform: "scaleY(-1)" }} />}
        {data.trend === "decreasing" && <TrendingDown className="w-4 h-4" style={{ color: "#2e7d32" }} />}
      </div>
    </div>
  );
}

function WorkOrderAnomaliesDetails({
  vesselId,
  canAcknowledge,
  stats,
}: {
  vesselId?: string;
  canAcknowledge: boolean;
  stats?: AnomalyStats;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const { data: vessels = [] } = useVessels();

  const effectiveVesselId = vesselId && vesselId !== 'all' ? vesselId : undefined;
  const isAllVessels = !effectiveVesselId;

  const anomaliesQuery = useQuery<Anomaly[]>({
    queryKey: ['/technical/api/anomalies/dashboard', effectiveVesselId, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveVesselId) params.set('vesselId', effectiveVesselId);
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      params.set('limit', '1000');
      const res = await fetch(`/technical/api/anomalies/dashboard?${params}`);
      if (!res.ok) throw new Error('Failed to fetch anomalies');
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ anomalyId, acknowledgedBy }: { anomalyId: number; acknowledgedBy: string }) => {
      return apiRequest('PATCH', `/technical/api/anomalies/${anomalyId}/acknowledge`, { acknowledgedBy });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/anomalies/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/anomalies/statistics'] });
      toast({ title: 'Anomaly acknowledged successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to acknowledge anomaly', variant: 'destructive' });
    },
  });

  const anomalies = anomaliesQuery.data || [];
  const isLoading = anomaliesQuery.isLoading;

  const trimmedSearch = searchTerm.trim().toLowerCase();
  const filteredAnomalies = useMemo(() => {
    if (!trimmedSearch) return anomalies;
    return anomalies.filter((a) => {
      const fields = [
        a.componentCode,
        a.componentName,
        a.workOrderCode,
        a.jobTitle,
      ];
      return fields.some((f) => (f || '').toLowerCase().includes(trimmedSearch));
    });
  }, [anomalies, trimmedSearch]);
  const isSearchActive = trimmedSearch.length > 0;

  const vesselNameById = useMemo(
    () => new Map(vessels.map(v => [v.id, v.name])),
    [vessels],
  );

  const [selectedAnomalyIds, setSelectedAnomalyIds] = useState<number[]>([]);
  const [isBulkAcking, setIsBulkAcking] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const gridApiRef = useRef<SelectionChangedEvent['api'] | null>(null);

  const selectedWorkOrderLabels = useMemo(() => {
    const idSet = new Set(selectedAnomalyIds);
    return anomalies
      .filter((a) => idSet.has(a.id))
      .map((a) => a.workOrderCode || a.workOrderId);
  }, [anomalies, selectedAnomalyIds]);

  const onSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    gridApiRef.current = event.api;
    const ids = event.api
      .getSelectedNodes()
      .map((n: IRowNode<Anomaly>) => n.data?.id)
      .filter((id): id is number => typeof id === 'number');
    setSelectedAnomalyIds(ids);
  }, []);

  useEffect(() => {
    if (!isSearchActive || selectedAnomalyIds.length === 0) return;
    const visibleIds = new Set(filteredAnomalies.map((a) => a.id));
    const hasHiddenSelection = selectedAnomalyIds.some((id) => !visibleIds.has(id));
    if (hasHiddenSelection) {
      gridApiRef.current?.deselectAll();
      setSelectedAnomalyIds([]);
    }
  }, [filteredAnomalies, isSearchActive, selectedAnomalyIds]);

  const isRowSelectable = useCallback(
    (node: IRowNode<Anomaly>) => node.data?.status === 'PENDING_REVIEW',
    [],
  );

  const handleBulkAcknowledge = useCallback(async () => {
    if (selectedAnomalyIds.length === 0 || isBulkAcking) return;
    setBulkConfirmOpen(false);
    setIsBulkAcking(true);
    const total = selectedAnomalyIds.length;
    const results = await Promise.allSettled(
      selectedAnomalyIds.map((id) =>
        apiRequest('PATCH', `/technical/api/anomalies/${id}/acknowledge`, {
          acknowledgedBy: 'Superintendent',
        }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = total - ok;
    queryClient.invalidateQueries({ queryKey: ['/technical/api/anomalies/dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/anomalies/statistics'] });
    gridApiRef.current?.deselectAll();
    setSelectedAnomalyIds([]);
    setIsBulkAcking(false);
    if (fail === 0) {
      toast({ title: `Acknowledged ${ok} ${ok === 1 ? 'anomaly' : 'anomalies'}` });
    } else if (ok === 0) {
      toast({
        title: `Failed to acknowledge ${fail} ${fail === 1 ? 'anomaly' : 'anomalies'}`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: `Acknowledged ${ok} of ${total} anomalies`,
        description: `${fail} failed — please try again.`,
        variant: 'destructive',
      });
    }
  }, [selectedAnomalyIds, isBulkAcking, queryClient, toast]);

  const columnDefs: ColDef<Anomaly>[] = useMemo(
    () =>
      buildAnomalyColumnDefs({
        canAcknowledge,
        includeVesselCol: isAllVessels,
        vesselNameById,
        onView: (a) => setLocation(`/pms/work-order/${a.workOrderCode || a.workOrderId}`),
        onAcknowledge: (anomalyId) =>
          acknowledgeMutation.mutate({ anomalyId, acknowledgedBy: 'Superintendent' }),
        ackPending: acknowledgeMutation.isPending,
        includeSelectCol: true,
      }),
    [isAllVessels, vesselNameById, canAcknowledge, acknowledgeMutation, setLocation],
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Filter className="w-3 h-3" style={{ position: 'absolute', left: '6px', color: '#9e9e9e', pointerEvents: 'none' }} />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                fontSize: '11px',
                padding: '4px 8px 4px 22px',
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                background: '#fafafa',
                color: '#424242',
                cursor: 'pointer',
                appearance: 'auto',
              }}
              data-testid="select-wo-anomaly-severity-filter"
            >
              <option value="ALL">All</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Search className="w-3 h-3" style={{ position: 'absolute', left: '6px', color: '#9e9e9e', pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search component or job title…"
              style={{
                fontSize: '11px',
                padding: '4px 22px 4px 22px',
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                background: '#fafafa',
                color: '#424242',
                width: '220px',
                outline: 'none',
              }}
              data-testid="input-wo-anomaly-search"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: '4px',
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#9e9e9e',
                }}
                data-testid="button-clear-wo-anomaly-search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/technical/api/anomalies/dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['/technical/api/anomalies/statistics'] });
            }}
            style={{
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            data-testid="button-refresh-wo-anomalies"
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ color: '#757575' }} />
          </button>
          <span
            style={{
              fontSize: '11px',
              color: '#616161',
              padding: '4px 8px',
              borderRadius: '6px',
              background: '#f5f5f5',
              border: '1px solid #e0e0e0',
              fontWeight: 500,
              minHeight: '22px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            data-testid="text-wo-anomalies-count"
          >
            {isLoading
              ? 'Loading…'
              : isSearchActive
                ? `${filteredAnomalies.length} of ${anomalies.length} ${anomalies.length === 1 ? 'anomaly' : 'anomalies'}`
                : `${anomalies.length} ${anomalies.length === 1 ? 'anomaly' : 'anomalies'}`}
          </span>
          {canAcknowledge && selectedAnomalyIds.length > 0 && (
            <button
              onClick={() => setBulkConfirmOpen(true)}
              disabled={isBulkAcking}
              style={{
                background: '#1565C0',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: isBulkAcking ? 'not-allowed' : 'pointer',
                opacity: isBulkAcking ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              data-testid="button-bulk-ack-wo-anomalies"
            >
              <CheckSquare className="w-3 h-3" />
              {isBulkAcking ? 'Acknowledging…' : `Bulk Acknowledge (${selectedAnomalyIds.length})`}
            </button>
          )}
        </div>
      </div>

      {!isLoading && anomalies.length === 0 ? (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            minHeight: '160px',
            justifyContent: 'center',
          }}
          data-testid="empty-state-wo-anomalies"
        >
          <CheckCircle className="w-10 h-10" style={{ color: '#4CAF50' }} />
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#4CAF50' }}>
            No anomalies detected
          </span>
          <span style={{ fontSize: '12px', color: '#9e9e9e' }}>
            All work orders are on track!
          </span>
        </div>
      ) : (
        <div style={{ height: '50vh', minHeight: '320px' }} data-testid="ag-grid-wo-anomalies-wrap">
          <WOAgGridTable
            columnDefs={columnDefs}
            rowData={filteredAnomalies}
            height="100%"
            rowHeight={42}
            headerHeight={42}
            loading={isLoading}
            noRowsMessage={isSearchActive ? 'No anomalies match your search' : 'No anomalies detected'}
            testId="ag-grid-wo-anomalies"
            getRowId={(params) => String((params.data as Anomaly).id)}
            rowSelection={canAcknowledge ? 'multiple' : undefined}
            onSelectionChanged={canAcknowledge ? onSelectionChanged : undefined}
            isRowSelectable={canAcknowledge ? isRowSelectable : undefined}
          />
        </div>
      )}

      <div style={{
        paddingTop: '12px',
        borderTop: '1px solid #E0E0E0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '8px',
      }}>
        <span
          onClick={() => setLocation('/pms/anomalies')}
          style={{ fontSize: '12px', color: '#1565C0', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}
          data-testid="link-view-all-anomalies"
        >
          View All Anomalies
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
        <span style={{ fontSize: '10px', color: '#bdbdbd' }} data-testid="text-last-updated">
          {stats?.lastDetected
            ? `Last detected: ${timeAgo(stats.lastDetected)}`
            : 'No anomalies recorded'}
        </span>
      </div>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent data-testid="dialog-confirm-bulk-ack">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {`Acknowledge ${selectedAnomalyIds.length} ${selectedAnomalyIds.length === 1 ? 'anomaly' : 'anomalies'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedWorkOrderLabels.length > 0 ? (
                <>
                  This will acknowledge the following work orders:
                  <span
                    style={{
                      display: 'block',
                      marginTop: '8px',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      fontSize: '12px',
                      color: '#424242',
                      background: '#f5f5f5',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      lineHeight: 1.5,
                    }}
                    data-testid="text-bulk-ack-wo-list"
                  >
                    {selectedWorkOrderLabels.slice(0, 20).join(', ')}
                    {selectedWorkOrderLabels.length > 20
                      ? `, +${selectedWorkOrderLabels.length - 20} more`
                      : ''}
                  </span>
                </>
              ) : (
                'This will acknowledge the selected anomalies.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-ack">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAcknowledge}
              data-testid="button-confirm-bulk-ack"
            >
              {`Acknowledge ${selectedAnomalyIds.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  label: string | React.ReactNode;
  severity: "green" | "yellow" | "red" | "grey";
  onClick: () => void;
  testId: string;
}

function MetricCard({ icon, title, value, label, severity, onClick, testId }: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = severity === "grey"
    ? { border: "#bdbdbd", bg: "#f5f5f5", text: "#9e9e9e", badge: "#bdbdbd" }
    : severityColors[severity];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: "#f9fafb",
        borderRadius: "8px",
        padding: "16px",
        borderLeft: `3px solid ${colors.border}`,
        cursor: "pointer",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
        boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
        transform: isHovered ? "translateY(-2px)" : "none",
        flex: 1,
        minWidth: 0,
      }}
      data-testid={testId}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        {icon}
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#616161", textTransform: "uppercase", letterSpacing: "0.3px" }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: "32px", fontWeight: 700, color: colors.text, lineHeight: 1.1, marginBottom: "6px" }}>
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "#757575", lineHeight: 1.4 }}>
        {label}
      </div>
      <div style={{ marginTop: "8px", fontSize: "11px", color: "#1565C0", fontWeight: 500 }}>
        View Details →
      </div>
    </div>
  );
}

interface SuperintendentSummary {
  pendingCount: number;
  acknowledgedThisMonthCount: number;
}

interface ComplianceAnomalyPanelProps {
  vesselId?: string;
  superintendentSummary?: SuperintendentSummary;
  onNavigateToSuperintendent?: () => void;
}

export function ComplianceAnomalyPanel({ vesselId, superintendentSummary, onNavigateToSuperintendent }: ComplianceAnomalyPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { isSailAdmin, isClientAdmin, isHeadOfDept, isVessel } = useUIRole();

  const canViewPanel = isSailAdmin;
  const isRestricted = isVessel;
  const canAcknowledge = isSailAdmin || isClientAdmin;
  const canViewAnomalies = isSailAdmin || isClientAdmin || isHeadOfDept;

  const queryUrl = vesselId && vesselId !== "all"
    ? `/technical/api/dashboard/compliance-anomalies?vesselId=${vesselId}`
    : "/technical/api/dashboard/compliance-anomalies";

  const effectiveVesselId = vesselId && vesselId !== 'all' ? vesselId : undefined;

  const { data, isLoading, error } = useQuery<ComplianceAnomalies>({
    queryKey: ["/technical/api/dashboard/compliance-anomalies", vesselId],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error("Failed to fetch compliance anomalies");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    enabled: canViewPanel || isVessel,
  });

  const statsQuery = useQuery<AnomalyStats>({
    queryKey: ['/technical/api/anomalies/statistics', effectiveVesselId],
    queryFn: async () => {
      const url = effectiveVesselId
        ? `/technical/api/anomalies/statistics?vesselId=${effectiveVesselId}`
        : '/technical/api/anomalies/statistics';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch statistics');
      return res.json();
    },
    enabled: canViewAnomalies && !isVessel,
    refetchInterval: 5 * 60 * 1000,
  });

  if (!canViewPanel && !canViewAnomalies && !isVessel) return null;

  const hasNoData = !data || (
    data.cycleSkipRate.breakdown.length === 0 &&
    data.backdatingFrequency.recentBackdated.length === 0 &&
    data.bulkCompletions.events.length === 0 &&
    !data.scheduleDrift.worst
  );

  const allGreen = data &&
    data.cycleSkipRate.severity === "green" &&
    data.backdatingFrequency.severity === "green" &&
    data.bulkCompletions.severity === "green" &&
    data.scheduleDrift.severity === "green";

  const anomalyStats = statsQuery.data;
  const anomalySeverity: "green" | "yellow" | "red" | "grey" = !anomalyStats
    ? "grey"
    : anomalyStats.totalHigh > 0
      ? "red"
      : anomalyStats.totalMedium > 0
        ? "yellow"
        : anomalyStats.totalLow > 0
          ? "yellow"
          : "green";

  const anomalyLabel = anomalyStats ? (
    <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
      {anomalyStats.totalHigh > 0 && (
        <span style={{ background: '#DC2626', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '6px' }}>
          {anomalyStats.totalHigh} HIGH
        </span>
      )}
      {anomalyStats.totalMedium > 0 && (
        <span style={{ background: '#F59E0B', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '6px' }}>
          {anomalyStats.totalMedium} MED
        </span>
      )}
      {anomalyStats.totalLow > 0 && (
        <span style={{ background: '#CA8A04', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '6px' }}>
          {anomalyStats.totalLow} LOW
        </span>
      )}
      {anomalyStats.totalPending === 0 && "No anomalies detected"}
    </span>
  ) : "Insufficient data";

  return (
    <div style={{ padding: 0 }} data-testid="panel-compliance-anomaly">
      <div style={{
        background: "#fff",
        borderRadius: "8px",
        border: "1px solid #e0e0e0",
        overflow: "hidden",
      }}>
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            background: "#fafafa",
            borderBottom: isCollapsed ? "none" : "1px solid #e0e0e0",
          }}
          data-testid="button-toggle-compliance-panel"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Search className="w-5 h-5" style={{ color: "#1565C0" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#212121", letterSpacing: "0.3px" }}>
                Compliance Anomaly Detection
              </div>
              <div style={{ fontSize: "11px", color: "#757575", marginTop: "2px" }}>
                Patterns indicating potential maintenance schedule manipulation
              </div>
            </div>
          </div>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4" style={{ color: "#757575" }} />
          ) : (
            <ChevronUp className="w-4 h-4" style={{ color: "#757575" }} />
          )}
        </div>

        {!isCollapsed && (
          <div style={{ padding: "16px" }}>
            {(canViewPanel || isVessel) && isLoading && (
              <div style={{ textAlign: "center", padding: "32px", color: "#757575", fontSize: "13px" }} data-testid="loading-compliance">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2" />
                <div>Analyzing compliance patterns...</div>
              </div>
            )}

            {(canViewPanel || isVessel) && error && (
              <div style={{ textAlign: "center", padding: "20px", color: "#d32f2f", fontSize: "13px" }} data-testid="error-compliance">
                Failed to load compliance data. Please try again later.
              </div>
            )}

            {data && !isLoading && allGreen && !hasNoData && (
              <div
                style={{
                  background: "#E8F5E9",
                  border: "1px solid #C8E6C9",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
                data-testid="banner-all-green"
              >
                <CheckCircle className="w-5 h-5" style={{ color: "#2e7d32" }} />
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#1b5e20" }}>
                  No compliance anomalies detected. Maintenance schedule is on track.
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {canViewAnomalies && !isVessel && (
                <MetricCard
                  icon={<AlertTriangle className="w-4 h-4" style={{ color: anomalySeverity === 'grey' ? '#bdbdbd' : anomalySeverity === 'red' ? '#DC2626' : anomalySeverity === 'yellow' ? '#F59E0B' : '#2e7d32' }} />}
                  title="Work Order Anomalies"
                  value={anomalyStats ? `${anomalyStats.totalPending}` : "—"}
                  label={anomalyLabel}
                  severity={!anomalyStats ? "grey" : anomalySeverity}
                  onClick={() => setActiveModal("woAnomalies")}
                  testId="card-work-order-anomalies"
                />
              )}
              {data && !isLoading && (
                <>
                  <MetricCard
                    icon={<AlertTriangle className="w-4 h-4" style={{ color: hasNoData ? "#bdbdbd" : severityColors[data.cycleSkipRate.severity].text }} />}
                    title="Cycle Skip Rate"
                    value={hasNoData ? "—" : `${data.cycleSkipRate.highestRate}%`}
                    label={hasNoData ? "Insufficient data" : isRestricted ? "Highest skip rate across crew" : `${data.cycleSkipRate.highestRank} has highest skip rate`}
                    severity={hasNoData ? "grey" : data.cycleSkipRate.severity}
                    onClick={() => !hasNoData && !isRestricted && setActiveModal("cycleSkip")}
                    testId="card-cycle-skip-rate"
                  />
                  <MetricCard
                    icon={<Calendar className="w-4 h-4" style={{ color: hasNoData ? "#bdbdbd" : severityColors[data.backdatingFrequency.severity].text }} />}
                    title="Backdating Frequency"
                    value={hasNoData ? "—" : `${data.backdatingFrequency.percentage}%`}
                    label={hasNoData ? "Insufficient data" : "of WOs completed with backdated entries"}
                    severity={hasNoData ? "grey" : data.backdatingFrequency.severity}
                    onClick={() => !hasNoData && !isRestricted && setActiveModal("backdating")}
                    testId="card-backdating-frequency"
                  />
                  <MetricCard
                    icon={<BarChart3 className="w-4 h-4" style={{ color: hasNoData ? "#bdbdbd" : severityColors[data.bulkCompletions.severity].text }} />}
                    title="Bulk Completion Events"
                    value={hasNoData ? "—" : `${data.bulkCompletions.eventCount} events`}
                    label={hasNoData ? "Insufficient data" : "Last 90 days — clustering at month-end"}
                    severity={hasNoData ? "grey" : data.bulkCompletions.severity}
                    onClick={() => !hasNoData && !isRestricted && setActiveModal("bulk")}
                    testId="card-bulk-completions"
                  />
                  <MetricCard
                    icon={<TrendingDown className="w-4 h-4" style={{ color: hasNoData ? "#bdbdbd" : severityColors[data.scheduleDrift.severity].text }} />}
                    title="Schedule Drift"
                    value={hasNoData ? "—" : `${data.scheduleDrift.averageDaysLate} days`}
                    label={hasNoData ? "Insufficient data" : "Average lateness across all jobs"}
                    severity={hasNoData ? "grey" : data.scheduleDrift.severity}
                    onClick={() => !hasNoData && !isRestricted && setActiveModal("drift")}
                    testId="card-schedule-drift"
                  />
                </>
              )}
            </div>

            {onNavigateToSuperintendent && (
              <div
                onClick={onNavigateToSuperintendent}
                style={{
                  marginTop: "16px",
                  borderTop: "1px solid #e0e0e0",
                  padding: "14px 0 0 0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
                data-testid="tile-superintendent-notifications"
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: (superintendentSummary?.pendingCount ?? 0) > 0 ? '#ff6d00' : '#9e9e9e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#424242', marginBottom: '6px', letterSpacing: '0.3px' }}>
                    Superintendent Notifications
                  </div>
                  <div style={{ display: 'flex', gap: '28px', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontSize: '22px', fontWeight: 700, color: (superintendentSummary?.pendingCount ?? 0) > 0 ? '#d32f2f' : '#757575' }} data-testid="text-pending-count">
                        {superintendentSummary?.pendingCount ?? 0}
                      </span>
                      <span style={{ fontSize: '11px', color: (superintendentSummary?.pendingCount ?? 0) > 0 ? '#d32f2f' : '#757575', marginLeft: '5px' }}>
                        Pending Acknowledgment
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: '#2e7d32' }} data-testid="text-acknowledged-count">
                        {superintendentSummary?.acknowledgedThisMonthCount ?? 0}
                      </span>
                      <span style={{ fontSize: '11px', color: '#2e7d32', marginLeft: '5px' }}>
                        Acknowledged This Month
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5" style={{ color: '#9e9e9e' }} />
              </div>
            )}
          </div>
        )}
      </div>

      {activeModal === "woAnomalies" && (
        <DetailModal title="Work Order Anomalies" onClose={() => setActiveModal(null)} wide>
          <WorkOrderAnomaliesDetails
            vesselId={vesselId}
            canAcknowledge={canAcknowledge}
            stats={anomalyStats}
          />
        </DetailModal>
      )}
      {activeModal === "cycleSkip" && data && (
        <DetailModal title="Cycle Skip Rate — Breakdown by Crew Member" onClose={() => setActiveModal(null)}>
          <CycleSkipDetails data={data.cycleSkipRate} isRestricted={isRestricted} />
        </DetailModal>
      )}
      {activeModal === "backdating" && data && (
        <DetailModal title="Backdating Frequency — Recent Backdated Entries" onClose={() => setActiveModal(null)}>
          <BackdatingDetails data={data.backdatingFrequency} isRestricted={isRestricted} />
        </DetailModal>
      )}
      {activeModal === "bulk" && data && (
        <DetailModal title="Bulk Completion Events — Last 90 Days" onClose={() => setActiveModal(null)}>
          <BulkCompletionDetails data={data.bulkCompletions} isRestricted={isRestricted} />
        </DetailModal>
      )}
      {activeModal === "drift" && data && (
        <DetailModal title="Schedule Drift — Last 90 Days" onClose={() => setActiveModal(null)}>
          <ScheduleDriftDetails data={data.scheduleDrift} />
        </DetailModal>
      )}
    </div>
  );
}
