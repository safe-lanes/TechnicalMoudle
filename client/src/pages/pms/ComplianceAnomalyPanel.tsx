import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ColDef,
  ICellRendererParams,
  ITooltipParams,
  ValueFormatterParams,
  ValueGetterParams,
} from "ag-grid-community";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import WOAgGridTable from "@/components/WOAgGridTable";
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

interface AnomalyDetails {
  backdatingInfo?: {
    hasBackdating: boolean;
    daysBackdated: number;
    backdatedDate: string | null;
  };
  missedCyclesInfo?: {
    hasMissedCycles: boolean;
    cyclesSkipped: number;
    expectedCompletionDate: string | null;
    actualCompletionDate: string | null;
  };
  patternInfo?: {
    hasPattern: boolean;
    patternDescription: string;
    relatedWorkOrders: string[];
  };
  allAnomalyTypes?: string[];
}

interface Anomaly {
  id: number;
  workOrderId: string;
  workOrderCode: string | null;
  componentCode: string | null;
  componentName: string | null;
  jobTitle: string | null;
  vesselId: string | null;
  anomalyType: string;
  severity: string;
  detectedAt: string;
  completionDate: string | null;
  dueDate: string | null;
  daysLate: number;
  missedCycles: number;
  anomalyDetails: AnomalyDetails | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  justification: string | null;
  isResolved: boolean;
}

interface AnomalyStats {
  totalPending: number;
  totalHigh: number;
  totalMedium: number;
  totalLow: number;
  lastDetected: string | null;
  trendPercentage: number;
}

const severityColors: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  red: { border: "#d32f2f", bg: "#FFEBEE", text: "#c62828", badge: "#d32f2f" },
  yellow: { border: "#f9a825", bg: "#FFF8E1", text: "#f57f17", badge: "#f9a825" },
  green: { border: "#2e7d32", bg: "#E8F5E9", text: "#1b5e20", badge: "#2e7d32" },
};

