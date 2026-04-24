import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { GridApi, GridReadyEvent } from "ag-grid-community";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useVessels } from "@/hooks/useVessels";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import WOAgGridTable from "@/components/WOAgGridTable";
import {
  ANOMALY_TYPE_LABELS,
  buildAnomalyColumnDefs,
  formatDateNullable,
  formatDateOrDash,
  timeAgo,
  type Anomaly,
  type AnomalyDetails,
  type AnomalyStats,
} from "@/pages/pms/anomalyColumnDefs";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  RefreshCw,
  Filter,
} from "lucide-react";

export default function AnomaliesPage() {
  const { isSailAdmin, isClientAdmin, isHeadOfDept } = useUIRole();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: vessels = [] } = useVessels();

  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_REVIEW');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

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
      params.set('limit', '1000');
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

  const vesselNameById = useMemo(
    () => new Map(vessels.map((v) => [v.id, v.name])),
    [vessels],
  );

  const columnDefs = useMemo(
    () =>
      buildAnomalyColumnDefs({
        canAcknowledge,
        includeVesselCol: true,
        vesselNameById,
        onView: (a) => setLocation(`/pms/work-order/${a.workOrderCode || a.workOrderId}`),
        onAcknowledge: (anomalyId) =>
          acknowledgeMutation.mutate({ anomalyId, acknowledgedBy: 'Superintendent' }),
        ackPending: acknowledgeMutation.isPending,
        showAckedBadge: true,
      }),
    [canAcknowledge, vesselNameById, acknowledgeMutation, setLocation],
  );

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

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    setGridApi(event.api);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!gridApi) return;
    const today = new Date().toISOString().slice(0, 10);
    const exportColumnKeys = gridApi
      .getAllDisplayedColumns()
      .map((col) => col.getColId())
      .filter((id) => id !== 'actions');
    gridApi.exportDataAsCsv({
      fileName: `work-order-anomalies-${today}.csv`,
      columnKeys: exportColumnKeys,
      processCellCallback: (params) => {
        const colId = params.column.getColId();
        const a = params.node?.data as Anomaly | undefined;
        if (!a) return params.value ?? '';

        if (colId === 'anomalyType') {
          const allTypes = (a.anomalyDetails as AnomalyDetails | null)?.allAnomalyTypes
            || [a.anomalyType];
          return allTypes.map((t) => ANOMALY_TYPE_LABELS[t] || t).join(', ');
        }
        if (colId === 'severity') {
          const sev = (a.severity || 'LOW').toString();
          return sev.charAt(0) + sev.slice(1).toLowerCase();
        }
        if (colId === 'daysLate') {
          const backdating = (a.anomalyDetails as AnomalyDetails | null)?.backdatingInfo?.daysBackdated || 0;
          const parts: string[] = [];
          if (a.daysLate > 0) parts.push(`${a.daysLate} days late`);
          if (a.missedCycles > 0) parts.push(`${a.missedCycles} cycles missed`);
          if (backdating > 0) parts.push(`${backdating} days backdated`);
          return parts.join('; ');
        }
        if (colId === 'dueDate') {
          return formatDateNullable(a.dueDate);
        }
        if (colId === 'completionDate') {
          return formatDateOrDash(a.completionDate);
        }
        if (colId === 'detectedAt') {
          return a.detectedAt ? timeAgo(a.detectedAt) : '';
        }
        return params.value ?? '';
      },
    });
  }, [gridApi]);

  const canExport = !!gridApi && !isLoading && anomalies.length > 0;

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
          <button
            onClick={handleExportCsv}
            disabled={!canExport}
            style={{
              background: canExport ? '#fff' : '#f5f5f5',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              padding: '5px 10px',
              cursor: canExport ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: canExport ? '#424242' : '#bdbdbd',
            }}
            data-testid="button-export-anomalies-csv"
            title="Export the visible rows to a CSV file"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
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
            <span
              style={{ fontSize: '11px', color: '#9e9e9e', marginLeft: 'auto' }}
              data-testid="text-anomalies-page-count"
            >
              {anomalies.length} result{anomalies.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{ height: 'calc(100vh - 180px)', minHeight: '420px' }} data-testid="ag-grid-anomalies-page-wrap">
          <WOAgGridTable
            columnDefs={columnDefs}
            rowData={anomalies}
            height="100%"
            rowHeight={42}
            headerHeight={42}
            loading={isLoading}
            noRowsMessage="No anomalies detected — all work orders are on track!"
            testId="ag-grid-anomalies-page"
            getRowId={(params) => String((params.data as Anomaly).id)}
            onGridReady={handleGridReady}
          />
        </div>
      </div>
    </div>
  );
}
