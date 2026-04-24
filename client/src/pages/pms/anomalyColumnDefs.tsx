import type {
  ColDef,
  ICellRendererParams,
  ITooltipParams,
  ValueFormatterParams,
  ValueGetterParams,
} from "ag-grid-community";
import { Clock, Eye, CheckSquare } from "lucide-react";

export interface AnomalyDetails {
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

export interface Anomaly {
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

export interface AnomalyStats {
  totalPending: number;
  totalHigh: number;
  totalMedium: number;
  totalLow: number;
  lastDetected: string | null;
  trendPercentage: number;
}

export const WO_SEVERITY_COLORS: Record<
  string,
  { border: string; bg: string; text: string; badge: string }
> = {
  HIGH: { border: '#DC2626', bg: '#FEF2F2', text: '#991B1B', badge: '#DC2626' },
  MEDIUM: { border: '#F59E0B', bg: '#FFFBEB', text: '#92400E', badge: '#F59E0B' },
  LOW: { border: '#FCD34D', bg: '#FEFCE8', text: '#854D0E', badge: '#CA8A04' },
};

export const ANOMALY_TYPE_LABELS: Record<string, string> = {
  BACKDATING: 'Backdating',
  MISSED_CYCLES: 'Missed Cycles',
  SUSPICIOUS_PATTERN: 'Suspicious Pattern',
  MULTIPLE_ANOMALIES: 'Multiple Anomalies',
};

export function formatDateNullable(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateOrDash(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeAgo(dateStr: string): string {
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

export interface BuildAnomalyColumnDefsOptions {
  canAcknowledge: boolean;
  includeVesselCol: boolean;
  vesselNameById: Map<string, string>;
  onView: (anomaly: Anomaly) => void;
  onAcknowledge: (anomalyId: number) => void;
  ackPending: boolean;
  /**
   * If true, prepend a select checkbox column (only for PENDING_REVIEW rows).
   * Selection requires the consuming grid to set rowSelection / onSelectionChanged / isRowSelectable.
   */
  includeSelectCol?: boolean;
  /**
   * If true, render an "Acknowledged" badge in the actions cell when row.status !== PENDING_REVIEW.
   * Useful on the full Anomalies page where the user can filter to acknowledged rows.
   */
  showAckedBadge?: boolean;
}

export function buildAnomalyColumnDefs(opts: BuildAnomalyColumnDefsOptions): ColDef<Anomaly>[] {
  const {
    canAcknowledge,
    includeVesselCol,
    vesselNameById,
    onView,
    onAcknowledge,
    ackPending,
    includeSelectCol,
    showAckedBadge,
  } = opts;

  const selectCol: ColDef<Anomaly> = {
    headerName: '',
    colId: 'select',
    width: 44,
    minWidth: 44,
    maxWidth: 44,
    pinned: 'left',
    sortable: false,
    filter: false,
    resizable: false,
    checkboxSelection: (params) => params.data?.status === 'PENDING_REVIEW',
    headerCheckboxSelection: true,
    headerCheckboxSelectionFilteredOnly: true,
    cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cellRenderer: (params: ICellRendererParams<Anomaly>) => (
      <span
        data-testid={`cell-select-anomaly-${params.data?.id ?? 'unknown'}`}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    ),
  };

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
            onView(a);
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
      const isAcked = a.status !== 'PENDING_REVIEW';
      return (
        <div className="flex items-center justify-center gap-2 h-full">
          <button
            className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-700 text-xs flex items-center gap-1 hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation();
              onView(a);
            }}
            data-testid={`button-view-details-${a.id}`}
          >
            <Eye className="w-3 h-3" />
            View
          </button>
          {canAcknowledge && !isAcked && (
            <button
              className="px-2 py-1 rounded text-white text-xs flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#1565C0' }}
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(a.id);
              }}
              disabled={ackPending}
              data-testid={`button-acknowledge-${a.id}`}
            >
              <CheckSquare className="w-3 h-3" />
              Ack
            </button>
          )}
          {showAckedBadge && isAcked && (
            <span
              className="px-2 py-1 rounded-full text-[10px] font-semibold text-white"
              style={{ background: '#4CAF50' }}
              data-testid={`badge-acknowledged-${a.id}`}
            >
              Acknowledged
            </span>
          )}
        </div>
      );
    },
  };

  return [
    ...(includeSelectCol && canAcknowledge ? [selectCol] : []),
    ...(includeVesselCol ? [vesselCol] : []),
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
}