const WO_SEVERITY_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  HIGH: { border: '#DC2626', bg: '#FEF2F2', text: '#991B1B', badge: '#DC2626' },
  MEDIUM: { border: '#F59E0B', bg: '#FFFBEB', text: '#92400E', badge: '#F59E0B' },
  LOW: { border: '#FCD34D', bg: '#FEFCE8', text: '#854D0E', badge: '#CA8A04' },
};

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  BACKDATING: 'Backdating',
  MISSED_CYCLES: 'Missed Cycles',
  SUSPICIOUS_PATTERN: 'Suspicious Pattern',
  MULTIPLE_ANOMALIES: 'Multiple Anomalies',
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDateNullable(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateOrDash(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
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
  const { data: vessels = [] } = useVessels();

  const effectiveVesselId = vesselId && vesselId !== 'all' ? vesselId : undefined;
  const isAllVessels = !effectiveVesselId;

  const anomaliesQuery = useQuery<Anomaly[]>({
    queryKey: ['/technical/api/anomalies/dashboard', effectiveVesselId, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveVesselId) params.set('vesselId', effectiveVesselId);
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      params.set('limit', '10');
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

  const vesselNameById = useMemo(
    () => new Map(vessels.map(v => [v.id, v.name])),
    [vessels],
  );

  const columnDefs: ColDef<Anomaly>[] = useMemo(() => {
    const vesselCol: ColDef<Anomaly> = {
      headerName: 'Vessel',
      field: 'vesselId',
      minWidth: 130,
      flex: 1,
      valueGetter: (params: ValueGetterParams<Anomaly>) => {
        const vid = params.data?.vesselId;
        return (vid && vesselNameById.get(String(vid))) || (vid || '—');
      },
      cellRenderer: (params: ICellRendererParams<Anomaly>) => (
        <span className="truncate font-medium" data-testid={`cell-anomaly-vessel-${params.data?.id ?? ''}`}>
          {params.value || '—'}
        </span>
      ),
    };

    const componentCol: ColDef<Anomaly> = {
      headerName: 'Component',
      field: 'componentName',
      minWidth: 170,
      flex: 1.2,
      valueGetter: (params: ValueGetterParams<Anomaly>) => {
        const code = params.data?.componentCode;
        const name = params.data?.componentName;
        if (code && name) return `${code} — ${name}`;
        return code || name || '—';
      },
      tooltipValueGetter: (params: ITooltipParams<Anomaly>) => (params.value as string) || '',
    };

    const woCol: ColDef<Anomaly> = {
      headerName: 'Work Order No',
      field: 'workOrderCode',
      minWidth: 170,
      flex: 1,
      valueGetter: (params: ValueGetterParams<Anomaly>) =>
        params.data?.workOrderCode || params.data?.workOrderId || '—',
      cellRenderer: (params: ICellRendererParams<Anomaly>) => {
        const a = params.data;
        if (!a) return null;
        return (
          <span
            className="text-blue-600 underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/pms/work-order/${a.workOrderCode || a.workOrderId}`);
            }}
            data-testid={`link-wo-${a.id}`}
          >
            {params.value}
          </span>
        );
      },
    };

    const jobTitleCol: ColDef<Anomaly> = {
      headerName: 'Job Title',
      field: 'jobTitle',
      minWidth: 200,
      flex: 1.5,
      tooltipValueGetter: (params: ITooltipParams<Anomaly>) => params.data?.jobTitle || '',
      valueFormatter: (params: ValueFormatterParams<Anomaly>) => (params.value as string) || '—',
    };

    const anomalyTypeCol: ColDef<Anomaly> = {
      headerName: 'Anomaly Type',
      field: 'anomalyType',
      minWidth: 180,
      flex: 1.2,
      sortable: false,
      cellRenderer: (params: ICellRendererParams<Anomaly>) => {
        const a = params.data;
        if (!a) return null;
        const colors = WO_SEVERITY_COLORS[a.severity] || WO_SEVERITY_COLORS.LOW;
        const allTypes = (a.anomalyDetails as AnomalyDetails)?.allAnomalyTypes || [a.anomalyType];
        return (
          <div className="flex items-center gap-1 flex-wrap h-full">
            {allTypes.map((type: string) => (
              <span
                key={type}
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: colors.badge,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
                data-testid={`badge-type-${type.toLowerCase()}-${a.id}`}
              >
                {ANOMALY_TYPE_LABELS[type] || type}
              </span>
            ))}
          </div>
        );
      },
    };

    const severityCol: ColDef<Anomaly> = {
      headerName: 'Severity',
      field: 'severity',
      minWidth: 100,
      flex: 0.6,
      cellRenderer: (params: ICellRendererParams<Anomaly>) => {
        const sev = (params.value as string) || 'LOW';
        const colors = WO_SEVERITY_COLORS[sev] || WO_SEVERITY_COLORS.LOW;
        const label = sev === 'MEDIUM' ? 'MED' : sev;
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-medium shrink-0"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
            data-testid={`badge-severity-${params.data?.id ?? ''}`}
          >
            {label}
          </span>
        );
      },
    };

    const detailsCol: ColDef<Anomaly> = {
      headerName: 'Details',
      field: 'daysLate',
      minWidth: 180,
      flex: 1.2,
      sortable: false,
      cellRenderer: (params: ICellRendererParams<Anomaly>) => {
        const a = params.data;
        if (!a) return null;
        const colors = WO_SEVERITY_COLORS[a.severity] || WO_SEVERITY_COLORS.LOW;
        const backdatingDays = (a.anomalyDetails as AnomalyDetails)?.backdatingInfo?.daysBackdated || 0;
        const parts: React.ReactNode[] = [];
        if (a.daysLate > 0) {
          parts.push(
            <span key="late" data-testid={`text-days-late-${a.id}`}>
              <strong>{a.daysLate}</strong> days late
            </span>
          );
        }
        if (a.missedCycles > 0) {
          parts.push(
            <span key="cycles" data-testid={`text-missed-cycles-${a.id}`}>
              <strong>{a.missedCycles}</strong> cycles missed
            </span>
          );
        }
        if (backdatingDays > 0) {
          parts.push(
            <span key="back" data-testid={`text-backdated-${a.id}`}>
              <strong>{backdatingDays}</strong> days backdated
            </span>
          );
        }
        if (parts.length === 0) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex items-center gap-2 flex-wrap text-xs h-full" style={{ color: colors.text }}>
            {parts.map((p, i) => (
              <span key={i} className="whitespace-nowrap">{p}</span>
            ))}
          </div>
        );
      },
    };

    const dueDateCol: ColDef<Anomaly> = {
      headerName: 'Due Date',
      field: 'dueDate',
      minWidth: 120,
      flex: 0.8,
      valueFormatter: (params: ValueFormatterParams<Anomaly>) =>
        formatDateNullable(params.value as string | null | undefined),
    };

    const completedCol: ColDef<Anomaly> = {
      headerName: 'Completed',
      field: 'completionDate',
      minWidth: 120,
      flex: 0.8,
      valueFormatter: (params: ValueFormatterParams<Anomaly>) =>
        formatDateOrDash(params.value as string | null | undefined),
    };

    const detectedCol: ColDef<Anomaly> = {
      headerName: 'Detected',
      field: 'detectedAt',
      minWidth: 110,
      flex: 0.8,
      valueGetter: (params: ValueGetterParams<Anomaly>) => params.data?.detectedAt || null,
      cellRenderer: (params: ICellRendererParams<Anomaly>) => {
        const a = params.data;
        if (!a?.detectedAt) return <span className="text-gray-400">—</span>;
        return (
          <span className="text-xs text-gray-500 whitespace-nowrap" data-testid={`text-detected-${a.id}`}>
            <Clock className="w-3 h-3 inline-block mr-1" style={{ verticalAlign: 'text-bottom' }} />
            {timeAgo(a.detectedAt)}
          </span>
        );
      },
    };

    const actionsCol: ColDef<Anomaly> = {
      headerName: 'Actions',
      field: 'id',
      minWidth: canAcknowledge ? 150 : 90,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (params: ICellRendererParams<Anomaly>) => {
        const a = params.data;
        if (!a) return null;
        return (
          <div className="flex items-center justify-center gap-2 h-full">
            <button
              className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-700 text-xs flex items-center gap-1 hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/pms/work-order/${a.workOrderCode || a.workOrderId}`);
              }}
              data-testid={`button-view-details-${a.id}`}
            >
              <Eye className="w-3 h-3" />
              View
            </button>
            {canAcknowledge && a.status === 'PENDING_REVIEW' && (
              <button
                className="px-2 py-1 rounded text-white text-xs flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: '#1565C0' }}
                onClick={(e) => {
                  e.stopPropagation();
                  acknowledgeMutation.mutate({
                    anomalyId: a.id,
                    acknowledgedBy: 'Superintendent',
                  });
                }}
                disabled={acknowledgeMutation.isPending}
                data-testid={`button-acknowledge-${a.id}`}
              >
                <CheckSquare className="w-3 h-3" />
                Ack
              </button>
            )}
          </div>
        );
      },
    };

    return [
      ...(isAllVessels ? [vesselCol] : []),
      componentCol,
      woCol,
      jobTitleCol,
      anomalyTypeCol,
      severityCol,
      detailsCol,
      dueDateCol,
      completedCol,
      detectedCol,
      actionsCol,
    ];
  }, [isAllVessels, vesselNameById, canAcknowledge, acknowledgeMutation, setLocation]);

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
            rowData={anomalies}
            height="100%"
            rowHeight={42}
            headerHeight={42}
            loading={isLoading}
            noRowsMessage="No anomalies detected"
            testId="ag-grid-wo-anomalies"
            getRowId={(params) => String((params.data as Anomaly).id)}
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
