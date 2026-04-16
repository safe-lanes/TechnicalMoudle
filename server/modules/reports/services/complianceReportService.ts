import ExcelJS from 'exceljs';
import { sql } from 'drizzle-orm';
import * as repo from '../repositories/reportRepository';
import { getDb } from '../../../db';
import { runningHoursAudit } from '@shared/schema';
import {
  applyStandardHeader, applyStandardTableHeader,
  applyStandardDataRows, applyStandardPageSetup,
  getLastColumnLetter,
  type ColumnDef, type ConditionalStyle
} from '../../../lib/excelReportStyles';

// ═══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

function parseDateVal(dateVal: string | Date | null | undefined): Date | null {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal instanceof Date ? dateVal : dateVal);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatDateDisplay(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return '-';
  try {
    const dateStr = dateVal instanceof Date ? dateVal.toISOString() : String(dateVal);
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
  } catch {
    return '-';
  }
}

// ═══════════════════════════════════════════════════════════════
// RUNNING HOURS ANOMALY DETECTION - PREVIEW (GET)
// ═══════════════════════════════════════════════════════════════

export async function getRunningHoursAnomalyDetection(
  vesselId: string,
  startDate?: string,
  endDate?: string,
  anomalyType?: string,
  severityFilter?: string,
) {
  // Get vessel name
  const vessels = await repo.getVessels();
  const vessel = vessels.find(v => v.id === vesselId || (v as any).vesselCode === vesselId);
  const vesselName = vessel?.name || (vessel as any)?.vesselName || String(vesselId);

  // Get database instance
  const db = await getDb();

  // Query running_hours_audit table (this has the actual data - 1,146 records)
  const allAuditLogs = await db.select().from(runningHoursAudit)
    .where(sql`${runningHoursAudit.vesselId} = ${vesselId}`);

  console.log(`[ANOMALY] Vessel: ${vesselId}, Audit logs found: ${allAuditLogs.length}`);

  // Debug: Check first log entry to understand date format
  if (allAuditLogs.length > 0) {
    const firstLog = allAuditLogs[0];
    console.log(`[ANOMALY DEBUG] First log enteredAtUTC: ${firstLog.enteredAtUTC}, type: ${typeof firstLog.enteredAtUTC}`);
  }

  const now = new Date();
  const defaultStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days for better analysis
  const periodStart = startDate ? parseDateVal(startDate) : defaultStartDate;
  const periodEnd = endDate ? parseDateVal(endDate) : now;

  if (!periodStart || !periodEnd) {
    throw new Error("Invalid date format");
  }

  // Filter logs within the date range - handle both Date objects and strings from Drizzle
  const logsInPeriod = allAuditLogs.filter(log => {
    if (!log.enteredAtUTC) return false;
    const logDate = log.enteredAtUTC instanceof Date ? log.enteredAtUTC : new Date(log.enteredAtUTC);
    return logDate >= periodStart && logDate <= periodEnd;
  });

  console.log(`[ANOMALY] Logs in period: ${logsInPeriod.length}, Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

  // Group logs by component to analyze patterns
  const componentLogs = new Map<string, typeof logsInPeriod>();
  for (const log of logsInPeriod) {
    const key = log.componentId || log.componentCode || 'unknown';
    if (!componentLogs.has(key)) {
      componentLogs.set(key, []);
    }
    componentLogs.get(key)!.push(log);
  }

  // Get components for reference
  const allComponents = await repo.getComponents(vesselId);
  const componentMap = new Map(allComponents.map(c => [c.cuuid, c]));
  const componentCodeMap = new Map(allComponents.map(c => [c.componentCode, c]));

  // Detect anomalies
  const anomalies: any[] = [];
  let sNo = 0;

  for (const [componentKey, logs] of Array.from(componentLogs.entries())) {
    // Sort logs by timestamp to analyze consecutive readings
    const sortedLogs = logs.sort((a: any, b: any) =>
      new Date(a.enteredAtUTC!).getTime() - new Date(b.enteredAtUTC!).getTime()
    );

    // Calculate average delta for this component (for irregular pattern detection)
    const deltas = sortedLogs.map((log: any) => {
      const prev = Number(log.previousRH) || 0;
      const curr = Number(log.newRH) || 0;
      return curr - prev;
    }).filter((d: number) => d > 0);
    const avgDelta = deltas.length > 0 ? deltas.reduce((a: number, b: number) => a + b, 0) / deltas.length : 0;

    for (let i = 0; i < sortedLogs.length; i++) {
      const log = sortedLogs[i];
      const prevLog = i > 0 ? sortedLogs[i - 1] : null;

      const previousRh = Number(log.previousRH) || 0;
      const newRh = Number(log.newRH) || 0;
      const delta = newRh - previousRh;
      const meterReplaced = log.meterReplaced === true;

      // Calculate days between readings (for avg daily hours)
      let daysBetween = 1;
      let avgDailyHours = 0;
      if (prevLog?.enteredAtUTC && log.enteredAtUTC) {
        const prevTime = new Date(prevLog.enteredAtUTC).getTime();
        const currTime = new Date(log.enteredAtUTC).getTime();
        daysBetween = Math.max(1, (currTime - prevTime) / (1000 * 60 * 60 * 24));
        avgDailyHours = delta / daysBetween;
      } else if (log.enteredAtUTC) {
        // First reading - estimate from delta
        avgDailyHours = delta > 0 ? Math.min(delta, 24) : 0;
      }

      // Get component info
      const component = componentMap.get(log.componentId || '') || componentCodeMap.get(log.componentCode || '');
      const componentName = log.componentName || component?.name || component?.fleetEquipmentName || log.componentCode || 'Unknown';

      let anomalyDetected = false;
      let anomalyTypeValue = '';
      let severity: 'Critical' | 'Warning' | 'Info' = 'Info';
      let description = '';

      // RULE 1: HIGH INCREMENT - avgDailyHours > 24 (physically impossible)
      if (avgDailyHours > 24 && !meterReplaced) {
        anomalyDetected = true;
        anomalyTypeValue = 'High Increment';
        severity = 'Critical';
        description = `Impossible: ${avgDailyHours.toFixed(1)} hrs/day (max 24). Delta: ${delta.toFixed(0)} hrs over ${daysBetween.toFixed(1)} days.`;
      }
      // RULE 2: NEGATIVE - delta < 0 without meter replacement
      else if (delta < 0 && !meterReplaced) {
        anomalyDetected = true;
        anomalyTypeValue = 'Negative Delta';
        severity = 'Critical';
        description = `RH decreased by ${Math.abs(delta).toFixed(1)} hrs without meter replacement. Possible data entry error or stuck meter.`;
      }
      // RULE 3: ZERO - delta = 0 AND daysBetween > 7 (stuck meter)
      else if (delta === 0 && daysBetween > 7 && previousRh > 0) {
        anomalyDetected = true;
        anomalyTypeValue = 'Zero Change';
        severity = 'Warning';
        description = `No RH change for ${daysBetween.toFixed(0)} days on equipment with ${previousRh.toFixed(0)} hrs. Possible stuck meter.`;
      }
      // RULE 4: IRREGULAR - Sudden spike compared to component's historical average
      else if (avgDelta > 0 && delta > avgDelta * 3 && delta > 50) {
        anomalyDetected = true;
        anomalyTypeValue = 'Irregular Pattern';
        severity = 'Warning';
        description = `Spike: ${delta.toFixed(0)} hrs is 3x above avg (${avgDelta.toFixed(1)} hrs). May indicate catch-up entry or data issue.`;
      }
      // RULE 5: Meter replacement flagged - Info only
      else if (meterReplaced) {
        anomalyDetected = true;
        anomalyTypeValue = 'Meter Replaced';
        severity = 'Info';
        const oldMeter = log.oldMeterFinal ? Number(log.oldMeterFinal).toFixed(0) : 'N/A';
        const newMeter = log.newMeterStart ? Number(log.newMeterStart).toFixed(0) : '0';
        description = `Meter replaced. Old final: ${oldMeter} hrs, New start: ${newMeter} hrs.`;
      }

      // Apply filters
      if (anomalyDetected) {
        const passesTypeFilter = !anomalyType || anomalyType === 'All' || anomalyType === anomalyTypeValue;
        const passesSeverityFilter = !severityFilter || severityFilter === 'All' || severityFilter === severity;

        if (passesTypeFilter && passesSeverityFilter) {
          sNo++;
          anomalies.push({
            sNo,
            componentCode: log.componentCode || component?.componentCode || '-',
            componentName,
            category: component?.componentCategory || component?.category || '-',
            department: component?.department || component?.eqptSystemDept || '-',
            previousRh: Math.round(previousRh * 100) / 100,
            newRh: Math.round(newRh * 100) / 100,
            delta: Math.round(delta * 100) / 100,
            daysBetween: Math.round(daysBetween * 10) / 10,
            avgDailyHours: Math.round(avgDailyHours * 100) / 100,
            anomalyType: anomalyTypeValue,
            severity,
            description,
            meterReplaced,
            updatedBy: log.userId || '-',
            updatedAt: log.enteredAtUTC,
            source: log.source || '-',
            notes: log.notes || '-'
          });
        }
      }
    }
  }

  // Sort by severity (Critical first), then by avgDailyHours descending
  anomalies.sort((a, b) => {
    const severityOrder = { 'Critical': 0, 'Warning': 1, 'Info': 2 };
    if (severityOrder[a.severity as keyof typeof severityOrder] !== severityOrder[b.severity as keyof typeof severityOrder]) {
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    }
    return Math.abs(b.avgDailyHours) - Math.abs(a.avgDailyHours);
  });

  // Re-number after sorting
  anomalies.forEach((item, idx) => { item.sNo = idx + 1; });

  // Calculate summary
  const summary = {
    totalAnomalies: anomalies.length,
    criticalCount: anomalies.filter(a => a.severity === 'Critical').length,
    warningCount: anomalies.filter(a => a.severity === 'Warning').length,
    infoCount: anomalies.filter(a => a.severity === 'Info').length,
    byType: {
      highIncrement: anomalies.filter(a => a.anomalyType === 'High Increment').length,
      negativeDelta: anomalies.filter(a => a.anomalyType === 'Negative Delta').length,
      zeroChange: anomalies.filter(a => a.anomalyType === 'Zero Change').length,
      irregularPattern: anomalies.filter(a => a.anomalyType === 'Irregular Pattern').length,
      meterReplaced: anomalies.filter(a => a.anomalyType === 'Meter Replaced').length
    },
    periodStart: periodStart.toISOString().split('T')[0],
    periodEnd: periodEnd.toISOString().split('T')[0],
    totalLogsAnalyzed: logsInPeriod.length,
    componentsAnalyzed: componentLogs.size
  };

  return {
    success: true,
    vesselId,
    vesselName,
    reportDate: new Date().toISOString(),
    period: {
      startDate: periodStart.toISOString().split('T')[0],
      endDate: periodEnd.toISOString().split('T')[0]
    },
    summary,
    data: anomalies,
    totalRecords: anomalies.length
  };
}

// ═══════════════════════════════════════════════════════════════
// RUNNING HOURS ANOMALY DETECTION - EXCEL EXPORT (POST)
// ═══════════════════════════════════════════════════════════════

export async function exportRunningHoursAnomalyDetectionExcel(
  vesselId: string,
  startDate?: string,
  endDate?: string,
  anomalyType?: string,
  severityFilter?: string,
): Promise<{ buffer: Buffer; filename: string }> {
  // Get vessel name
  const vessels = await repo.getVessels();
  const vessel = vessels.find(v => v.id === vesselId || (v as any).vesselCode === vesselId);
  const vesselName = vessel?.name || (vessel as any)?.vesselName || String(vesselId);

  // Get database instance
  const db = await getDb();

  // Query running_hours_audit table (has actual data)
  const allAuditLogs = await db.select().from(runningHoursAudit)
    .where(sql`${runningHoursAudit.vesselId} = ${vesselId}`);

  const now = new Date();
  const defaultStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const periodStart = startDate ? parseDateVal(startDate) : defaultStartDate;
  const periodEnd = endDate ? parseDateVal(endDate) : now;

  if (!periodStart || !periodEnd) {
    throw new Error("Invalid date format");
  }

  // Filter logs within the date range - handle both Date objects and strings from Drizzle
  const logsInPeriod = allAuditLogs.filter(log => {
    if (!log.enteredAtUTC) return false;
    const logDate = log.enteredAtUTC instanceof Date ? log.enteredAtUTC : new Date(log.enteredAtUTC);
    return logDate >= periodStart && logDate <= periodEnd;
  });

  // Group logs by component
  const componentLogs = new Map<string, typeof logsInPeriod>();
  for (const log of logsInPeriod) {
    const key = log.componentId || log.componentCode || 'unknown';
    if (!componentLogs.has(key)) {
      componentLogs.set(key, []);
    }
    componentLogs.get(key)!.push(log);
  }

  // Get components for reference
  const allComponents = await repo.getComponents(vesselId);
  const componentMap = new Map(allComponents.map(c => [c.cuuid, c]));
  const componentCodeMap = new Map(allComponents.map(c => [c.componentCode, c]));

  // Detect anomalies (same logic as GET endpoint)
  const anomalies: any[] = [];

  for (const [componentKey, logs] of Array.from(componentLogs.entries())) {
    const sortedLogs = logs.sort((a: any, b: any) =>
      new Date(a.enteredAtUTC!).getTime() - new Date(b.enteredAtUTC!).getTime()
    );

    const deltas = sortedLogs.map((log: any) => {
      const prev = Number(log.previousRH) || 0;
      const curr = Number(log.newRH) || 0;
      return curr - prev;
    }).filter((d: number) => d > 0);
    const avgDelta = deltas.length > 0 ? deltas.reduce((a: number, b: number) => a + b, 0) / deltas.length : 0;

    for (let i = 0; i < sortedLogs.length; i++) {
      const log = sortedLogs[i];
      const prevLog = i > 0 ? sortedLogs[i - 1] : null;

      const previousRh = Number(log.previousRH) || 0;
      const newRh = Number(log.newRH) || 0;
      const delta = newRh - previousRh;
      const meterReplaced = log.meterReplaced === true;

      let daysBetween = 1;
      let avgDailyHours = 0;
      if (prevLog?.enteredAtUTC && log.enteredAtUTC) {
        const prevTime = new Date(prevLog.enteredAtUTC).getTime();
        const currTime = new Date(log.enteredAtUTC).getTime();
        daysBetween = Math.max(1, (currTime - prevTime) / (1000 * 60 * 60 * 24));
        avgDailyHours = delta / daysBetween;
      } else if (log.enteredAtUTC) {
        avgDailyHours = delta > 0 ? Math.min(delta, 24) : 0;
      }

      const component = componentMap.get(log.componentId || '') || componentCodeMap.get(log.componentCode || '');
      const componentName = log.componentName || component?.name || component?.fleetEquipmentName || log.componentCode || 'Unknown';

      let anomalyDetected = false;
      let anomalyTypeValue = '';
      let severity: 'Critical' | 'Warning' | 'Info' = 'Info';
      let description = '';

      if (avgDailyHours > 24 && !meterReplaced) {
        anomalyDetected = true;
        anomalyTypeValue = 'High Increment';
        severity = 'Critical';
        description = `Impossible: ${avgDailyHours.toFixed(1)} hrs/day. Delta: ${delta.toFixed(0)} hrs over ${daysBetween.toFixed(1)} days.`;
      } else if (delta < 0 && !meterReplaced) {
        anomalyDetected = true;
        anomalyTypeValue = 'Negative Delta';
        severity = 'Critical';
        description = `RH decreased by ${Math.abs(delta).toFixed(1)} hrs without meter replacement.`;
      } else if (delta === 0 && daysBetween > 7 && previousRh > 0) {
        anomalyDetected = true;
        anomalyTypeValue = 'Zero Change';
        severity = 'Warning';
        description = `No RH change for ${daysBetween.toFixed(0)} days. Possible stuck meter.`;
      } else if (avgDelta > 0 && delta > avgDelta * 3 && delta > 50) {
        anomalyDetected = true;
        anomalyTypeValue = 'Irregular Pattern';
        severity = 'Warning';
        description = `Spike: ${delta.toFixed(0)} hrs is 3x above avg (${avgDelta.toFixed(1)} hrs).`;
      } else if (meterReplaced) {
        anomalyDetected = true;
        anomalyTypeValue = 'Meter Replaced';
        severity = 'Info';
        description = `Meter replaced. Old: ${log.oldMeterFinal || 'N/A'}, New: ${log.newMeterStart || '0'}`;
      }

      if (anomalyDetected) {
        const passesTypeFilter = !anomalyType || anomalyType === 'All' || anomalyType === anomalyTypeValue;
        const passesSeverityFilter = !severityFilter || severityFilter === 'All' || severityFilter === severity;

        if (passesTypeFilter && passesSeverityFilter) {
          anomalies.push({
            componentCode: log.componentCode || component?.componentCode || '-',
            componentName,
            category: component?.componentCategory || component?.category || '-',
            department: component?.department || component?.eqptSystemDept || '-',
            previousRh: Math.round(previousRh * 100) / 100,
            newRh: Math.round(newRh * 100) / 100,
            delta: Math.round(delta * 100) / 100,
            daysBetween: Math.round(daysBetween * 10) / 10,
            avgDailyHours: Math.round(avgDailyHours * 100) / 100,
            anomalyType: anomalyTypeValue,
            severity,
            description,
            meterReplaced,
            updatedBy: log.userId || '-',
            updatedAt: log.enteredAtUTC,
            source: log.source || '-'
          });
        }
      }
    }
  }

  // Sort by severity
  anomalies.sort((a, b) => {
    const severityOrder = { 'Critical': 0, 'Warning': 1, 'Info': 2 };
    if (severityOrder[a.severity as keyof typeof severityOrder] !== severityOrder[b.severity as keyof typeof severityOrder]) {
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    }
    return Math.abs(b.avgDailyHours) - Math.abs(a.avgDailyHours);
  });

  // Create workbook - use static import at top of file
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('RH Anomaly Detection');

  // Define columns with enhanced data
  const columns = [
    { header: 'S.No', key: 'sNo', width: 6 },
    { header: 'Component Code', key: 'componentCode', width: 15 },
    { header: 'Component Name', key: 'componentName', width: 30 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Department', key: 'department', width: 12 },
    { header: 'Previous RH', key: 'previousRh', width: 12 },
    { header: 'New RH', key: 'newRh', width: 12 },
    { header: 'Delta', key: 'delta', width: 10 },
    { header: 'Days Between', key: 'daysBetween', width: 12 },
    { header: 'Avg Daily Hrs', key: 'avgDailyHours', width: 12 },
    { header: 'Anomaly Type', key: 'anomalyType', width: 15 },
    { header: 'Severity', key: 'severity', width: 10 },
    { header: 'Description', key: 'description', width: 45 },
    { header: 'Updated By', key: 'updatedBy', width: 15 },
    { header: 'Date', key: 'updatedAt', width: 12 },
    { header: 'Source', key: 'source', width: 12 }
  ];

  worksheet.columns = columns;
  const lastColLetter = getLastColumnLetter(columns.length);

  // Apply header
  const reportTitle = 'Running Hours Anomaly Detection Report';
  const criticalCount = anomalies.filter(a => a.severity === 'Critical').length;
  const warningCount = anomalies.filter(a => a.severity === 'Warning').length;
  const infoCount = anomalies.filter(a => a.severity === 'Info').length;
  const subtitle = `Critical: ${criticalCount} | Warning: ${warningCount} | Info: ${infoCount} | Period: ${formatDateDisplay(periodStart)} to ${formatDateDisplay(periodEnd)}`;
  const periodDisplay = `${formatDateDisplay(periodStart)} to ${formatDateDisplay(periodEnd)}`;
  applyStandardHeader(worksheet, reportTitle, subtitle, vesselName, anomalies.length, lastColLetter, periodDisplay);

  // Apply table header
  applyStandardTableHeader(worksheet, columns, 7);

  // Prepare report data
  const reportData = anomalies.map((a, idx) => ({
    sNo: idx + 1,
    componentCode: a.componentCode,
    componentName: a.componentName,
    category: a.category,
    department: a.department,
    previousRh: a.previousRh.toFixed(1),
    newRh: a.newRh.toFixed(1),
    delta: a.delta.toFixed(1),
    daysBetween: a.daysBetween.toFixed(1),
    avgDailyHours: a.avgDailyHours.toFixed(2),
    anomalyType: a.anomalyType,
    severity: a.severity,
    description: a.description,
    updatedBy: a.updatedBy,
    updatedAt: formatDateDisplay(a.updatedAt),
    source: a.source
  }));

  // Apply data rows
  applyStandardDataRows(worksheet, reportData, columns, 8);

  // Apply severity-based coloring
  for (let i = 0; i < reportData.length; i++) {
    const rowNum = 8 + i;
    const severity = anomalies[i].severity;
    const severityCell = worksheet.getCell(rowNum, 12); // Column L = Severity

    if (severity === 'Critical') {
      for (let col = 1; col <= columns.length; col++) {
        worksheet.getCell(rowNum, col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFECACA' }
        };
      }
      severityCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    } else if (severity === 'Warning') {
      for (let col = 1; col <= columns.length; col++) {
        worksheet.getCell(rowNum, col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' }
        };
      }
      severityCell.font = { color: { argb: 'FFD97706' }, bold: true };
    } else {
      for (let col = 1; col <= columns.length; col++) {
        worksheet.getCell(rowNum, col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' }
        };
      }
      severityCell.font = { color: { argb: 'FF2563EB' }, bold: true };
    }
  }

  // Add summary row
  const summaryRow = 8 + reportData.length + 1;
  worksheet.mergeCells(`A${summaryRow}:${lastColLetter}${summaryRow}`);
  worksheet.getCell(`A${summaryRow}`).value =
    `Summary: ${anomalies.length} anomalies detected | Critical: ${criticalCount} | Warning: ${warningCount} | Info: ${infoCount} | Components analyzed: ${componentLogs.size} | Logs analyzed: ${logsInPeriod.length}`;
  worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 10 };
  worksheet.getCell(`A${summaryRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' }
  };

  // Apply page setup
  applyStandardPageSetup(worksheet, 7, columns.length, summaryRow, vesselName);
  worksheet.pageSetup.orientation = 'landscape';

  // Generate buffer and send
  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `RH_Anomaly_Detection_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;

  console.log(`[RH ANOMALY EXCEL] Generated: ${filename}, Anomalies: ${anomalies.length}`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// IHM INVENTORY STATUS - PREVIEW (GET)
// ═══════════════════════════════════════════════════════════════

export async function getIhmInventoryStatus(
  vesselId: string | undefined,
  ihmStatusFilter: string = 'all',
  itemTypeFilter: string = 'all',
  searchQuery: string = '',
  sortBy: string = 'itemCode',
  sortOrder: string = 'asc',
  page: number = 1,
  pageSize: number = 50,
  vesselIds?: string[],
) {
  const normalizeSpareIhm = (ihm: string | null | undefined, ihmPresence: string | null | undefined): string => {
    if (ihmPresence) {
      const p = ihmPresence.toUpperCase();
      if (p === 'YES') return 'present';
      if (p === 'NO') return 'not_present';
      if (p === 'UNKNOWN') return 'unknown';
    }
    if (ihm) {
      const v = ihm.toLowerCase().trim();
      if (v === 'yes' || v === 'present' || v === 'true') return 'present';
      if (v === 'no' || v === 'not present' || v === 'false') return 'not_present';
    }
    return 'unknown';
  };

  const normalizeStoreIhm = (ihmPresence: string | null | undefined, ihm: boolean | null | undefined): string => {
    if (ihmPresence) {
      const p = ihmPresence.toLowerCase().trim();
      if (p === 'present') return 'present';
      if (p === 'not present') return 'not_present';
      if (p === 'unknown') return 'unknown';
    }
    if (ihm === true) return 'present';
    if (ihm === false) return 'not_present';
    return 'unknown';
  };

  let sparesData: any[] = [];
  let storesData: any[] = [];
  if (vesselId && vesselId !== 'all') {
    sparesData = await repo.getSpares(vesselId);
    storesData = await repo.getStoresItems(vesselId);
  } else {
    const allVessels = await repo.getVessels();
    const vessels = vesselIds?.length ? allVessels.filter(v => vesselIds.includes(v.id)) : allVessels;
    for (const vessel of vessels) {
      const vSpares = await repo.getSpares(vessel.id);
      sparesData.push(...vSpares);
      const vStores = await repo.getStoresItems(vessel.id);
      storesData.push(...vStores);
    }
  }

  interface IhmItem {
    id: number;
    itemCode: string;
    itemName: string;
    itemType: 'spare' | 'store';
    storeCategory: string;
    componentOrCategory: string;
    ihmStatus: string;
    evidenceType: string;
    hazardClassification: string;
    sdsReference: string;
    currentROB: number;
    uom: string;
    location: string;
    partNumber: string;
    lastUpdated: string;
  }

  let combinedItems: IhmItem[] = [];

  for (const s of sparesData) {
    if (s.deleted || s.dataScope === 'fleet') continue;
    const ihmStatus = normalizeSpareIhm(s.ihm, s.ihmPresence);
    if (ihmStatus !== 'present') continue;
    combinedItems.push({
      id: s.id,
      itemCode: s.partCode || s.componentSpareCode || '',
      itemName: s.partName || '',
      itemType: 'spare',
      storeCategory: '',
      componentOrCategory: s.componentName || '',
      ihmStatus,
      evidenceType: s.evidenceType || 'None',
      hazardClassification: '',
      sdsReference: '',
      currentROB: s.rob ?? 0,
      uom: s.uom || s.unit || 'PCS',
      location: [s.location, s.location2].filter(Boolean).join(' / ') || '-',
      partNumber: s.partNumber || '',
      lastUpdated: s.updatedAt ? new Date(s.updatedAt).toISOString() : '',
    });
  }

  for (const st of storesData) {
    if (st.deleted || st.isActive === false) continue;
    const ihmStatus = normalizeStoreIhm(st.ihmPresence, st.ihm);
    if (ihmStatus !== 'present') continue;
    combinedItems.push({
      id: st.id + 1000000,
      itemCode: st.itemCode || '',
      itemName: st.itemName || '',
      itemType: 'store',
      storeCategory: st.itemType || 'stores',
      componentOrCategory: st.category || st.itemType || '',
      ihmStatus,
      evidenceType: st.ihmEvidenceType || 'None',
      hazardClassification: st.hazardClassification || '',
      sdsReference: st.sdsReference || '',
      currentROB: parseFloat(String(st.rob)) || 0,
      uom: st.uom || 'PCS',
      location: [st.locationA, st.locationB].filter(Boolean).join(' / ') || '-',
      partNumber: '',
      lastUpdated: st.updatedAt ? new Date(st.updatedAt).toISOString() : '',
    });
  }

  const totalAll = combinedItems.length;
  const totalSpares = combinedItems.filter(i => i.itemType === 'spare').length;
  const totalStores = combinedItems.filter(i => i.itemType === 'store').length;

  const summaryPresent = combinedItems.length;
  const summaryNotPresent = 0;
  const summaryUnknown = 0;

  if (itemTypeFilter && itemTypeFilter !== 'all') {
    if (itemTypeFilter === 'spare') {
      combinedItems = combinedItems.filter(i => i.itemType === 'spare');
    } else if (itemTypeFilter === 'store') {
      combinedItems = combinedItems.filter(i => i.itemType === 'store');
    } else if (['stores', 'lubricants', 'lubes', 'chemicals', 'others'].includes(itemTypeFilter)) {
      combinedItems = combinedItems.filter(i => {
        if (i.itemType !== 'store') return false;
        if (itemTypeFilter === 'lubes' || itemTypeFilter === 'lubricants') {
          return i.storeCategory === 'lubes' || i.storeCategory === 'lubricants';
        }
        return i.storeCategory === itemTypeFilter;
      });
    }
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    combinedItems = combinedItems.filter(i =>
      i.itemCode.toLowerCase().includes(q) ||
      i.itemName.toLowerCase().includes(q) ||
      i.componentOrCategory.toLowerCase().includes(q) ||
      i.partNumber.toLowerCase().includes(q) ||
      i.location.toLowerCase().includes(q)
    );
  }

  const statusOrder: Record<string, number> = { present: 0, unknown: 1, not_present: 2 };

  combinedItems.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'itemCode': cmp = a.itemCode.localeCompare(b.itemCode); break;
      case 'itemName': cmp = a.itemName.localeCompare(b.itemName); break;
      case 'itemType': cmp = a.itemType.localeCompare(b.itemType); break;
      case 'componentOrCategory': cmp = a.componentOrCategory.localeCompare(b.componentOrCategory); break;
      case 'ihmStatus': cmp = (statusOrder[a.ihmStatus] ?? 3) - (statusOrder[b.ihmStatus] ?? 3); break;
      case 'evidenceType': cmp = a.evidenceType.localeCompare(b.evidenceType); break;
      case 'currentROB': cmp = a.currentROB - b.currentROB; break;
      case 'location': cmp = a.location.localeCompare(b.location); break;
      default: cmp = a.itemCode.localeCompare(b.itemCode);
    }
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  const totalFiltered = combinedItems.length;
  const totalPages = Math.ceil(totalFiltered / pageSize);
  const startIdx = (page - 1) * pageSize;
  const paginatedItems = combinedItems.slice(startIdx, startIdx + pageSize);

  return {
    summary: {
      totalItems: totalAll,
      ihmPresent: summaryPresent,
      noIhm: summaryNotPresent,
      unknown: summaryUnknown,
    },
    items: paginatedItems,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: totalFiltered,
      pageSize,
    },
    categoryCounts: {
      all: totalAll,
      spares: totalSpares,
      stores: totalStores,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// IHM INVENTORY STATUS - EXCEL EXPORT (POST)
// ═══════════════════════════════════════════════════════════════

export async function exportIhmInventoryStatusExcel(
  vesselId: string,
  ihmStatus?: string,
  itemType?: string,
  search?: string,
  componentFilter?: string,
  vesselIds?: string[],
): Promise<{ buffer: Buffer; filename: string }> {
  const vessels = await repo.getVessels();
  const vessel = vessels.find(v => v.id === vesselId || (v as any).vesselCode === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || (vessel as any)?.vesselName || String(vesselId));

  let sparesData: any[] = [];
  let storesData: any[] = [];
  if (vesselId === 'all') {
    const scopedVessels = vesselIds?.length ? vessels.filter(v => vesselIds.includes(v.id)) : vessels;
    for (const v of scopedVessels) {
      const vSpares = await repo.getSpares(v.id);
      sparesData.push(...vSpares);
      const vStores = await repo.getStoresItems(v.id);
      storesData.push(...vStores);
    }
  } else {
    sparesData = await repo.getSpares(vesselId);
    storesData = await repo.getStoresItems(vesselId);
  }

  const normalizeSpareIhm = (ihm: string | null | undefined, ihmPresence: string | null | undefined): string => {
    if (ihmPresence) {
      const p = ihmPresence.toUpperCase();
      if (p === 'YES') return 'Present';
      if (p === 'NO') return 'Not Present';
    }
    if (ihm) {
      const v = ihm.toLowerCase().trim();
      if (v === 'yes' || v === 'present' || v === 'true') return 'Present';
      if (v === 'no' || v === 'not present' || v === 'false') return 'Not Present';
    }
    return 'Unknown';
  };

  const normalizeStoreIhm = (ihmPresence: string | null | undefined, ihm: boolean | null | undefined): string => {
    if (ihmPresence) {
      const p = ihmPresence.toLowerCase().trim();
      if (p === 'present') return 'Present';
      if (p === 'not present') return 'Not Present';
    }
    if (ihm === true) return 'Present';
    if (ihm === false) return 'Not Present';
    return 'Unknown';
  };

  let allItems: any[] = [];

  for (const s of sparesData) {
    if (s.deleted || s.dataScope === 'fleet') continue;
    const status = normalizeSpareIhm(s.ihm, s.ihmPresence);
    if (status !== 'Present') continue;
    allItems.push({
      itemCode: s.partCode || s.componentSpareCode || '-',
      itemName: s.partName || '-',
      itemType: 'Spare',
      componentOrCategory: s.componentName || '-',
      ihmStatus: status,
      evidenceType: s.evidenceType || 'None',
      hazardClassification: '-',
      sdsReference: '-',
      currentROB: s.rob ?? 0,
      uom: s.uom || s.unit || 'PCS',
      location: [s.location, s.location2].filter(Boolean).join(' / ') || '-',
      partNumber: s.partNumber || '-',
    });
  }

  for (const st of storesData) {
    if (st.deleted || st.isActive === false) continue;
    const status = normalizeStoreIhm(st.ihmPresence, st.ihm);
    if (status !== 'Present') continue;
    allItems.push({
      itemCode: st.itemCode || '-',
      itemName: st.itemName || '-',
      itemType: st.itemType ? st.itemType.charAt(0).toUpperCase() + st.itemType.slice(1) : 'Store',
      componentOrCategory: st.category || st.itemType || '-',
      ihmStatus: status,
      evidenceType: st.ihmEvidenceType || 'None',
      hazardClassification: st.hazardClassification || '-',
      sdsReference: st.sdsReference || '-',
      currentROB: parseFloat(String(st.rob)) || 0,
      uom: st.uom || 'PCS',
      location: [st.locationA, st.locationB].filter(Boolean).join(' / ') || '-',
      partNumber: '-',
    });
  }

  if (ihmStatus && ihmStatus !== 'all') {
    const statusMap: Record<string, string> = { present: 'Present', not_present: 'Not Present', unknown: 'Unknown' };
    const target = statusMap[ihmStatus] || ihmStatus;
    allItems = allItems.filter(i => i.ihmStatus === target);
  }

  if (itemType && itemType !== 'all') {
    if (itemType === 'spare') {
      allItems = allItems.filter(i => i.itemType === 'Spare');
    } else if (itemType === 'store') {
      allItems = allItems.filter(i => i.itemType !== 'Spare');
    }
  }

  if (search && search.trim()) {
    const q = search.toLowerCase();
    allItems = allItems.filter(i =>
      i.itemCode.toLowerCase().includes(q) ||
      i.itemName.toLowerCase().includes(q) ||
      i.componentOrCategory.toLowerCase().includes(q)
    );
  }

  if (componentFilter && componentFilter.trim()) {
    const cf = componentFilter.toLowerCase();
    allItems = allItems.filter(i =>
      (i.itemName || '').toLowerCase().includes(cf) ||
      (i.itemCode || '').toLowerCase().includes(cf) ||
      (i.componentOrCategory || '').toLowerCase().includes(cf)
    );
  }

  const statusOrder: Record<string, number> = { 'Present': 0, 'Unknown': 1, 'Not Present': 2 };
  allItems.sort((a, b) => (statusOrder[a.ihmStatus] ?? 3) - (statusOrder[b.ihmStatus] ?? 3));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('IHM Inventory Status');

  const columns: ColumnDef[] = [
    { header: 'S.No', key: 'sNo', width: 8 },
    { header: 'Item Code', key: 'itemCode', width: 18 },
    { header: 'Item Name', key: 'itemName', width: 35 },
    { header: 'Item Type', key: 'itemType', width: 14 },
    { header: 'Component / Category', key: 'componentOrCategory', width: 28 },
    { header: 'IHM Status', key: 'ihmStatus', width: 16 },
    { header: 'Evidence Type', key: 'evidenceType', width: 16 },
    { header: 'Hazard Classification', key: 'hazardClassification', width: 20 },
    { header: 'SDS Reference', key: 'sdsReference', width: 18 },
    { header: 'Current ROB', key: 'currentROB', width: 14 },
    { header: 'UOM', key: 'uom', width: 10 },
    { header: 'Location', key: 'location', width: 22 },
    { header: 'Part Number', key: 'partNumber', width: 18 },
  ];

  const totalPresent = allItems.filter(i => i.ihmStatus === 'Present').length;
  const totalNotPresent = allItems.filter(i => i.ihmStatus === 'Not Present').length;
  const totalUnknown = allItems.filter(i => i.ihmStatus === 'Unknown').length;
  const compliancePct = allItems.length > 0 ? Math.round(((totalPresent + totalNotPresent) / allItems.length) * 100) : 100;

  const lastCol = String.fromCharCode(64 + columns.length);
  applyStandardHeader(
    worksheet,
    'IHM Inventory Status Report',
    `IHM Present: ${totalPresent} | No IHM: ${totalNotPresent} | Unknown: ${totalUnknown} | Compliance: ${compliancePct}%`,
    vesselName,
    allItems.length,
    lastCol
  );

  applyStandardTableHeader(worksheet, columns, 7);

  const reportData = allItems.map((item, idx) => ({
    sNo: idx + 1,
    itemCode: item.itemCode,
    itemName: item.itemName,
    itemType: item.itemType,
    componentOrCategory: item.componentOrCategory,
    ihmStatus: item.ihmStatus,
    evidenceType: item.evidenceType,
    hazardClassification: item.hazardClassification,
    sdsReference: item.sdsReference,
    currentROB: item.currentROB,
    uom: item.uom,
    location: item.location,
    partNumber: item.partNumber,
  }));

  const conditionalStyles: ConditionalStyle[] = [
    { condition: (row: any) => row.ihmStatus === 'Present', style: 'danger' as const },
    { condition: (row: any) => row.ihmStatus === 'Unknown', style: 'warning' as const },
    { condition: (row: any) => row.ihmStatus === 'Not Present', style: 'success' as const },
  ];

  applyStandardDataRows(worksheet, reportData, columns, 8, conditionalStyles);

  const lastColLetter = getLastColumnLetter(columns.length);
  const summaryRow = 8 + reportData.length + 1;
  worksheet.mergeCells(`A${summaryRow}:${lastColLetter}${summaryRow}`);
  worksheet.getCell(`A${summaryRow}`).value =
    `Summary: ${allItems.length} items | IHM Present: ${totalPresent} | No IHM: ${totalNotPresent} | Unknown: ${totalUnknown} | Documentation Compliance: ${compliancePct}%`;
  worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 10 };
  worksheet.getCell(`A${summaryRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' }
  };

  applyStandardPageSetup(worksheet, 7, columns.length, summaryRow, vesselName);
  worksheet.pageSetup.orientation = 'landscape';

  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `IHM_Inventory_Status_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}
