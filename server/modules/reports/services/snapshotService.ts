import * as repo from '../repositories/reportRepository';
import { lowStockReportService } from '../../../services/lowStockReportService';
import { storage } from '../../../storage';

// ═══════════════════════════════════════════════════════════════
// REPORT SNAPSHOTS - LIST
// ═══════════════════════════════════════════════════════════════

export async function getSnapshots(
  vesselId: string,
  reportType: string | undefined,
  startDate: Date | undefined,
  endDate: Date | undefined,
  limit: number,
) {
  return lowStockReportService.getSnapshots(vesselId, reportType, startDate, endDate, limit);
}

// ═══════════════════════════════════════════════════════════════
// REPORT SNAPSHOTS - DETAIL
// ═══════════════════════════════════════════════════════════════

export async function getSnapshotDetail(snapshotId: number) {
  return lowStockReportService.getSnapshotDetail(snapshotId);
}

// ═══════════════════════════════════════════════════════════════
// GENERIC REPORT ROUTER
// ═══════════════════════════════════════════════════════════════

function convertToCSV(data: any): string {
  if (!data.data || data.data.length === 0) return '';
  const headers = Object.keys(data.data[0]);
  const rows = data.data.map((row: any) =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export async function getGenericReport(
  reportType: string,
  vesselId: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  format: string | undefined,
) {
  // Skip to next handler for report types that have dedicated routes
  const dedicatedReportRoutes = [
    'equipment-utilization-summary',
    'running-hours-anomaly-detection',
    'critical-equipment-status',
    'unplanned-breakdown-jobs',
    'crew-workload-distribution',
    'ihm-inventory-status',
    'change-requests-status-tracking',
    'critical-components-list',
    'critical-equipment-schedule',
    'lsa-ffa-master-list',
    'lsa-ffa-maintenance-schedule'
  ];

  if (dedicatedReportRoutes.includes(reportType)) {
    return { skipToNext: true };
  }

  const reportData: {
    title: string;
    vessel: string;
    period: string;
    generatedAt: string;
    data: any[];
  } = {
    title: `${reportType.toUpperCase()} Report`,
    vessel: vesselId || 'All Vessels',
    period: `${dateFrom || 'Start'} to ${dateTo || 'End'}`,
    generatedAt: new Date().toISOString(),
    data: []
  };

  switch(reportType) {
    case 'inventory':
      const spares = await repo.getSpares(vesselId as string);
      reportData.data = spares.map((spare: any) => ({
        partCode: spare.partCode,
        partName: spare.partName,
        stockQuantity: spare.rob || 0,
        minimumQuantity: spare.min || 0,
        status: (spare.rob || 0) <= (spare.min || 0) ? 'Low Stock' : 'OK'
      }));
      break;
    case 'consumption':
      const history = await repo.getSpareHistory(vesselId as string);
      reportData.data = history;
      break;
  }

  if (format === 'csv') {
    const csv = convertToCSV(reportData);
    return { csv, filename: `${reportType}-report.csv` };
  }

  return { data: reportData };
}
