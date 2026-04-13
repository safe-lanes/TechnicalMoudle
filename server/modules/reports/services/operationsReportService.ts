import ExcelJS from 'exceljs';
import { sql } from 'drizzle-orm';
import * as repo from '../repositories/reportRepository';
import { getDb } from '../../../db';
import { componentRunningHoursLog } from '@shared/schema';
import {
  applyStandardHeader, applyStandardTableHeader,
  applyStandardDataRows, applyStandardPageSetup,
  getLastColumnLetter,
  type ColumnDef
} from '../../../lib/excelReportStyles';

// ═══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

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
// CREW WORKLOAD DISTRIBUTION - PREVIEW (GET)
// ═══════════════════════════════════════════════════════════════

export async function getCrewWorkloadDistribution(
  vesselId: string,
  startDate?: string,
  endDate?: string,
  rank?: string,
  department?: string,
  viewType?: string,
) {
  const allVessels = await repo.getVessels();
  const vessel = allVessels.find(v => v.id === vesselId);
  const vesselName = vessel?.name || String(vesselId);

  const workOrders = await repo.getWorkOrders(String(vesselId));
  const components = await repo.getComponents(String(vesselId));
  const componentsMap = new Map(components.map(c => [c.cuuid, c]));

  const startDateObj = startDate ? new Date(String(startDate)) : null;
  const endDateObj = endDate ? new Date(String(endDate)) : null;
  if (startDateObj) startDateObj.setHours(0, 0, 0, 0);
  if (endDateObj) endDateObj.setHours(23, 59, 59, 999);

  // Filter work orders
  let filteredWOs = workOrders.filter((wo: any) => {
    // Date range filter using createdAt
    if (startDateObj || endDateObj) {
      const createdDate = parseDate(wo.createdAt);
      if (createdDate) {
        if (startDateObj && createdDate < startDateObj) return false;
        if (endDateObj && createdDate > endDateObj) return false;
      }
    }

    // Rank filter
    if (rank && rank !== 'All Ranks' && rank !== 'all') {
      if (wo.assignedTo !== rank && wo.performedBy !== rank) return false;
    }

    // Department filter
    if (department && department !== 'All' && department !== 'all') {
      if (wo.department !== department) return false;
    }

    return true;
  });

  if (viewType === 'detailed') {
    // Detailed view - job-level details
    const detailedData = filteredWOs.map((wo: any) => {
      const comp = componentsMap.get(wo.componentId);
      const isCritical = wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true;
      const isClassRelated = wo.classRelated === 'Yes' || (comp as any)?.classRelated === 'Yes';

      return {
        id: wo.id,
        workOrderNo: wo.workOrderNo || wo.id,
        jobTitle: wo.jobTitle || '-',
        componentName: wo.component || comp?.name || '-',
        componentCode: wo.componentCode || comp?.componentCode || '-',
        assignedTo: wo.assignedTo || 'Unassigned',
        performedBy: wo.performedBy || '-',
        department: wo.department || '-',
        jobPriority: wo.jobPriority || 'Normal',
        status: wo.status || '-',
        taskType: wo.taskType || wo.workOrderType || '-',
        dueDate: wo.dueDate || null,
        completionDate: wo.dateCompleted || wo.completionDateTime || null,
        teamSize: wo.noOfPersonsInTeam ? Number(wo.noOfPersonsInTeam) : null,
        timeTakenHours: wo.totalTimeHours ? Number(wo.totalTimeHours) : null,
        manhours: wo.manhours ? Number(wo.manhours) : null,
        critical: isCritical,
        classRelated: isClassRelated
      };
    });

    return {
      success: true,
      data: detailedData,
      view: 'detailed',
      vesselName,
      totalRecords: detailedData.length
    };

  } else {
    // Summary view - aggregated by rank (assignedTo only)
    const rankStats: Record<string, {
      rank: string;
      departments: Set<string>;
      totalJobsAssigned: number;
      jobsCompleted: number;
      jobsPending: number;
      jobsOverdue: number;
      criticalJobs: number;
      highPriorityJobs: number;
      totalManhours: number;
      totalTimeTaken: number;
      jobsWithTime: number;
    }> = {};

    const now = new Date();

    filteredWOs.forEach((wo: any) => {
      const assignee = wo.assignedTo || 'Unassigned';
      const dept = wo.department || 'N/A';

      if (!rankStats[assignee]) {
        rankStats[assignee] = {
          rank: assignee,
          departments: new Set(),
          totalJobsAssigned: 0,
          jobsCompleted: 0,
          jobsPending: 0,
          jobsOverdue: 0,
          criticalJobs: 0,
          highPriorityJobs: 0,
          totalManhours: 0,
          totalTimeTaken: 0,
          jobsWithTime: 0
        };
      }

      rankStats[assignee].departments.add(dept);
      const stats = rankStats[assignee];
      stats.totalJobsAssigned++;

      if (wo.status === 'Completed') {
        stats.jobsCompleted++;
      } else if (wo.status === 'Overdue' || (wo.dueDate && parseDate(wo.dueDate)! < now && wo.status !== 'Completed')) {
        stats.jobsOverdue++;
      } else if (['Planned', 'Active', 'In Progress'].includes(wo.status)) {
        stats.jobsPending++;
      }

      if (wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true) {
        stats.criticalJobs++;
      }

      if (wo.jobPriority === 'High') {
        stats.highPriorityJobs++;
      }

      if (wo.manhours) {
        stats.totalManhours += Number(wo.manhours) || 0;
      }

      if (wo.totalTimeHours) {
        stats.totalTimeTaken += Number(wo.totalTimeHours) || 0;
        stats.jobsWithTime++;
      }
    });

    // Calculate totals for workload percentage
    const totalManhours = Object.values(rankStats).reduce((sum, s) => sum + s.totalManhours, 0);

    const summaryData = Object.values(rankStats).map(stats => ({
      rank: stats.rank,
      department: Array.from(stats.departments).join(', '),
      totalJobsAssigned: stats.totalJobsAssigned,
      jobsCompleted: stats.jobsCompleted,
      jobsPending: stats.jobsPending,
      jobsOverdue: stats.jobsOverdue,
      criticalJobs: stats.criticalJobs,
      highPriorityJobs: stats.highPriorityJobs,
      totalManhours: Math.round(stats.totalManhours * 100) / 100,
      avgTimePerJob: stats.jobsWithTime > 0
        ? Math.round((stats.totalTimeTaken / stats.jobsWithTime) * 100) / 100
        : 0,
      completionRate: stats.totalJobsAssigned > 0
        ? Math.round((stats.jobsCompleted / stats.totalJobsAssigned) * 100 * 100) / 100
        : 0,
      workloadPercentage: totalManhours > 0
        ? Math.round((stats.totalManhours / totalManhours) * 100 * 100) / 100
        : 0
    }));

    // Sort by total manhours descending
    summaryData.sort((a, b) => b.totalManhours - a.totalManhours);

    return {
      success: true,
      data: summaryData,
      view: 'summary',
      vesselName,
      totalRecords: summaryData.length,
      totalManhours: Math.round(totalManhours * 100) / 100
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// CREW WORKLOAD DISTRIBUTION - EXCEL EXPORT (POST)
// ═══════════════════════════════════════════════════════════════

export async function exportCrewWorkloadDistributionExcel(
  vesselId: string,
  startDate?: string,
  endDate?: string,
  rank?: string,
  department?: string,
  viewType: string = 'summary',
): Promise<{ buffer: Buffer; filename: string }> {
  const allVessels = await repo.getVessels();
  const vessel = allVessels.find(v => v.id === vesselId);
  const vesselName = vessel?.name || vesselId;

  const workOrders = await repo.getWorkOrders(vesselId);
  const components = await repo.getComponents(vesselId);
  const componentsMap = new Map(components.map(c => [c.cuuid, c]));

  const startDateObj = startDate ? new Date(startDate) : null;
  const endDateObj = endDate ? new Date(endDate) : null;
  if (startDateObj) startDateObj.setHours(0, 0, 0, 0);
  if (endDateObj) endDateObj.setHours(23, 59, 59, 999);

  // Filter work orders
  let filteredWOs = workOrders.filter((wo: any) => {
    if (startDateObj || endDateObj) {
      const createdDate = parseDate(wo.createdAt);
      if (createdDate) {
        if (startDateObj && createdDate < startDateObj) return false;
        if (endDateObj && createdDate > endDateObj) return false;
      }
    }

    if (rank && rank !== 'All Ranks' && rank !== 'all') {
      if (wo.assignedTo !== rank && wo.performedBy !== rank) return false;
    }

    if (department && department !== 'All' && department !== 'all') {
      if (wo.department !== department) return false;
    }

    return true;
  });

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const isDetailedView = viewType === 'detailed';
  const sheetName = isDetailedView ? 'Crew Workload Detailed' : 'Crew Workload Summary';
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 7, xSplit: 0 }]
  });

  const periodStr = startDate && endDate
    ? `${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}`
    : 'All Time';

  if (isDetailedView) {
    // Detailed view columns (18 columns - landscape)
    const columns: ColumnDef[] = [
      { key: 'sNo', header: 'S.No', width: 6, type: 'number', align: 'center' },
      { key: 'workOrderNo', header: 'Work Order No', width: 16, type: 'text' },
      { key: 'componentCode', header: 'Comp Code', width: 12, type: 'text' },
      { key: 'componentName', header: 'Component Name', width: 25, type: 'text' },
      { key: 'jobTitle', header: 'Job Title', width: 30, type: 'text' },
      { key: 'assignedTo', header: 'Assigned To', width: 15, type: 'text' },
      { key: 'performedBy', header: 'Performed By', width: 15, type: 'text' },
      { key: 'department', header: 'Dept', width: 10, type: 'text', align: 'center' },
      { key: 'taskType', header: 'Task Type', width: 12, type: 'text' },
      { key: 'teamSize', header: 'Team Size', width: 10, type: 'number', align: 'center' },
      { key: 'timeTakenHours', header: 'Time (hrs)', width: 10, type: 'number', align: 'right' },
      { key: 'manhours', header: 'Manhours', width: 10, type: 'number', align: 'right' },
      { key: 'status', header: 'Status', width: 12, type: 'text', align: 'center' },
      { key: 'dueDate', header: 'Due Date', width: 12, type: 'date', align: 'center' },
      { key: 'completionDate', header: 'Completion Date', width: 12, type: 'date', align: 'center' },
      { key: 'critical', header: 'Critical', width: 8, type: 'text', align: 'center' },
      { key: 'classRelated', header: 'Class Related', width: 10, type: 'text', align: 'center' }
    ];

    const lastColLetter = getLastColumnLetter(columns.length);

    // Apply header
    applyStandardHeader(
      worksheet,
      'CREW WORKLOAD DISTRIBUTION REPORT - DETAILED VIEW',
      `Analysis of task distribution across crew ranks (${periodStr})`,
      vesselName,
      filteredWOs.length,
      lastColLetter,
      periodStr
    );

    // Apply table header at row 7
    applyStandardTableHeader(worksheet, columns, 7);

    // Build data rows
    const reportData = filteredWOs.map((wo: any, index: number) => {
      const comp = componentsMap.get(wo.componentId);
      const isCritical = wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true;
      const isClassRelated = wo.classRelated === 'Yes' || (comp as any)?.classRelated === 'Yes';

      return {
        sNo: index + 1,
        workOrderNo: wo.workOrderNo || wo.id || '-',
        componentCode: wo.componentCode || comp?.componentCode || '-',
        componentName: wo.component || comp?.name || '-',
        jobTitle: wo.jobTitle || '-',
        assignedTo: wo.assignedTo || 'Unassigned',
        performedBy: wo.performedBy || '-',
        department: wo.department || '-',
        taskType: wo.taskType || wo.workOrderType || '-',
        teamSize: wo.noOfPersonsInTeam ? Number(wo.noOfPersonsInTeam) : '-',
        timeTakenHours: wo.totalTimeHours ? Number(wo.totalTimeHours).toFixed(1) : '-',
        manhours: wo.manhours ? Number(wo.manhours).toFixed(1) : '-',
        status: wo.status || '-',
        jobPriority: wo.jobPriority || 'Normal',
        dueDate: formatDateDisplay(wo.dueDate),
        completionDate: formatDateDisplay(wo.dateCompleted || wo.completionDateTime),
        critical: isCritical ? 'Yes' : 'No',
        classRelated: isClassRelated ? 'Yes' : 'No'
      };
    });

    // Apply data rows
    applyStandardDataRows(worksheet, reportData, columns, 8);

    // Apply page setup
    applyStandardPageSetup(worksheet, 7, columns.length, 8 + reportData.length, vesselName);

    // Set landscape for detailed view
    worksheet.pageSetup.orientation = 'landscape';

  } else {
    // Summary view columns (13 columns - portrait)
    const columns: ColumnDef[] = [
      { key: 'sNo', header: 'S.No', width: 6, type: 'number', align: 'center' },
      { key: 'rank', header: 'Rank', width: 18, type: 'text' },
      { key: 'department', header: 'Dept', width: 10, type: 'text', align: 'center' },
      { key: 'totalJobsAssigned', header: 'Total Jobs', width: 10, type: 'number', align: 'center' },
      { key: 'jobsCompleted', header: 'Completed', width: 10, type: 'number', align: 'center' },
      { key: 'jobsPending', header: 'Pending', width: 10, type: 'number', align: 'center' },
      { key: 'jobsOverdue', header: 'Overdue', width: 10, type: 'number', align: 'center' },
      { key: 'criticalJobs', header: 'Critical', width: 10, type: 'number', align: 'center' },
      { key: 'highPriorityJobs', header: 'High Priority', width: 10, type: 'number', align: 'center' },
      { key: 'totalManhours', header: 'Manhours', width: 12, type: 'number', align: 'right' },
      { key: 'avgTimePerJob', header: 'Avg Time', width: 10, type: 'number', align: 'right' },
      { key: 'completionRate', header: 'Completion %', width: 12, type: 'number', align: 'right' },
      { key: 'workloadPercentage', header: 'Workload %', width: 12, type: 'number', align: 'right' }
    ];

    const lastColLetter = getLastColumnLetter(columns.length);

    // Build summary data - aggregated by rank (assignedTo only)
    const now = new Date();
    const rankStats: Record<string, {
      rank: string;
      departments: Set<string>;
      totalJobsAssigned: number;
      jobsCompleted: number;
      jobsPending: number;
      jobsOverdue: number;
      criticalJobs: number;
      highPriorityJobs: number;
      totalManhours: number;
      totalTimeTaken: number;
      jobsWithTime: number;
    }> = {};

    filteredWOs.forEach((wo: any) => {
      const assignee = wo.assignedTo || 'Unassigned';
      const dept = wo.department || 'N/A';

      if (!rankStats[assignee]) {
        rankStats[assignee] = {
          rank: assignee,
          departments: new Set(),
          totalJobsAssigned: 0,
          jobsCompleted: 0,
          jobsPending: 0,
          jobsOverdue: 0,
          criticalJobs: 0,
          highPriorityJobs: 0,
          totalManhours: 0,
          totalTimeTaken: 0,
          jobsWithTime: 0
        };
      }

      rankStats[assignee].departments.add(dept);
      const stats = rankStats[assignee];
      stats.totalJobsAssigned++;

      if (wo.status === 'Completed') {
        stats.jobsCompleted++;
      } else if (wo.status === 'Overdue' || (wo.dueDate && parseDate(wo.dueDate)! < now && wo.status !== 'Completed')) {
        stats.jobsOverdue++;
      } else if (['Planned', 'Active', 'In Progress'].includes(wo.status)) {
        stats.jobsPending++;
      }

      if (wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true) {
        stats.criticalJobs++;
      }

      if (wo.jobPriority === 'High') {
        stats.highPriorityJobs++;
      }

      if (wo.manhours) {
        stats.totalManhours += Number(wo.manhours) || 0;
      }

      if (wo.totalTimeHours) {
        stats.totalTimeTaken += Number(wo.totalTimeHours) || 0;
        stats.jobsWithTime++;
      }
    });

    const totalManhours = Object.values(rankStats).reduce((sum, s) => sum + s.totalManhours, 0);

    const summaryData = Object.values(rankStats).map((stats, index) => ({
      sNo: index + 1,
      rank: stats.rank,
      department: Array.from(stats.departments).join(', '),
      totalJobsAssigned: stats.totalJobsAssigned,
      jobsCompleted: stats.jobsCompleted,
      jobsPending: stats.jobsPending,
      jobsOverdue: stats.jobsOverdue,
      criticalJobs: stats.criticalJobs,
      highPriorityJobs: stats.highPriorityJobs,
      totalManhours: stats.totalManhours.toFixed(1),
      avgTimePerJob: stats.jobsWithTime > 0
        ? (stats.totalTimeTaken / stats.jobsWithTime).toFixed(1)
        : '0.0',
      completionRate: stats.totalJobsAssigned > 0
        ? ((stats.jobsCompleted / stats.totalJobsAssigned) * 100).toFixed(1) + '%'
        : '0.0%',
      workloadPercentage: totalManhours > 0
        ? ((stats.totalManhours / totalManhours) * 100).toFixed(1) + '%'
        : '0.0%'
    }));

    // Sort by manhours descending
    summaryData.sort((a, b) => parseFloat(b.totalManhours) - parseFloat(a.totalManhours));

    // Re-number after sorting
    summaryData.forEach((row, idx) => { row.sNo = idx + 1; });

    // Apply header
    applyStandardHeader(
      worksheet,
      'CREW WORKLOAD DISTRIBUTION REPORT - SUMMARY VIEW',
      `Analysis of task distribution by rank (${periodStr})`,
      vesselName,
      summaryData.length,
      lastColLetter,
      periodStr
    );

    // Apply table header at row 7
    applyStandardTableHeader(worksheet, columns, 7);

    // Apply data rows
    applyStandardDataRows(worksheet, summaryData, columns, 8);

    // Add totals row
    const totalsRow = 8 + summaryData.length;
    const totalJobs = Object.values(rankStats).reduce((sum, s) => sum + s.totalJobsAssigned, 0);
    const totalCompleted = Object.values(rankStats).reduce((sum, s) => sum + s.jobsCompleted, 0);
    const totalOverdue = Object.values(rankStats).reduce((sum, s) => sum + s.jobsOverdue, 0);

    worksheet.getCell(`A${totalsRow}`).value = '';
    worksheet.getCell(`B${totalsRow}`).value = 'TOTALS:';
    worksheet.getCell(`B${totalsRow}`).font = { bold: true, size: 10 };
    worksheet.getCell(`D${totalsRow}`).value = totalJobs;
    worksheet.getCell(`D${totalsRow}`).font = { bold: true };
    worksheet.getCell(`E${totalsRow}`).value = totalCompleted;
    worksheet.getCell(`E${totalsRow}`).font = { bold: true };
    worksheet.getCell(`G${totalsRow}`).value = totalOverdue;
    worksheet.getCell(`G${totalsRow}`).font = { bold: true, color: { argb: 'FFDC2626' } };
    worksheet.getCell(`J${totalsRow}`).value = totalManhours.toFixed(1);
    worksheet.getCell(`J${totalsRow}`).font = { bold: true };

    // Apply page setup
    applyStandardPageSetup(worksheet, 7, columns.length, totalsRow, vesselName);

    // Portrait for summary view
    worksheet.pageSetup.orientation = 'portrait';
  }

  // Generate buffer and send
  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const viewSuffix = isDetailedView ? 'Detailed' : 'Summary';
  const filename = `Crew_Workload_Distribution_${viewSuffix}_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;

  console.log(`[CREW WORKLOAD REPORT] Generated: ${filename} (View: ${viewType})`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT UTILIZATION SUMMARY - PREVIEW (GET)
// ═══════════════════════════════════════════════════════════════

export async function getEquipmentUtilizationSummary(
  vesselId: string,
  startDate?: string,
  endDate?: string,
  category?: string,
  department?: string,
) {
  // Get vessel name
  const vessels = await repo.getVessels();
  const vessel = vessels.find(v => v.id === vesselId || v.code === vesselId);
  const vesselName = vessel?.name || vesselId;

  // Get all components for the vessel that have running hours tracking
  const allComponents = await repo.getComponents(vesselId);
  // Filter components that have RH tracking (allow zero hours, just check RH type)
  let rhComponents = allComponents.filter(c =>
    c.isActive !== false &&
    c.rhCounterType &&
    c.rhCounterType !== 'Not RH Driven' &&
    c.rhCounterType !== 'NOT_RH_DRIVEN'
  );

  // Apply category filter
  if (category && category !== 'All' && category !== 'all') {
    rhComponents = rhComponents.filter(c =>
      c.componentCategory === category || c.category === category
    );
  }

  // Apply department filter
  if (department && department !== 'All' && department !== 'all') {
    rhComponents = rhComponents.filter(c =>
      c.department === department || c.eqptSystemDept === department
    );
  }

  // Get vessel code for querying logs (may be different from vesselId)
  const vesselCode = vessel?.code || vesselId;

  // Get database instance
  const db = await getDb();

  // Get running hours log for the period - query by both vesselId and vesselCode
  const rhLogs = await db.select().from(componentRunningHoursLog)
    .where(sql`${componentRunningHoursLog.vesselCode} = ${vesselCode} OR ${componentRunningHoursLog.vesselCode} = ${vesselId}`);

  console.log(`[UTILIZATION] Vessel: ${vesselId}, VesselCode: ${vesselCode}, Components: ${rhComponents.length}, RH Logs found: ${rhLogs.length}`);

  const now = new Date();
  const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const periodStart = startDate ? parseDateVal(startDate) : defaultStartDate;
  const periodEnd = endDate ? parseDateVal(endDate) : now;

  if (!periodStart || !periodEnd) {
    throw new Error("Invalid date format");
  }

  const daysInPeriod = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));

  // Build utilization data for each component
  const utilizationData = rhComponents.map((component, index) => {
    // Get RH logs for this component in the period
    const componentLogs = rhLogs.filter(log =>
      (log.componentCode === component.componentCode || log.componentId === component.cuuid) &&
      log.updatedAt &&
      new Date(log.updatedAt) >= periodStart &&
      new Date(log.updatedAt) <= periodEnd
    ).sort((a, b) => new Date(a.updatedAt!).getTime() - new Date(b.updatedAt!).getTime());

    // Get current and baseline running hours separately
    // running_hours is the baseline (initial reading)
    // current_cumulative_rh is the true current meter reading
    const currentCumulativeReading = component.currentCumulativeRH !== null && component.currentCumulativeRH !== undefined
      ? Number(component.currentCumulativeRH)
      : null;
    const baselineHours = component.runningHours !== null && component.runningHours !== undefined
      ? Number(component.runningHours)
      : null;

    // For display purposes, show the best available current reading
    const displayCurrentHours = currentCumulativeReading ?? baselineHours ?? 0;

    // Calculate period hours from delta accumulation or from component data
    // Priority: 1) Log data 2) Baseline delta 3) Estimate from current cumulative (capped)
    let periodHours = 0;
    let dataSource: 'Actual' | 'Estimated' | 'Estimated (capped)' | 'No Data' = 'No Data';

    // Maximum possible hours in the period (physical limit: 24 hrs/day)
    const maxPossibleHours = daysInPeriod * 24;
    // Reasonable cap for estimation: 80% utilization (typical for continuously running equipment)
    const cappedEstimateHours = Math.floor(maxPossibleHours * 0.80);

    if (componentLogs.length > 0) {
      // Use log data if available - sum up all delta changes in the period
      periodHours = componentLogs.reduce((sum, log) => {
        const delta = Number(log.deltaRh) || 0;
        return sum + Math.max(0, delta); // Only positive deltas (ignore corrections)
      }, 0);
      dataSource = 'Actual';
    } else if (baselineHours !== null && currentCumulativeReading !== null && currentCumulativeReading > baselineHours) {
      // We have BOTH baseline AND current reading - calculate actual delta
      periodHours = currentCumulativeReading - baselineHours;
      dataSource = 'Actual';
    } else if (baselineHours !== null && currentCumulativeReading !== null && currentCumulativeReading === baselineHours) {
      // Baseline equals current - no usage in this period
      periodHours = 0;
      dataSource = 'Actual';
    } else if (baselineHours === null && currentCumulativeReading !== null && currentCumulativeReading > 0) {
      // No baseline but have a current reading - use as estimate with cap
      // Current hours is total cumulative since installation, NOT period hours
      // If it exceeds max possible for the period, cap at 80% utilization
      if (currentCumulativeReading <= maxPossibleHours) {
        // Current hours fits within period - use as-is (reasonable estimate)
        periodHours = currentCumulativeReading;
        dataSource = 'Estimated';
      } else {
        // Current hours exceeds period max - cap at 80% utilization
        periodHours = cappedEstimateHours;
        dataSource = 'Estimated (capped)';
      }
    } else if (baselineHours !== null && currentCumulativeReading === null) {
      // Have baseline but no current reading - cannot calculate period hours
      periodHours = 0;
      dataSource = 'No Data';
    }
    // else: No data at all, periodHours stays 0 and dataSource stays 'No Data'

    const avgDailyHours = periodHours / daysInPeriod;

    // Determine utilization band - spec: >20 High, 10-20 Normal, <10 Low
    let utilizationBand: 'High' | 'Normal' | 'Low';
    if (avgDailyHours > 20) {
      utilizationBand = 'High';
    } else if (avgDailyHours >= 10) {
      utilizationBand = 'Normal';
    } else {
      utilizationBand = 'Low';
    }

    // Calculate utilization percentage (assuming 24 hrs/day max)
    // DO NOT cap at 100% - show actual values to expose data anomalies
    const ratedHoursPerDay = 24;
    const utilizationPercent = (avgDailyHours / ratedHoursPerDay) * 100;

    return {
      sNo: index + 1,
      componentCode: component.componentCode || component.id,
      componentName: component.name || component.fleetEquipmentName || 'Unnamed',
      category: component.componentCategory || component.category || '-',
      location: component.location || '-',
      department: component.department || component.eqptSystemDept || '-',
      currentHours: Math.round(displayCurrentHours * 100) / 100,
      periodHours: Math.round(periodHours * 100) / 100,
      avgDailyHours: Math.round(avgDailyHours * 100) / 100,
      utilizationBand,
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
      lastUpdated: component.lastUpdated || null,
      readingsCount: componentLogs.length,
      dataSource
    };
  });

  // Sort by utilization (High first, then by avgDailyHours descending)
  utilizationData.sort((a, b) => {
    const bandOrder = { 'High': 0, 'Normal': 1, 'Low': 2 };
    if (bandOrder[a.utilizationBand] !== bandOrder[b.utilizationBand]) {
      return bandOrder[a.utilizationBand] - bandOrder[b.utilizationBand];
    }
    return b.avgDailyHours - a.avgDailyHours;
  });

  // Re-number after sorting
  utilizationData.forEach((item, idx) => { item.sNo = idx + 1; });

  // Calculate summary with data source counts
  const summary = {
    totalEquipment: utilizationData.length,
    highUtilization: utilizationData.filter(d => d.utilizationBand === 'High').length,
    normalUtilization: utilizationData.filter(d => d.utilizationBand === 'Normal').length,
    lowUtilization: utilizationData.filter(d => d.utilizationBand === 'Low').length,
    avgUtilization: utilizationData.length > 0
      ? Math.round((utilizationData.reduce((sum, d) => sum + d.utilizationPercent, 0) / utilizationData.length) * 10) / 10
      : 0,
    totalPeriodHours: Math.round(utilizationData.reduce((sum, d) => sum + d.periodHours, 0) * 100) / 100,
    periodDays: daysInPeriod,
    periodStart: periodStart.toISOString().split('T')[0],
    periodEnd: periodEnd.toISOString().split('T')[0],
    // Data source breakdown
    actualData: utilizationData.filter(d => d.dataSource === 'Actual').length,
    estimatedData: utilizationData.filter(d => d.dataSource === 'Estimated').length,
    estimatedCapped: utilizationData.filter(d => d.dataSource === 'Estimated (capped)').length,
    noData: utilizationData.filter(d => d.dataSource === 'No Data').length
  };

  return {
    success: true,
    data: utilizationData,
    summary,
    vesselName,
    totalRecords: utilizationData.length
  };
}

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT UTILIZATION SUMMARY - EXCEL EXPORT (POST)
// ═══════════════════════════════════════════════════════════════

export async function exportEquipmentUtilizationSummaryExcel(
  vesselId: string,
  startDate?: string,
  endDate?: string,
  category?: string,
  department?: string,
): Promise<{ buffer: Buffer; filename: string }> {
  // Get vessel name
  const vessels = await repo.getVessels();
  const vessel = vessels.find(v => v.id === vesselId || v.code === vesselId);
  const vesselName = vessel?.name || vesselId;

  // Get all components for the vessel that have running hours tracking
  const allComponents = await repo.getComponents(vesselId);
  // Filter components that have RH tracking (allow zero hours, just check RH type)
  let rhComponents = allComponents.filter(c =>
    c.isActive !== false &&
    c.rhCounterType &&
    c.rhCounterType !== 'Not RH Driven' &&
    c.rhCounterType !== 'NOT_RH_DRIVEN'
  );

  // Apply category filter
  if (category && category !== 'All' && category !== 'all') {
    rhComponents = rhComponents.filter(c =>
      c.componentCategory === category || c.category === category
    );
  }

  // Apply department filter
  if (department && department !== 'All' && department !== 'all') {
    rhComponents = rhComponents.filter(c =>
      c.department === department || c.eqptSystemDept === department
    );
  }

  // Get vessel code for querying logs (may be different from vesselId)
  const vesselCode = vessel?.code || vesselId;

  // Get database instance
  const db = await getDb();

  // Get running hours log for the period - query by both vesselId and vesselCode
  const rhLogs = await db.select().from(componentRunningHoursLog)
    .where(sql`${componentRunningHoursLog.vesselCode} = ${vesselCode} OR ${componentRunningHoursLog.vesselCode} = ${vesselId}`);

  console.log(`[UTILIZATION EXCEL] Vessel: ${vesselId}, VesselCode: ${vesselCode}, Components: ${rhComponents.length}, RH Logs found: ${rhLogs.length}`);

  const now = new Date();
  const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const periodStart = startDate ? parseDateVal(startDate) : defaultStartDate;
  const periodEnd = endDate ? parseDateVal(endDate) : now;

  if (!periodStart || !periodEnd) {
    throw new Error("Invalid date format");
  }

  const daysInPeriod = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));

  // Build utilization data
  const utilizationData = rhComponents.map((component, index) => {
    const componentLogs = rhLogs.filter(log =>
      (log.componentCode === component.componentCode || log.componentId === component.cuuid) &&
      log.updatedAt &&
      new Date(log.updatedAt) >= periodStart &&
      new Date(log.updatedAt) <= periodEnd
    ).sort((a, b) => new Date(a.updatedAt!).getTime() - new Date(b.updatedAt!).getTime());

    // Get current and baseline running hours separately
    // running_hours is the baseline (initial reading)
    // current_cumulative_rh is the true current meter reading
    const currentCumulativeReading = component.currentCumulativeRH !== null && component.currentCumulativeRH !== undefined
      ? Number(component.currentCumulativeRH)
      : null;
    const baselineHours = component.runningHours !== null && component.runningHours !== undefined
      ? Number(component.runningHours)
      : null;

    // For display purposes, show the best available current reading
    const displayCurrentHours = currentCumulativeReading ?? baselineHours ?? 0;

    // Calculate period hours from delta accumulation or from component data
    // Priority: 1) Log data 2) Baseline delta 3) Estimate from current cumulative (capped)
    let periodHours = 0;
    let dataSource: 'Actual' | 'Estimated' | 'Estimated (capped)' | 'No Data' = 'No Data';

    // Maximum possible hours in the period (physical limit: 24 hrs/day)
    const maxPossibleHours = daysInPeriod * 24;
    // Reasonable cap for estimation: 80% utilization (typical for continuously running equipment)
    const cappedEstimateHours = Math.floor(maxPossibleHours * 0.80);

    if (componentLogs.length > 0) {
      periodHours = componentLogs.reduce((sum, log) => {
        const delta = Number(log.deltaRh) || 0;
        return sum + Math.max(0, delta);
      }, 0);
      dataSource = 'Actual';
    } else if (baselineHours !== null && currentCumulativeReading !== null && currentCumulativeReading > baselineHours) {
      // We have BOTH baseline AND current reading - calculate actual delta
      periodHours = currentCumulativeReading - baselineHours;
      dataSource = 'Actual';
    } else if (baselineHours !== null && currentCumulativeReading !== null && currentCumulativeReading === baselineHours) {
      // Baseline equals current - no usage in this period
      periodHours = 0;
      dataSource = 'Actual';
    } else if (baselineHours === null && currentCumulativeReading !== null && currentCumulativeReading > 0) {
      // No baseline but have a current reading - use as estimate with cap
      // Current hours is total cumulative since installation, NOT period hours
      // If it exceeds max possible for the period, cap at 80% utilization
      if (currentCumulativeReading <= maxPossibleHours) {
        // Current hours fits within period - use as-is (reasonable estimate)
        periodHours = currentCumulativeReading;
        dataSource = 'Estimated';
      } else {
        // Current hours exceeds period max - cap at 80% utilization
        periodHours = cappedEstimateHours;
        dataSource = 'Estimated (capped)';
      }
    } else if (baselineHours !== null && currentCumulativeReading === null) {
      // Have baseline but no current reading - cannot calculate period hours
      periodHours = 0;
      dataSource = 'No Data';
    }
    // else: No data at all, periodHours stays 0 and dataSource stays 'No Data'

    const avgDailyHours = periodHours / daysInPeriod;

    // Determine utilization band - spec: >20 High, 10-20 Normal, <10 Low
    let utilizationBand: 'High' | 'Normal' | 'Low';
    if (avgDailyHours > 20) {
      utilizationBand = 'High';
    } else if (avgDailyHours >= 10) {
      utilizationBand = 'Normal';
    } else {
      utilizationBand = 'Low';
    }

    // DO NOT cap at 100% - show actual values to expose data anomalies
    const utilizationPercent = (avgDailyHours / 24) * 100;

    return {
      componentCode: component.componentCode || component.id,
      componentName: component.name || component.fleetEquipmentName || 'Unnamed',
      category: component.componentCategory || component.category || '-',
      location: component.location || '-',
      department: component.department || component.eqptSystemDept || '-',
      currentHours: Math.round(displayCurrentHours * 100) / 100,
      periodHours: Math.round(periodHours * 100) / 100,
      avgDailyHours: Math.round(avgDailyHours * 100) / 100,
      utilizationBand,
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
      lastUpdated: formatDateDisplay(component.lastUpdated),
      readingsCount: componentLogs.length,
      dataSource
    };
  });

  // Sort by utilization band and avgDailyHours
  utilizationData.sort((a, b) => {
    const bandOrder = { 'High': 0, 'Normal': 1, 'Low': 2 };
    if (bandOrder[a.utilizationBand] !== bandOrder[b.utilizationBand]) {
      return bandOrder[a.utilizationBand] - bandOrder[b.utilizationBand];
    }
    return b.avgDailyHours - a.avgDailyHours;
  });

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Equipment Utilization', {
    views: [{ state: 'frozen', ySplit: 7, xSplit: 0 }]
  });

  // Define columns - includes Data Source to show calculation method
  const columns: ColumnDef[] = [
    { key: 'sNo', header: 'S.No', width: 6, type: 'number', align: 'center' },
    { key: 'componentCode', header: 'Comp Code', width: 14, type: 'text' },
    { key: 'componentName', header: 'Component Name', width: 30, type: 'text' },
    { key: 'category', header: 'Category', width: 18, type: 'text' },
    { key: 'location', header: 'Location', width: 15, type: 'text' },
    { key: 'department', header: 'Dept', width: 12, type: 'text', align: 'center' },
    { key: 'currentHours', header: 'Current Hrs', width: 12, type: 'number', align: 'right' },
    { key: 'periodHours', header: 'Period Hrs', width: 12, type: 'number', align: 'right' },
    { key: 'avgDailyHours', header: 'Avg Daily Hrs', width: 12, type: 'number', align: 'right' },
    { key: 'utilizationBand', header: 'Utilization', width: 12, type: 'text', align: 'center' },
    { key: 'utilizationPercent', header: 'Util %', width: 10, type: 'number', align: 'right' },
    { key: 'dataSource', header: 'Data Source', width: 12, type: 'text', align: 'center' },
    { key: 'lastUpdated', header: 'Last Updated', width: 14, type: 'date', align: 'center' }
  ];

  const lastColLetter = getLastColumnLetter(columns.length);

  const periodStr = `${formatDateDisplay(periodStart)} to ${formatDateDisplay(periodEnd)}`;

  // Apply standard header
  applyStandardHeader(
    worksheet,
    'EQUIPMENT UTILIZATION SUMMARY REPORT',
    `Running hours analysis for ${daysInPeriod} days (${periodStr})`,
    vesselName,
    utilizationData.length,
    lastColLetter,
    periodStr
  );

  // Apply table header at row 7
  applyStandardTableHeader(worksheet, columns, 7);

  // Build report data with sNo
  const reportData = utilizationData.map((item, index) => ({
    sNo: index + 1,
    ...item
  }));

  // Apply data rows
  applyStandardDataRows(worksheet, reportData, columns, 8);

  // Apply color coding for utilization bands
  for (let i = 0; i < reportData.length; i++) {
    const rowNum = 8 + i;
    const row = reportData[i];
    const bandCell = worksheet.getCell(`J${rowNum}`);

    if (row.utilizationBand === 'High') {
      bandCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' } // Light red
      };
      bandCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    } else if (row.utilizationBand === 'Normal') {
      bandCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDCFCE7' } // Light green
      };
      bandCell.font = { color: { argb: 'FF16A34A' }, bold: true };
    } else {
      bandCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' } // Light yellow
      };
      bandCell.font = { color: { argb: 'FFD97706' }, bold: true };
    }
  }

  // Add summary row
  const summaryRow = 8 + reportData.length + 1;
  const highCount = reportData.filter(r => r.utilizationBand === 'High').length;
  const normalCount = reportData.filter(r => r.utilizationBand === 'Normal').length;
  const lowCount = reportData.filter(r => r.utilizationBand === 'Low').length;
  const avgUtil = reportData.length > 0
    ? (reportData.reduce((sum, r) => sum + r.utilizationPercent, 0) / reportData.length).toFixed(1)
    : '0';

  // Count data sources
  const actualCount = reportData.filter(r => r.dataSource === 'Actual').length;
  const estimatedCount = reportData.filter(r => r.dataSource === 'Estimated').length;
  const estimatedCappedCount = reportData.filter(r => r.dataSource === 'Estimated (capped)').length;
  const noDataCount = reportData.filter(r => r.dataSource === 'No Data').length;

  worksheet.mergeCells(`A${summaryRow}:${lastColLetter}${summaryRow}`);
  worksheet.getCell(`A${summaryRow}`).value =
    `Summary: Total ${reportData.length} equipment | High: ${highCount} | Normal: ${normalCount} | Low: ${lowCount} | Avg Utilization: ${avgUtil}% | Data: ${actualCount} Actual, ${estimatedCount} Estimated, ${estimatedCappedCount} Capped, ${noDataCount} No Data`;
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
  const filename = `Equipment_Utilization_Summary_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;

  console.log(`[EQUIPMENT UTILIZATION REPORT] Generated: ${filename}`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}
