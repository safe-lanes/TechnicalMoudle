import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronRight,
  Clock,
  Filter,
  Eye,
  CheckSquare,
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

interface AnomalyDetectionTileProps {
  vesselId?: string;
}

export default function AnomalyDetectionTile({ vesselId }: AnomalyDetectionTileProps) {
  const { isSailAdmin, isClientAdmin, isHeadOfDept, isVessel } = useUIRole();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const canView = isSailAdmin || isClientAdmin || isHeadOfDept;
  const canAcknowledge = isSailAdmin || isClientAdmin;
  const effectiveVesselId = vesselId && vesselId !== 'all' ? vesselId : undefined;

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
    enabled: canView,
    refetchInterval: 5 * 60 * 1000,
  });

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

  if (!canView || isVessel) return null;

  const stats = statsQuery.data;
  const anomalies = anomaliesQuery.data || [];
  const isLoading = statsQuery.isLoading || anomaliesQuery.isLoading;

  const contentCard: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e0e0e0',
    overflow: 'hidden',
  };

  return (
    <div style={{ padding: '0 16px 16px 16px' }} data-testid="tile-work-order-anomalies">
      <div style={contentCard}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #E0E0E0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#212121' }} data-testid="text-anomaly-tile-title">
              Work Order Anomalies
            </span>
            {stats && stats.totalPending > 0 && (
              <span
                style={{
                  background: '#DC2626',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  minWidth: '20px',
                  textAlign: 'center',
                }}
                data-testid="badge-total-pending"
              >
                {stats.totalPending}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {stats && (
              <>
                {stats.totalHigh > 0 && (
                  <span
                    style={{ background: '#DC2626', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '8px' }}
                    data-testid="badge-high-count"
                  >
                    {stats.totalHigh} HIGH
                  </span>
                )}
                {stats.totalMedium > 0 && (
                  <span
                    style={{ background: '#F59E0B', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '8px' }}
                    data-testid="badge-medium-count"
                  >
                    {stats.totalMedium} MED
                  </span>
                )}
                {stats.totalLow > 0 && (
                  <span
                    style={{ background: '#CA8A04', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '8px' }}
                    data-testid="badge-low-count"
                  >
                    {stats.totalLow} LOW
                  </span>
                )}
              </>
            )}
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
                data-testid="select-severity-filter"
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
              data-testid="button-refresh-anomalies"
            >
              <RefreshCw className="w-3.5 h-3.5" style={{ color: '#757575' }} />
            </button>
          </div>
        </div>

        <div style={{ minHeight: '120px' }}>
          {isLoading ? (
            <div style={{ padding: '24px 16px' }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: '72px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              ))}
            </div>
          ) : anomalies.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
              data-testid="empty-state-anomalies"
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
            <div style={{ padding: '8px' }}>
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
                      padding: '10px 12px',
                      marginBottom: '6px',
                      transition: 'box-shadow 0.15s',
                    }}
                    className="hover:shadow-md"
                    data-testid={`card-anomaly-${anomaly.id}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#1565C0',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                            onClick={() => setLocation(`/pms/work-orders/${anomaly.workOrderId}`)}
                            data-testid={`link-wo-${anomaly.id}`}
                          >
                            {anomaly.workOrderCode || anomaly.workOrderId}
                          </span>
                          {allTypes.map((type: string) => (
                            <span
                              key={type}
                              style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: colors.badge,
                                color: '#fff',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                              }}
                              data-testid={`badge-type-${type.toLowerCase()}-${anomaly.id}`}
                            >
                              {ANOMALY_TYPE_LABELS[type] || type}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: '12px', color: '#424242', fontWeight: 500, marginBottom: '2px' }}>
                          {anomaly.jobTitle || 'Unknown Job'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#757575', marginBottom: '4px' }}>
                          {anomaly.componentCode && <span>{anomaly.componentCode} — </span>}
                          {anomaly.componentName || ''}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', color: colors.text }}>
                          {anomaly.daysLate > 0 && (
                            <span data-testid={`text-days-late-${anomaly.id}`}>
                              <strong>{anomaly.daysLate}</strong> days late
                            </span>
                          )}
                          {anomaly.missedCycles > 0 && (
                            <span data-testid={`text-missed-cycles-${anomaly.id}`}>
                              <strong>{anomaly.missedCycles}</strong> cycles missed
                            </span>
                          )}
                          {backdatingDays > 0 && (
                            <span data-testid={`text-backdated-${anomaly.id}`}>
                              <strong>{backdatingDays}</strong> days backdated
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: '#9e9e9e', marginTop: '4px' }}>
                          <span>Due: {formatDate(anomaly.dueDate)}</span>
                          <span>Completed: {formatDate(anomaly.completionDate)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', color: '#9e9e9e', whiteSpace: 'nowrap' }} data-testid={`text-detected-${anomaly.id}`}>
                          <Clock className="w-3 h-3 inline-block mr-1" style={{ verticalAlign: 'text-bottom' }} />
                          {timeAgo(anomaly.detectedAt)}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => setLocation(`/pms/work-orders/${anomaly.workOrderId}`)}
                            style={{
                              fontSize: '10px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: '1px solid #e0e0e0',
                              background: '#fff',
                              color: '#424242',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                            data-testid={`button-view-details-${anomaly.id}`}
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          {canAcknowledge && anomaly.status === 'PENDING_REVIEW' && (
                            <button
                              onClick={() => {
                                acknowledgeMutation.mutate({
                                  anomalyId: anomaly.id,
                                  acknowledgedBy: 'Superintendent',
                                });
                              }}
                              disabled={acknowledgeMutation.isPending}
                              style={{
                                fontSize: '10px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                background: '#1565C0',
                                color: '#fff',
                                cursor: acknowledgeMutation.isPending ? 'not-allowed' : 'pointer',
                                opacity: acknowledgeMutation.isPending ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              data-testid={`button-acknowledge-${anomaly.id}`}
                            >
                              <CheckSquare className="w-3 h-3" />
                              Ack
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #E0E0E0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span
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
    </div>
  );
}
