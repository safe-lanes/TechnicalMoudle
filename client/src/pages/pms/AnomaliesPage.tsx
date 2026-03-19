import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUIRole } from "@/contexts/UIRoleContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  CheckSquare,
  ArrowLeft,
  RefreshCw,
  Filter,
} from "lucide-react";

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

const SEVERITY_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AnomaliesPage() {
  const { isSailAdmin, isClientAdmin, isHeadOfDept } = useUIRole();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');

  const canView = isSailAdmin || isClientAdmin || isHeadOfDept;
  const canAcknowledge = isSailAdmin || isClientAdmin;

  const statsQuery = useQuery<AnomalyStats>({
    queryKey: ['/technical/api/anomalies/statistics'],
    queryFn: async () => {
      const res = await fetch('/technical/api/anomalies/statistics');
      if (!res.ok) throw new Error('Failed to fetch statistics');
      return res.json();
    },
    enabled: canView,
    refetchInterval: 5 * 60 * 1000,
  });

  const anomaliesQuery = useQuery<Anomaly[]>({
    queryKey: ['/technical/api/anomalies/dashboard', severityFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      params.set('limit', '100');
      const res = await fetch(`/technical/api/anomalies/dashboard?${params}`);
      if (!res.ok) throw new Error('Failed to fetch anomalies');
      return res.json();
    },
    enabled: canView,
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

  if (!canView) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#9e9e9e' }}>
        You do not have permission to view anomalies.
      </div>
    );
  }

  const stats = statsQuery.data;
  const anomalies = anomaliesQuery.data || [];
  const isLoading = anomaliesQuery.isLoading;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }} data-testid="page-anomalies">
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e0e0e0',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button
          onClick={() => setLocation('/pms/dashboard')}
          style={{
            background: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            color: '#424242',
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#212121' }}>
              Work Order Anomalies
            </div>
            {stats && (
              <div style={{ fontSize: '11px', color: '#757575' }}>
                {stats.totalPending} pending anomaly{stats.totalPending !== 1 ? 's' : ''} require attention
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {stats && stats.totalHigh > 0 && (
            <span style={{ background: '#DC2626', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '8px' }}>
              {stats.totalHigh} HIGH
            </span>
          )}
          {stats && stats.totalMedium > 0 && (
            <span style={{ background: '#F59E0B', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '8px' }}>
              {stats.totalMedium} MED
            </span>
          )}
          {stats && stats.totalLow > 0 && (
            <span style={{ background: '#CA8A04', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '8px' }}>
              {stats.totalLow} LOW
            </span>
          )}
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/technical/api/anomalies/dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['/technical/api/anomalies/statistics'] });
            }}
            style={{
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              padding: '5px 7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            data-testid="button-refresh-all-anomalies"
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ color: '#757575' }} />
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px', maxWidth: '960px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#757575' }}>
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#757575' }}>Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                background: '#fafafa',
                color: '#424242',
                cursor: 'pointer',
              }}
              data-testid="select-full-severity-filter"
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#757575' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                background: '#fafafa',
                color: '#424242',
                cursor: 'pointer',
              }}
              data-testid="select-status-filter"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_REVIEW">Pending</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
            </select>
          </div>

          {!isLoading && (
            <span style={{ fontSize: '11px', color: '#9e9e9e', marginLeft: 'auto' }}>
              {anomalies.length} result{anomalies.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9e9e9e' }} data-testid="loading-anomalies-page">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2" />
            <div style={{ fontSize: '13px' }}>Loading anomalies...</div>
          </div>
        ) : anomalies.length === 0 ? (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
            }}
            data-testid="empty-state-anomalies-page"
          >
            <CheckCircle className="w-12 h-12" style={{ color: '#4CAF50' }} />
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#4CAF50' }}>
              No anomalies detected
            </span>
            <span style={{ fontSize: '13px', color: '#9e9e9e' }}>
              All work orders are on track!
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {anomalies.map((anomaly) => {
              const colors = SEVERITY_COLORS[anomaly.severity] || SEVERITY_COLORS.LOW;
              const allTypes = (anomaly.anomalyDetails as AnomalyDetails)?.allAnomalyTypes || [anomaly.anomalyType];
              const backdatingDays = (anomaly.anomalyDetails as AnomalyDetails)?.backdatingInfo?.daysBackdated || 0;

              return (
                <div
                  key={anomaly.id}
                  style={{
                    borderLeft: `4px solid ${colors.border}`,
                    background: colors.bg,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    border: `1px solid ${colors.border}20`,
                  }}
                  className="hover:shadow-md transition-shadow"
                  data-testid={`card-anomaly-full-${anomaly.id}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#1565C0',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                          onClick={() => setLocation(`/pms/work-order/${anomaly.workOrderCode || anomaly.workOrderId}`)}
                          data-testid={`link-wo-full-${anomaly.id}`}
                        >
                          {anomaly.workOrderCode || anomaly.workOrderId}
                        </span>
                        {allTypes.map((type: string) => (
                          <span
                            key={type}
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: colors.badge,
                              color: '#fff',
                              textTransform: 'uppercase',
                              letterSpacing: '0.3px',
                            }}
                            data-testid={`badge-type-full-${type.toLowerCase()}-${anomaly.id}`}
                          >
                            {ANOMALY_TYPE_LABELS[type] || type}
                          </span>
                        ))}
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: colors.badge,
                            color: '#fff',
                            textTransform: 'uppercase',
                          }}
                          data-testid={`badge-severity-full-${anomaly.id}`}
                        >
                          {anomaly.severity}
                        </span>
                        {anomaly.status === 'ACKNOWLEDGED' && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: '#4CAF50',
                              color: '#fff',
                            }}
                            data-testid={`badge-acknowledged-${anomaly.id}`}
                          >
                            Acknowledged
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#212121', fontWeight: 500, marginBottom: '2px' }}>
                        {anomaly.jobTitle || 'Unknown Job'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#616161', marginBottom: '6px' }}>
                        {anomaly.componentCode && <span>{anomaly.componentCode} — </span>}
                        {anomaly.componentName || ''}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: colors.text }}>
                        {anomaly.daysLate > 0 && (
                          <span data-testid={`text-days-late-full-${anomaly.id}`}>
                            <strong>{anomaly.daysLate.toLocaleString()}</strong> days late
                          </span>
                        )}
                        {anomaly.missedCycles > 0 && (
                          <span data-testid={`text-missed-cycles-full-${anomaly.id}`}>
                            <strong>{anomaly.missedCycles}</strong> cycles missed
                          </span>
                        )}
                        {backdatingDays > 0 && (
                          <span data-testid={`text-backdated-full-${anomaly.id}`}>
                            <strong>{backdatingDays}</strong> days backdated
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#9e9e9e', marginTop: '4px' }}>
                        <span>Due: {formatDate(anomaly.dueDate)}</span>
                        <span>Completed: {formatDate(anomaly.completionDate)}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock className="w-3 h-3" />
                          Detected {timeAgo(anomaly.detectedAt)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                      <button
                        onClick={() => setLocation(`/pms/work-order/${anomaly.workOrderCode || anomaly.workOrderId}`)}
                        style={{
                          fontSize: '12px',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0',
                          background: '#fff',
                          color: '#424242',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                        }}
                        data-testid={`button-view-details-full-${anomaly.id}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View WO
                      </button>
                      {canAcknowledge && anomaly.status === 'PENDING_REVIEW' && (
                        <button
                          onClick={() => acknowledgeMutation.mutate({ anomalyId: anomaly.id, acknowledgedBy: 'Superintendent' })}
                          disabled={acknowledgeMutation.isPending}
                          style={{
                            fontSize: '12px',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#1565C0',
                            color: '#fff',
                            cursor: acknowledgeMutation.isPending ? 'not-allowed' : 'pointer',
                            opacity: acknowledgeMutation.isPending ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap',
                          }}
                          data-testid={`button-acknowledge-full-${anomaly.id}`}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
