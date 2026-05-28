import ExcelJS from 'exceljs';
import * as repo from '../repositories/reportRepository';
import { computeWorkOrderStatus, buildCompanyGraceConfig } from '@shared/workOrders/status';
import { storage } from '../../../storage';
import {
  COLORS, STATUS_COLORS, STANDARD_WORK_ORDER_COLUMNS,
  applyStandardHeader, applyStandardTableHeader,
  applyWorkOrderDataRows,
  applyStandardPageSetup, generateFilename, getLastColumnLetter,
  type ColumnDef, type WorkOrderStatus, type WorkOrderRowData
} from '../../../lib/excelReportStyles';

// ═══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

function filterByComponent<T extends Record<string, any>>(items: T[], componentFilter?: string): T[] {
  if (!componentFilter) return items;
  const q = componentFilter.toLowerCase();
  return items.filter(item => {
    const compName = (item.componentName || item.component || "").toLowerCase();
    const compCode = (item.componentCode || "").toLowerCase();
    return compName.includes(q) || compCode.includes(q);
  });
}

function filterByDepartment<T extends Record<string, any>>(items: T[], departmentFilter?: string): T[] {
  if (!departmentFilter) return items;
  const q = departmentFilter.toLowerCase();
  return items.filter(item => (item.department || "").toLowerCase() === q);
}

const MONTH_NAMES_MAP: { [key: string]: number } = {
  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
};

function parseDate(dateInput: string | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  const dateStr = String(dateInput);
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = MONTH_NAMES_MAP[parts[1]];
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && month !== undefined && !isNaN(year) && year > 1900) {
      return new Date(year, month, day);
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseRH(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function formatDateForExcel(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return '-';
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
  } catch {
    return '-';
  }
}

// ═══════════════════════════════════════════════════════════════
// DUE JOBS (7 DAYS) - SHARED DATA FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function getDueJobs7DaysData(vesselId: string, vesselIds?: string[]) {
  const allVessels = await repo.getVessels();
  const vesselMap = new Map(allVessels.map(v => [v.id, v.name]));
  const vessel = allVessels.find(v => v.id === vesselId);
  const isMultiVessel = vesselId === 'all';
  const vesselName = isMultiVessel
    ? (vesselIds && vesselIds.length > 0 ? vesselIds.map(id => vesselMap.get(id) || id).join(', ') : 'All Vessels')
    : (vessel?.name || vesselId);
  const workOrders = await repo.getWorkOrders(vesselId, vesselIds);
  const jobs = await repo.getJobs(vesselId, undefined, vesselIds);
  const components = await repo.getComponents(vesselId, vesselIds);

  const jobsMap = new Map(jobs.map(job => [job.juuid, job]));
  const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
  const componentsMap = new Map(components.map(comp => [comp.cuuid, comp]));

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const RH_THRESHOLD_HOURS = 168;

  console.log('📊 [DUE JOBS REPORT] ═══════════════════════════════════════════');
  console.log(`📊 [DUE JOBS REPORT] Vessel: ${vesselName} (${vesselId})`);
  console.log(`📊 [DUE JOBS REPORT] Today: ${now.toISOString().split('T')[0]}`);
  console.log(`📊 [DUE JOBS REPORT] 7 Days From Now: ${sevenDaysFromNow.toISOString().split('T')[0]}`);
  console.log(`📊 [DUE JOBS REPORT] Total Work Orders Fetched: ${workOrders.length}`);
  console.log(`📊 [DUE JOBS REPORT] Total Jobs Fetched: ${jobs.length}`);
  console.log(`📊 [DUE JOBS REPORT] Total Components Fetched: ${components.length}`);

  const dueJobs: any[] = [];
  let debugStats = {
    total: workOrders.length,
    skippedCompleted: 0,
    skippedPostponed: 0,
    calendarBased: 0,
    rhBased: 0,
    calendarOverdue: 0,
    rhOverdue: 0,
    calendarDueSoon: 0,
    rhDueSoon: 0,
    noDueDate: 0,
    noRhData: 0,
    futureDue: 0
  };

  for (const wo of workOrders) {
    if (wo.status === 'Completed') { debugStats.skippedCompleted++; continue; }
    if (wo.status === 'Postponed') { debugStats.skippedPostponed++; continue; }

    const job = wo.jobId ? jobsMap.get(wo.jobId) : jobs.find(j => j.jobNo === wo.templateCode);
    const component = wo.componentCode
      ? componentsByCodeMap.get(wo.componentCode)
      : (wo.component ? componentsMap.get(wo.component) : null);

    const maintenanceBasis = wo.maintenanceBasis || job?.maintenanceBasis || 'Calendar';
    let isDue = false;
    let daysRemaining: number | null = null;
    let hoursRemaining: number | null = null;
    let urgencyScore: number = 999;
    let isOverdue = false;
    let statusIndicator = 'ACTIVE';

    if (maintenanceBasis === 'Calendar' || maintenanceBasis === 'Calendar+RH') {
      debugStats.calendarBased++;
      const dueDate = parseDate(wo.dueDateSnapshot || wo.dueDate);
      if (dueDate) {
        dueDate.setHours(0, 0, 0, 0);
        daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) {
          isDue = true; isOverdue = true; statusIndicator = 'OVERDUE';
          urgencyScore = daysRemaining;
          debugStats.calendarOverdue++;
        } else if (daysRemaining <= 7) {
          isDue = true;
          statusIndicator = daysRemaining <= 2 ? 'URGENT' : 'DUE';
          urgencyScore = daysRemaining;
          debugStats.calendarDueSoon++;
        } else { debugStats.futureDue++; }
      } else { debugStats.noDueDate++; }
    }

    if (maintenanceBasis === 'Running Hours' || maintenanceBasis === 'Calendar+RH') {
      if (maintenanceBasis === 'Running Hours') debugStats.rhBased++;
      const dueRH = parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading);
      const currentRH = parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading);
      if (dueRH != null && currentRH != null) {
        hoursRemaining = dueRH - currentRH;
        if (hoursRemaining < 0) {
          isDue = true; isOverdue = true; statusIndicator = 'OVERDUE';
          const rhUrgency = hoursRemaining / 24;
          urgencyScore = Math.min(urgencyScore, rhUrgency);
          debugStats.rhOverdue++;
        } else if (hoursRemaining <= RH_THRESHOLD_HOURS) {
          isDue = true;
          if (hoursRemaining <= 48) { if (statusIndicator !== 'OVERDUE') statusIndicator = 'URGENT'; }
          else { if (statusIndicator !== 'OVERDUE' && statusIndicator !== 'URGENT') statusIndicator = 'DUE'; }
          const rhUrgency = hoursRemaining / 24;
          urgencyScore = Math.min(urgencyScore, rhUrgency);
          debugStats.rhDueSoon++;
        }
      } else {
        if (maintenanceBasis === 'Running Hours') debugStats.noRhData++;
      }
    }

    if (isDue) {
      dueJobs.push({
        workOrderId: (wo as any).wouuid || wo.id,
        workOrderNo: wo.workOrderNo || wo.id,
        jobTitle: wo.jobTitle || job?.jobTitle || '-',
        componentCode: wo.componentCode || '-',
        componentName: component?.name || wo.component || '-',
        dueDate: wo.dueDateSnapshot || wo.dueDate || '-',
        lastDoneDate: wo.lastDoneDateSnapshot || '-',
        daysRemaining: daysRemaining ?? '-',
        nextDueReading: job?.nextDueRH || wo.nextDueReading || '-',
        currentReading: component?.currentCumulativeRH || wo.currentReading || '-',
        hoursRemaining: hoursRemaining != null ? Math.round(hoursRemaining) : '-',
        maintenanceBasis: maintenanceBasis,
        frequency: job ? `${job.frequencyValue || ''} ${job.frequencyUnit || ''}`.trim() : '-',
        assignedTo: wo.assignedTo || job?.assignedTo || '-',
        priority: wo.jobPriority || job?.jobPriority || 'Medium',
        department: wo.department || job?.department || '-',
        critical: component?.critical ? 'Yes' : 'No',
        criticality: wo.criticality || job?.criticality || '-',
        woStatus: wo.status || '-',
        isOverdue,
        statusIndicator,
        urgencyScore,
        vesselName: isMultiVessel ? (vesselMap.get((wo as any).vesselId) || (wo as any).vesselId || '-') : vesselName
      });
    }
  }

  console.log(`📊 [DUE JOBS REPORT] ─────────────────────────────────────────────`);
  console.log(`📊 [DUE JOBS REPORT] FILTERING STATS:`);
  console.log(`📊 [DUE JOBS REPORT]   Skipped Completed: ${debugStats.skippedCompleted}`);
  console.log(`📊 [DUE JOBS REPORT]   Skipped Postponed: ${debugStats.skippedPostponed}`);
  console.log(`📊 [DUE JOBS REPORT]   Calendar-Based Jobs: ${debugStats.calendarBased}`);
  console.log(`📊 [DUE JOBS REPORT]   RH-Based Jobs: ${debugStats.rhBased}`);
  console.log(`📊 [DUE JOBS REPORT]   Calendar Overdue: ${debugStats.calendarOverdue}`);
  console.log(`📊 [DUE JOBS REPORT]   Calendar Due Soon (≤7d): ${debugStats.calendarDueSoon}`);
  console.log(`📊 [DUE JOBS REPORT]   RH Overdue: ${debugStats.rhOverdue}`);
  console.log(`📊 [DUE JOBS REPORT]   RH Due Soon (≤168h): ${debugStats.rhDueSoon}`);
  console.log(`📊 [DUE JOBS REPORT]   No Due Date: ${debugStats.noDueDate}`);
  console.log(`📊 [DUE JOBS REPORT]   No RH Data: ${debugStats.noRhData}`);
  console.log(`📊 [DUE JOBS REPORT]   Future Due (>7d): ${debugStats.futureDue}`);
  console.log(`📊 [DUE JOBS REPORT]   TOTAL JOBS INCLUDED: ${dueJobs.length}`);
  console.log(`📊 [DUE JOBS REPORT] ═══════════════════════════════════════════`);

  const priorityOrder: Record<string, number> = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
  dueJobs.sort((a, b) => {
    if (a.urgencyScore !== b.urgencyScore) return a.urgencyScore - b.urgencyScore;
    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
  });

  const overdueCount = dueJobs.filter(d => d.statusIndicator === 'OVERDUE').length;
  const urgentCount = dueJobs.filter(d => d.statusIndicator === 'URGENT').length;
  const criticalPriorityCount = dueJobs.filter(d => d.priority === 'Critical').length;

  return {
    success: true,
    data: dueJobs,
    vesselName,
    totalRecords: dueJobs.length,
    summary: {
      totalDue: dueJobs.length,
      overdue: overdueCount,
      urgent: urgentCount,
      criticalPriority: criticalPriorityCount
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// DUE JOBS (7 DAYS) - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportDueJobs7Days(vesselId: string, componentFilter?: string): Promise<{ buffer: Buffer; filename: string }> {
  const { data: dueJobsRaw, vesselName } = await getDueJobs7DaysData(vesselId);
  const dueJobs = filterByComponent(dueJobsRaw, componentFilter);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Due Jobs (7 Days)', {
    views: [{ state: 'frozen', ySplit: 7, xSplit: 3 }]
  });

  const columns: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
    { key: 'statusIndicator', header: 'Status', width: 12, type: 'text', align: 'center' },
    { key: 'workOrderNo', header: 'WO Number', width: 22, type: 'text' },
    { key: 'jobTitle', header: 'Title', width: 35, type: 'text' },
    { key: 'componentName', header: 'Component', width: 28, type: 'text' },
    { key: 'dueDate', header: 'Due Date', width: 14, type: 'date', align: 'center' },
    { key: 'daysLeft', header: 'Days Left', width: 10, type: 'number', align: 'right' },
    { key: 'assignedTo', header: 'Assigned To', width: 18, type: 'text' },
  ];
  const totalColumns = columns.length;
  const lastColLetter = getLastColumnLetter(totalColumns);
  const headerRowNum = 7;
  const dataStartRow = 8;

  applyStandardHeader(worksheet, 'DUE JOBS REPORT (NEXT 7 DAYS)', 'Upcoming planned maintenance', vesselName, dueJobs.length, lastColLetter);
  applyStandardTableHeader(worksheet, columns, headerRowNum);

  const preparedData: WorkOrderRowData[] = dueJobs.map((job, index) => {
    const daysRemainingValue = job.daysRemaining;
    const hasDaysRemaining = typeof daysRemainingValue === 'number' && !isNaN(daysRemainingValue);

    return {
      sno: index + 1,
      priority: job.priority,
      statusIndicator: job.statusIndicator,
      workOrderNo: job.workOrderNo,
      jobTitle: job.jobTitle,
      componentName: job.componentName,
      dueDate: job.dueDate,
      daysLeft: hasDaysRemaining ? daysRemainingValue : '-',
      assignedTo: job.assignedTo,
      _rowStatus: (job.isOverdue ? 'overdue' : 'due') as WorkOrderStatus,
      isCriticalEquipment: job.critical === 'Yes'
    };
  });

  applyWorkOrderDataRows(worksheet, preparedData, columns, dataStartRow);

  const lastDataRowNum = dataStartRow + Math.max(dueJobs.length - 1, 0);

  worksheet.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: totalColumns } };
  applyStandardPageSetup(worksheet, headerRowNum, totalColumns, lastDataRowNum, vesselName);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('DueJobs7Days', vesselName);

  console.log(`📊 [DUE JOBS REPORT] Generated: ${filename} (${dueJobs.length} jobs)`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// OVERDUE JOBS - SHARED DATA FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function getOverdueJobsData(vesselId: string, dateFrom?: string, dateTo?: string, vesselIds?: string[]) {
  const allVessels = await repo.getVessels();
  const vesselMap = new Map(allVessels.map(v => [v.id, v.name]));
  const vessel = allVessels.find(v => v.id === vesselId);
  const isMultiVessel = vesselId === 'all';
  const vesselName = isMultiVessel
    ? (vesselIds && vesselIds.length > 0 ? vesselIds.map(id => vesselMap.get(id) || id).join(', ') : 'All Vessels')
    : (vessel?.name || vesselId);
  const workOrders = await repo.getWorkOrders(vesselId, vesselIds);
  const jobs = await repo.getJobs(vesselId, undefined, vesselIds);
  const components = await repo.getComponents(vesselId, vesselIds);

  const jobsMap = new Map(jobs.map(job => [job.juuid, job]));
  const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
  const componentsMap = new Map(components.map(comp => [comp.cuuid, comp]));

  // Period filter: filter overdue jobs by their dueDate within the selected period
  const filterFromObj = dateFrom ? new Date(dateFrom) : null;
  const filterToObj = dateTo ? new Date(dateTo) : null;
  if (filterFromObj) filterFromObj.setHours(0, 0, 0, 0);
  if (filterToObj) filterToObj.setHours(23, 59, 59, 999);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  console.log('[OVERDUE JOBS REPORT] =============================================');
  console.log(`[OVERDUE JOBS REPORT] Vessel: ${vesselName} (${vesselId})`);
  console.log(`[OVERDUE JOBS REPORT] Today: ${now.toISOString().split('T')[0]}`);
  console.log(`[OVERDUE JOBS REPORT] Total Work Orders Fetched: ${workOrders.length}`);
  console.log(`[OVERDUE JOBS REPORT] Using computeWorkOrderStatus() for consistent filtering`);

  const overdueJobs: any[] = [];
  let debugStats = {
    total: workOrders.length,
    skippedCompleted: 0,
    skippedPostponed: 0,
    skippedExecution: 0,
    calendarOverdue: 0,
    rhOverdue: 0,
    criticalEquipment: 0
  };

  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGraceConfig = buildCompanyGraceConfig(companyGraceRow);

  for (const wo of workOrders) {
    if (wo.isExecution) { debugStats.skippedExecution++; continue; }
    if (wo.status === 'Completed') { debugStats.skippedCompleted++; continue; }
    if (wo.status === 'Postponed') { debugStats.skippedPostponed++; continue; }

    const job = wo.jobId ? jobsMap.get(wo.jobId) : jobs.find(j => j.jobNo === wo.templateCode);
    const component = wo.componentCode
      ? componentsByCodeMap.get(wo.componentCode)
      : (wo.component ? componentsMap.get(wo.component) : null);

    const maintenanceBasis = wo.maintenanceBasis || job?.maintenanceBasis || 'Calendar';
    const dueDate = wo.dueDateSnapshot || wo.dueDate || null;
    const dueRH = parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading);
    const currentRH = parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading);

    const computedStatus = computeWorkOrderStatus({
      dueDate: dueDate,
      dueRH: dueRH,
      currentRH: currentRH,
      isExecution: wo.isExecution,
      status: wo.status,
      completionDateTime: wo.completionDateTime,
      maintenanceBasis: maintenanceBasis,
      companyGraceConfig,
    });

    if (computedStatus === 'Overdue') {
      // Apply period filter by dueDate when a date range is active
      if (filterFromObj || filterToObj) {
        const dueDateParsed = dueDate ? parseDate(dueDate) : null;
        if (!dueDateParsed) continue;
        if (filterFromObj && dueDateParsed < filterFromObj) continue;
        if (filterToObj && dueDateParsed > filterToObj) continue;
      }

      const isCriticalEquipment = component?.critical === true || (component?.critical as any) === 'true';
      let daysPastDue = 0;
      let hoursPastDue = 0;
      let overdueType = '';

      if (maintenanceBasis === 'Calendar' || maintenanceBasis === 'Calendar+RH') {
        const dueDateParsed = parseDate(dueDate);
        if (dueDateParsed) {
          dueDateParsed.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((now.getTime() - dueDateParsed.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) { daysPastDue = diffDays; overdueType = 'Calendar'; debugStats.calendarOverdue++; }
        }
      }

      if (maintenanceBasis === 'Running Hours' || maintenanceBasis === 'Calendar+RH') {
        if (dueRH != null && currentRH != null && currentRH > dueRH) {
          hoursPastDue = Math.round(currentRH - dueRH);
          overdueType = overdueType === '' ? 'RH' : 'Both';
          debugStats.rhOverdue++;
        }
      }

      if (isCriticalEquipment) debugStats.criticalEquipment++;

      overdueJobs.push({
        workOrderId: (wo as any).wouuid || wo.id,
        workOrderNo: wo.workOrderNo || wo.id,
        jobTitle: wo.jobTitle || job?.jobTitle || '-',
        componentCode: wo.componentCode || '-',
        componentName: component?.name || wo.component || '-',
        department: wo.department || job?.department || '-',
        taskType: wo.taskType || job?.maintenanceType || '-',
        maintenanceBasis,
        dueDate: dueDate || '-',
        daysPastDue,
        nextDueReading: job?.nextDueRH || wo.nextDueReading || '-',
        currentReading: component?.currentCumulativeRH || wo.currentReading || '-',
        hoursPastDue,
        overdueType,
        assignedTo: wo.assignedTo || job?.assignedTo || '-',
        lastDoneDate: wo.lastDoneDateSnapshot || '-',
        lastDoneRH: job?.lastDoneRH ?? '-',
        critical: isCriticalEquipment ? 'YES' : 'No',
        vesselName: isMultiVessel ? (vesselMap.get((wo as any).vesselId) || (wo as any).vesselId || '-') : vesselName
      });
    }
  }

  console.log(`[OVERDUE JOBS REPORT] ---------------------------------------------`);
  console.log(`[OVERDUE JOBS REPORT] FILTERING STATS:`);
  console.log(`[OVERDUE JOBS REPORT]   Skipped Completed: ${debugStats.skippedCompleted}`);
  console.log(`[OVERDUE JOBS REPORT]   Skipped Postponed: ${debugStats.skippedPostponed}`);
  console.log(`[OVERDUE JOBS REPORT]   Skipped Execution Records: ${debugStats.skippedExecution}`);
  console.log(`[OVERDUE JOBS REPORT]   Calendar Overdue: ${debugStats.calendarOverdue}`);
  console.log(`[OVERDUE JOBS REPORT]   RH Overdue: ${debugStats.rhOverdue}`);
  console.log(`[OVERDUE JOBS REPORT]   Critical Equipment Overdue: ${debugStats.criticalEquipment}`);
  console.log(`[OVERDUE JOBS REPORT]   TOTAL OVERDUE JOBS: ${overdueJobs.length}`);
  console.log(`[OVERDUE JOBS REPORT] =============================================`);

  overdueJobs.sort((a, b) => {
    if (a.critical !== b.critical) return a.critical === 'YES' ? -1 : 1;
    if (a.daysPastDue !== b.daysPastDue) return b.daysPastDue - a.daysPastDue;
    return (a.componentName || '').localeCompare(b.componentName || '');
  });

  const criticalEquipCount = overdueJobs.filter(d => d.critical === 'YES').length;
  const daysOverdueArr = overdueJobs.map(d => d.daysPastDue).filter((d: number) => d > 0);
  const avgDaysOverdue = daysOverdueArr.length > 0 ? Math.round(daysOverdueArr.reduce((a: number, b: number) => a + b, 0) / daysOverdueArr.length) : 0;
  const maxDaysOverdue = daysOverdueArr.length > 0 ? Math.max(...daysOverdueArr) : 0;
  const calendarOverdueCount = overdueJobs.filter(d => d.overdueType === 'Calendar' || d.overdueType === 'Both').length;
  const rhOverdueCount = overdueJobs.filter(d => d.overdueType === 'RH' || d.overdueType === 'Both').length;

  return {
    success: true,
    data: overdueJobs,
    vesselName,
    totalRecords: overdueJobs.length,
    summary: {
      totalOverdue: overdueJobs.length,
      criticalEquipment: criticalEquipCount,
      avgDaysOverdue,
      maxDaysOverdue,
      calendarOverdue: calendarOverdueCount,
      rhOverdue: rhOverdueCount
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// OVERDUE JOBS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportOverdueJobs(vesselId: string, dateFrom?: string, dateTo?: string, componentFilter?: string, departmentFilter?: string): Promise<{ buffer: Buffer; filename: string }> {
  const { data: overdueJobsRaw, vesselName } = await getOverdueJobsData(vesselId, dateFrom, dateTo);
  const overdueJobs = filterByDepartment(filterByComponent(overdueJobsRaw, componentFilter), departmentFilter);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Overdue Jobs', {
    views: [{ state: 'frozen', ySplit: 7, xSplit: 2 }]
  });

  const columns: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
    { key: 'workOrderNo', header: 'WO Code', width: 22, type: 'text' },
    { key: 'jobTitle', header: 'WO Title', width: 30, type: 'text' },
    { key: 'componentCode', header: 'Component Code', width: 16, type: 'text' },
    { key: 'componentName', header: 'Component Name', width: 25, type: 'text' },
    { key: 'department', header: 'Department', width: 12, type: 'text' },
    { key: 'taskType', header: 'Task Type', width: 14, type: 'text' },
    { key: 'jobType', header: 'Job Type', width: 14, type: 'text', align: 'center' },
    { key: 'lastDoneDate', header: 'Last Done Date', width: 14, type: 'date', align: 'center' },
    { key: 'rhWhenLastDone', header: 'RH When Last Done', width: 16, type: 'text', align: 'right' },
    { key: 'daysRhOverdue', header: 'Days/RH Overdue', width: 16, type: 'text', align: 'right' },
    { key: 'assignedTo', header: 'Assigned To', width: 16, type: 'text' },
    { key: 'criticalEquipment', header: 'Critical', width: 10, type: 'text', align: 'center' },
  ];
  const totalColumns = columns.length;
  const lastColLetter = getLastColumnLetter(totalColumns);
  const headerRowNum = 7;
  const dataStartRow = 8;

  applyStandardHeader(worksheet, 'OVERDUE JOBS REPORT', 'Work orders past grace period - requires immediate action', vesselName, overdueJobs.length, lastColLetter);
  applyStandardTableHeader(worksheet, columns, headerRowNum);

  const preparedData: WorkOrderRowData[] = overdueJobs.map((job, index) => {
    const isCritical = job.critical === 'YES';
    const overdueType = job.overdueType || '';
    let daysRhOverdue = '-';
    if (overdueType === 'RH' || overdueType === 'Both') {
      daysRhOverdue = job.hoursPastDue > 0 ? `${job.hoursPastDue} RH` : '-';
    } else if (overdueType === 'Calendar') {
      daysRhOverdue = job.daysPastDue > 0 ? `${job.daysPastDue} days` : '-';
    }

    return {
      sno: index + 1,
      workOrderNo: job.workOrderNo,
      jobTitle: job.jobTitle,
      componentCode: job.componentCode,
      componentName: job.componentName,
      department: job.department,
      taskType: job.taskType || '-',
      jobType: job.maintenanceBasis || '-',
      lastDoneDate: job.lastDoneDate,
      rhWhenLastDone: job.lastDoneRH ?? '-',
      daysRhOverdue,
      assignedTo: job.assignedTo,
      criticalEquipment: isCritical ? 'YES' : 'No',
      _rowStatus: 'overdue' as WorkOrderStatus,
      isCriticalEquipment: isCritical
    };
  });

  applyWorkOrderDataRows(worksheet, preparedData, columns, dataStartRow);

  const lastDataRowNum = dataStartRow + Math.max(overdueJobs.length - 1, 0);

  worksheet.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: totalColumns } };
  applyStandardPageSetup(worksheet, headerRowNum, totalColumns, lastDataRowNum, vesselName);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('OverdueJobs', vesselName);

  console.log(`[OVERDUE JOBS REPORT] Generated: ${filename} (${overdueJobs.length} jobs)`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// COMPLETED JOBS REGISTER - SHARED DATA FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function getCompletedJobsData(vesselId: string, dateFrom?: string, dateTo?: string, vesselIds?: string[]) {
  const formatDateDDMMMYYYY = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '\u2014';
    try {
      const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(d.getTime())) return '\u2014';
      const day = d.getDate().toString().padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch { return '\u2014'; }
  };

  const calculateDuration = (startStr: string | null | undefined, endStr: string | null | undefined): number => {
    if (!startStr || !endStr) return 0;
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
      return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
    } catch { return 0; }
  };

  const allVessels = await repo.getVessels();
  const vesselMap = new Map(allVessels.map(v => [v.id, v.name]));
  const vessel = allVessels.find(v => v.id === vesselId);
  const isMultiVessel = vesselId === 'all';
  const vesselName = isMultiVessel
    ? (vesselIds && vesselIds.length > 0 ? vesselIds.map(id => vesselMap.get(id) || id).join(', ') : 'All Vessels')
    : (vessel?.name || vesselId);
  const workOrders = await repo.getWorkOrders(vesselId, vesselIds);
  const jobs = await repo.getJobs(vesselId, undefined, vesselIds);
  const components = await repo.getComponents(vesselId, vesselIds);

  const jobsMap = new Map(jobs.map(job => [job.juuid, job]));
  const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));

  const completedWorkOrders = workOrders.filter(wo => wo.status === 'Completed');

  let filteredJobs = completedWorkOrders;
  if (dateFrom || dateTo) {
    filteredJobs = completedWorkOrders.filter(wo => {
      const completedDate = wo.dateCompleted || (wo as any).completionDateTime;
      if (!completedDate) return false;
      const date = new Date(completedDate);
      if (isNaN(date.getTime())) return false;
      if (dateFrom && date < new Date(dateFrom)) return false;
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        if (date > endDate) return false;
      }
      return true;
    });
  }

  filteredJobs.sort((a, b) => {
    const dateA = new Date(a.dateCompleted || (a as any).completionDateTime || 0).getTime();
    const dateB = new Date(b.dateCompleted || (b as any).completionDateTime || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    const woA = a.workOrderNo || a.id || '';
    const woB = b.workOrderNo || b.id || '';
    return woA.localeCompare(woB);
  });

  let totalManHours = 0;

  const completedJobs = filteredJobs.map((wo, index) => {
    const job = jobsMap.get(wo.jobId || '');
    const comp = componentsByCodeMap.get(wo.componentCode || '');

    const duration = parseFloat(wo.totalTimeHours || '0') || calculateDuration(wo.startDateTime, (wo as any).completionDateTime);
    const persons = parseInt(wo.noOfPersons || '1') || 1;
    const manHours = parseFloat(wo.manhours || '0') || (duration * persons);
    totalManHours += manHours;

    return {
      sNo: index + 1,
      workOrderId: (wo as any).wouuid || wo.id,
      workOrderNo: wo.workOrderNo || wo.id || '\u2014',
      componentName: wo.component || comp?.name || '\u2014',
      componentCode: wo.componentCode || '\u2014',
      jobTitle: wo.jobTitle || '\u2014',
      jobType: wo.taskType || wo.maintenanceType || '\u2014',
      maintenanceBasis: wo.maintenanceBasis || '\u2014',
      department: wo.department || 'Unassigned',
      priority: wo.jobPriority || 'Normal',
      criticality: wo.criticality || 'No',
      classRelated: wo.classRelated || 'No',
      assignedTo: wo.performedBy || wo.assignedTo || '\u2014',
      approver: (wo as any).approver || '\u2014',
      startDate: formatDateDDMMMYYYY(wo.startDateTime),
      completionDate: formatDateDDMMMYYYY(wo.dateCompleted || (wo as any).completionDateTime),
      manHours: manHours > 0 ? manHours.toFixed(1) : '\u2014',
      skippedCycles: wo.missedCycles ?? 0,
      vesselName: isMultiVessel ? (vesselMap.get((wo as any).vesselId) || (wo as any).vesselId || '-') : vesselName
    };
  });

  return {
    success: true,
    data: completedJobs,
    vesselName,
    totalRecords: completedJobs.length,
    summary: {
      totalJobs: completedJobs.length,
      totalManHours: totalManHours.toFixed(1)
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPLETED JOBS REGISTER - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportCompletedJobs(vesselId: string, dateFrom?: string, dateTo?: string, componentFilter?: string, departmentFilter?: string): Promise<{ buffer: Buffer; filename: string }> {
  const formatDateDDMMMYYYY = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '\u2014';
    try {
      const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(d.getTime())) return '\u2014';
      const day = d.getDate().toString().padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch { return '\u2014'; }
  };

  const { data: completedJobsRaw, vesselName, summary } = await getCompletedJobsData(vesselId, dateFrom, dateTo);
  const completedJobs = filterByDepartment(filterByComponent(completedJobsRaw, componentFilter), departmentFilter);
  const totalManHours = parseFloat(summary.totalManHours);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Completed Jobs Register', {
    views: [{ state: 'frozen', ySplit: 8, xSplit: 2 }]
  });

  const columns: ColumnDef[] = [
    { header: 'S.No', key: 'sNo', width: 8 },
    { header: 'WO No', key: 'workOrderNo', width: 22 },
    { header: 'Component', key: 'componentName', width: 28 },
    { header: 'Job Title', key: 'jobTitle', width: 30 },
    { header: 'Job Type', key: 'jobType', width: 14 },
    { header: 'Dept', key: 'department', width: 12 },
    { header: 'Assigned To', key: 'assignedTo', width: 18 },
    { header: 'Start Date', key: 'startDate', width: 16 },
    { header: 'Completion Date', key: 'completionDate', width: 16 },
    { header: 'Man Hours', key: 'manHours', width: 12 },
    { header: 'Skipped Cycles', key: 'skippedCycles', width: 14 }
  ];

  const totalColumns = columns.length;
  const lastColLetter = getLastColumnLetter(totalColumns);
  const headerRowNum = 8;
  const dataStartRow = 9;

  // Header section (rows 1-7)
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'COMPLETED JOBS REGISTER';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(`A2:${lastColLetter}2`);
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = 'Comprehensive register of all completed maintenance work orders';
  subtitleCell.font = { size: 11, color: { argb: 'FFFFFFFF' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.getCell('A3').value = `Vessel: ${vesselName}`;
  worksheet.getCell('A3').font = { bold: true };
  worksheet.mergeCells(`A3:D3`);

  const periodText = dateFrom && dateTo
    ? `Report Period: ${formatDateDDMMMYYYY(dateFrom)} to ${formatDateDDMMMYYYY(dateTo)}`
    : 'Report Period: All Time';
  worksheet.getCell('E3').value = periodText;
  worksheet.mergeCells(`E3:H3`);

  worksheet.getCell('I3').value = `Generated: ${formatDateDDMMMYYYY(new Date())}`;
  worksheet.mergeCells(`I3:${lastColLetter}3`);

  worksheet.getRow(4).height = 5;
  worksheet.getRow(5).height = 5;
  worksheet.getRow(6).height = 5;

  // Column headers
  const headerRow = worksheet.getRow(headerRowNum);
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5DADE2' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
      bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
      left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
      right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
    };
    worksheet.getColumn(idx + 1).width = col.width;
  });
  headerRow.height = 22;

  // Data rows
  completedJobs.forEach((job, rowIdx) => {
    const row = worksheet.getRow(dataStartRow + rowIdx);
    columns.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = (job as any)[col.key] || '\u2014';
      cell.font = { size: 9 };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
        bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
        left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
        right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
      };
      if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
      }
    });
    row.height = 18;
  });

  worksheet.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: totalColumns } };

  worksheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 8 as any,
    fitToPage: true,
    fitToWidth: 1,
    printTitlesRow: `${headerRowNum}:${headerRowNum}`
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('CompletedJobsRegister', vesselName);

  console.log(`[COMPLETED JOBS REGISTER] Generated: ${filename} (${completedJobs.length} jobs, ${totalManHours.toFixed(1)} man-hours)`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// ALL JOBS / WORK ORDERS REGISTER - SHARED DATA FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function getAllJobsData(vesselId: string, dateFrom?: string, dateTo?: string, vesselIds?: string[]) {
  const formatDateDDMMMYYYY = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '\u2014';
    try {
      const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(d.getTime())) return '\u2014';
      const day = d.getDate().toString().padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
    } catch { return '\u2014'; }
  };

  const allVessels = await repo.getVessels();
  const vesselMap = new Map(allVessels.map(v => [v.id, v.name]));
  const vessel = allVessels.find(v => v.id === vesselId);
  const isMultiVessel = vesselId === 'all';
  const vesselName = isMultiVessel
    ? (vesselIds && vesselIds.length > 0 ? vesselIds.map(id => vesselMap.get(id) || id).join(', ') : 'All Vessels')
    : (vessel?.name || vesselId);
  const workOrders = await repo.getWorkOrders(vesselId, vesselIds);
  const jobs = await repo.getJobs(vesselId, undefined, vesselIds);
  const components = await repo.getComponents(vesselId, vesselIds);

  const jobsMap = new Map(jobs.map(job => [job.juuid, job]));
  const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));

  // Exclude execution rows, soft-deleted rows, and cancelled work orders
  const eligibleWorkOrders = workOrders.filter(wo => {
    if ((wo as any).isExecution) return false;
    if ((wo as any).isDeleted === true) return false;
    const status = (wo.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled') return false;
    return true;
  });

  // Period filter against dueDate (covers all statuses, since not all WOs are completed)
  const filterFromObj = dateFrom ? new Date(dateFrom) : null;
  const filterToObj = dateTo ? new Date(dateTo) : null;
  if (filterFromObj) filterFromObj.setHours(0, 0, 0, 0);
  if (filterToObj) filterToObj.setHours(23, 59, 59, 999);

  let filteredJobs = eligibleWorkOrders;
  if (filterFromObj || filterToObj) {
    filteredJobs = eligibleWorkOrders.filter(wo => {
      const due = (wo as any).dueDateSnapshot || wo.dueDate;
      const d = parseDate(due);
      if (!d) return false;
      if (filterFromObj && d < filterFromObj) return false;
      if (filterToObj && d > filterToObj) return false;
      return true;
    });
  }

  filteredJobs.sort((a, b) => {
    const dateA = parseDate((a as any).dueDateSnapshot || a.dueDate)?.getTime() || 0;
    const dateB = parseDate((b as any).dueDateSnapshot || b.dueDate)?.getTime() || 0;
    if (dateB !== dateA) return dateB - dateA;
    return (a.workOrderNo || a.id || '').localeCompare(b.workOrderNo || b.id || '');
  });

  let totalManHours = 0;
  const statusCounts: Record<string, number> = {};

  const allJobs = filteredJobs.map((wo, index) => {
    const job = jobsMap.get(wo.jobId || '');
    const comp = componentsByCodeMap.get(wo.componentCode || '');

    const duration = parseFloat(wo.totalTimeHours || '0') || 0;
    const persons = parseInt(wo.noOfPersons || '1') || 1;
    const manHours = parseFloat(wo.manhours || '0') || (duration * persons);
    if (manHours > 0) totalManHours += manHours;

    const status = wo.status || 'Active';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const frequency = job ? `${(job as any).frequencyValue || ''} ${(job as any).frequencyUnit || ''}`.trim() : '';

    return {
      sNo: index + 1,
      workOrderId: (wo as any).wouuid || wo.id,
      workOrderNo: wo.workOrderNo || wo.id || '\u2014',
      componentName: wo.component || comp?.name || '\u2014',
      componentCode: wo.componentCode || '\u2014',
      jobTitle: wo.jobTitle || '\u2014',
      jobType: wo.taskType || wo.maintenanceType || '\u2014',
      department: wo.department || 'Unassigned',
      assignedTo: wo.performedBy || wo.assignedTo || job?.assignedTo || '\u2014',
      frequency: frequency || '\u2014',
      dueDate: formatDateDDMMMYYYY((wo as any).dueDateSnapshot || wo.dueDate),
      completionDate: formatDateDDMMMYYYY(wo.dateCompleted || (wo as any).completionDateTime),
      status,
      manHours: manHours > 0 ? manHours.toFixed(1) : '\u2014',
      remarks: (wo as any).remarks || (wo as any).comments || '\u2014',
      vesselName: isMultiVessel ? (vesselMap.get((wo as any).vesselId) || (wo as any).vesselId || '-') : vesselName,
    };
  });

  return {
    success: true,
    data: allJobs,
    vesselName,
    totalRecords: allJobs.length,
    summary: {
      totalJobs: allJobs.length,
      totalManHours: totalManHours.toFixed(1),
      statusCounts,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// ALL JOBS / WORK ORDERS REGISTER - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportAllJobs(vesselId: string, dateFrom?: string, dateTo?: string, componentFilter?: string, departmentFilter?: string): Promise<{ buffer: Buffer; filename: string }> {
  const formatDateDDMMMYYYY = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '\u2014';
    try {
      const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(d.getTime())) return '\u2014';
      const day = d.getDate().toString().padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
    } catch { return '\u2014'; }
  };

  const { data: rowsRaw, vesselName, summary } = await getAllJobsData(vesselId, dateFrom, dateTo);
  const rows = filterByDepartment(filterByComponent(rowsRaw, componentFilter), departmentFilter);
  const isMultiVessel = vesselId === 'all';
  // Recompute status counts against the post-filter row set so the header summary matches the data
  const filteredStatusCounts: Record<string, number> = {};
  for (const r of rows) {
    const s = (r as any).status || 'Active';
    filteredStatusCounts[s] = (filteredStatusCounts[s] || 0) + 1;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('All Jobs Register', {
    views: [{ state: 'frozen', ySplit: 8, xSplit: 2 }]
  });

  const columns: ColumnDef[] = [
    { header: 'S.No', key: 'sNo', width: 8 },
    ...(isMultiVessel ? [{ header: 'Vessel', key: 'vesselName', width: 22 }] as ColumnDef[] : []),
    { header: 'WO No', key: 'workOrderNo', width: 22 },
    { header: 'Component', key: 'componentName', width: 28 },
    { header: 'Job Title', key: 'jobTitle', width: 30 },
    { header: 'Job Type', key: 'jobType', width: 14 },
    { header: 'Dept', key: 'department', width: 12 },
    { header: 'Assigned To', key: 'assignedTo', width: 18 },
    { header: 'Frequency', key: 'frequency', width: 14 },
    { header: 'Due Date', key: 'dueDate', width: 16 },
    { header: 'Completion Date', key: 'completionDate', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Man Hours', key: 'manHours', width: 12 },
    { header: 'Remarks', key: 'remarks', width: 30 },
  ];

  const totalColumns = columns.length;
  const lastColLetter = getLastColumnLetter(totalColumns);
  const headerRowNum = 8;
  const dataStartRow = 9;

  // Title bar
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'ALL JOBS / WORK ORDERS REGISTER';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(`A2:${lastColLetter}2`);
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = 'Comprehensive register of all work orders regardless of status';
  subtitleCell.font = { size: 11, color: { argb: 'FFFFFFFF' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.getCell('A3').value = `Vessel: ${vesselName}`;
  worksheet.getCell('A3').font = { bold: true };
  worksheet.mergeCells('A3:D3');

  const periodText = dateFrom && dateTo
    ? `Report Period: ${formatDateDDMMMYYYY(dateFrom)} to ${formatDateDDMMMYYYY(dateTo)}`
    : 'Report Period: All Time';
  worksheet.getCell('E3').value = periodText;
  worksheet.mergeCells('E3:H3');

  worksheet.getCell('I3').value = `Generated: ${formatDateDDMMMYYYY(new Date())}`;
  worksheet.mergeCells(`I3:${lastColLetter}3`);

  worksheet.getRow(4).height = 5;
  worksheet.getRow(5).height = 5;
  worksheet.getRow(6).height = 5;

  // Status summary line (computed against filtered rows)
  const statusCounts = filteredStatusCounts;
  void summary;
  const statusSummary = Object.entries(statusCounts)
    .map(([s, c]) => `${s}: ${c}`)
    .join(' | ') || `Total: ${rows.length}`;
  worksheet.mergeCells(`A7:${lastColLetter}7`);
  const statusCell = worksheet.getCell('A7');
  statusCell.value = `Total: ${rows.length}  |  ${statusSummary}`;
  statusCell.font = { italic: true, size: 10 };
  statusCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // Column headers
  const headerRow = worksheet.getRow(headerRowNum);
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5DADE2' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
      bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
      left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
      right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
    };
    worksheet.getColumn(idx + 1).width = col.width;
  });
  headerRow.height = 22;

  // Data rows
  rows.forEach((row, rowIdx) => {
    const xlRow = worksheet.getRow(dataStartRow + rowIdx);
    columns.forEach((col, colIdx) => {
      const cell = xlRow.getCell(colIdx + 1);
      cell.value = (row as any)[col.key] ?? '\u2014';
      cell.font = { size: 9 };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
        bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
        left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
        right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
      };
      if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
      }
    });
    xlRow.height = 18;
  });

  worksheet.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: totalColumns } };

  worksheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 8 as any,
    fitToPage: true,
    fitToWidth: 1,
    printTitlesRow: `${headerRowNum}:${headerRowNum}`
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('AllJobsRegister', vesselName);

  console.log(`[ALL JOBS REGISTER] Generated: ${filename} (${rows.length} rows)`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// UNPLANNED/BREAKDOWN JOBS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportUnplannedJobs(vesselId: string, dateFrom?: string, dateTo?: string, componentFilter?: string): Promise<{ buffer: Buffer; filename: string }> {
  const workOrders = await repo.getWorkOrders(vesselId);
  const jobs = await repo.getJobs(vesselId);
  const components = await repo.getComponents(vesselId);
  const allVessels = await repo.getVessels();
  const vessel = allVessels.find(v => v.id === vesselId);
  const vesselName = vessel?.name || vesselId;

  const jobsMap = new Map(jobs.map(job => [job.juuid, job]));
  const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));

  const unplannedWorkOrders = workOrders.filter(wo =>
    wo.workOrderType === 'Unplanned' ||
    (wo as any).type === 'Unplanned' ||
    ((wo as any).workOrderNumber && (wo as any).workOrderNumber.startsWith('UWO'))
  );

  let filteredJobs = unplannedWorkOrders;
  if (dateFrom || dateTo) {
    filteredJobs = unplannedWorkOrders.filter(wo => {
      const createdDate = wo.createdAt || wo.dueDate;
      if (!createdDate) return false;
      const date = new Date(createdDate);
      if (isNaN(date.getTime())) return false;
      if (dateFrom && date < new Date(dateFrom)) return false;
      if (dateTo && date > new Date(dateTo)) return false;
      return true;
    });
  }

  filteredJobs = filterByComponent(filteredJobs, componentFilter);

  const unplannedJobs = filteredJobs.map(wo => {
    const job = jobsMap.get(wo.jobId || '');
    const comp = componentsByCodeMap.get(wo.componentCode || '');
    const isCritical = (comp as any)?.criticalEquipment === true || (comp as any)?.criticalEquipment === 'Yes';

    return {
      workOrderId: (wo as any).wouuid || wo.id,
      workOrderNo: (wo as any).workOrderNumber || wo.id,
      templateCode: (job as any)?.templateCode || '-',
      jobTitle: (wo as any).title || wo.jobTitle || '-',
      componentCode: wo.componentCode || '-',
      componentName: wo.component || (wo as any).componentName || (comp as any)?.componentName || '-',
      department: wo.department || (wo as any).assignedDepartment || '-',
      priority: (wo as any).priority || 'High',
      woStatus: wo.status || 'Active',
      dueDate: wo.dueDate ? formatDateForExcel(wo.dueDate) : '-',
      createdDate: wo.createdAt,
      lastDoneDate: (wo as any).completedDate ? formatDateForExcel((wo as any).completedDate) : '-',
      assignedTo: wo.assignedTo || '-',
      maintenanceBasis: 'Unplanned',
      critical: isCritical ? 'Yes' : 'No'
    };
  });

  unplannedJobs.sort((a, b) => {
    const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
    const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
    return dateB - dateA;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Unplanned Jobs', {
    views: [{ state: 'frozen', ySplit: 7, xSplit: 2 }]
  });

  const columns = STANDARD_WORK_ORDER_COLUMNS;
  const totalColumns = columns.length;
  const lastColLetter = getLastColumnLetter(totalColumns);
  const headerRowNum = 7;
  const dataStartRow = 8;

  applyStandardHeader(worksheet, 'UNPLANNED/BREAKDOWN JOBS REPORT', 'Breakdown maintenance and unplanned work', vesselName, unplannedJobs.length, lastColLetter);
  applyStandardTableHeader(worksheet, columns, headerRowNum);

  const preparedData: WorkOrderRowData[] = unplannedJobs.map((job, index) => {
    const isCritical = job.critical === 'Yes';
    return {
      sno: index + 1,
      workOrderNo: job.workOrderNo,
      jobCode: 'UNPLANNED',
      jobTitle: job.jobTitle,
      componentCode: job.componentCode,
      componentName: job.componentName,
      department: job.department,
      priority: job.priority,
      status: job.woStatus,
      dueDate: job.dueDate,
      lastDoneDate: job.lastDoneDate,
      daysLeft: '-',
      daysOverdue: '-',
      nextDueRH: '-',
      currentRH: '-',
      rhRemaining: '-',
      assignedTo: job.assignedTo,
      criticalEquipment: isCritical ? 'YES' : 'No',
      _rowStatus: 'unplanned' as WorkOrderStatus,
      isCriticalEquipment: isCritical
    };
  });

  applyWorkOrderDataRows(worksheet, preparedData, columns, dataStartRow);

  const lastDataRowNum = dataStartRow + Math.max(unplannedJobs.length - 1, 0);

  worksheet.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: totalColumns } };
  applyStandardPageSetup(worksheet, headerRowNum, totalColumns, lastDataRowNum, vesselName);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('UnplannedJobs', vesselName);

  console.log(`[UNPLANNED JOBS REPORT] Generated: ${filename} (${unplannedJobs.length} jobs)`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// POSTPONEMENT LOG - SHARED DATA FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function getPostponementLogData(
  vesselId: string,
  dateFrom?: string,
  dateTo?: string,
  status?: string,
  vesselIds?: string[]
) {
  const formatDateDisplay = (dateVal: string | Date | null | undefined): string => {
    if (!dateVal) return '-';
    try {
      const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '-'; }
  };

  const allVessels = await repo.getVessels();
  const vesselMap = new Map(allVessels.map(v => [v.id, v.name]));
  const vessel = allVessels.find(v => v.id === vesselId);
  const isMultiVessel = vesselId === 'all';
  const vesselName = isMultiVessel
    ? (vesselIds && vesselIds.length > 0 ? vesselIds.map(id => vesselMap.get(id) || id).join(', ') : 'All Vessels')
    : (vessel?.name || vesselId);
  const workOrders = await repo.getWorkOrders(vesselId, vesselIds);
  const components = await repo.getComponents(vesselId, vesselIds);

  const workOrdersMap = new Map(workOrders.map(wo => [wo.wouuid, wo]));
  const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));

  let postponements = await repo.getWorkOrderPostponements(vesselId, {
    status: status || 'All',
    dateFrom: dateFrom,
    dateTo: dateTo
  }, vesselIds);

  if (postponements.length === 0) {
    const dateFromObj = dateFrom ? new Date(dateFrom) : null;
    const dateToObj = dateTo ? new Date(dateTo) : null;
    if (dateFromObj) dateFromObj.setHours(0, 0, 0, 0);
    if (dateToObj) dateToObj.setHours(23, 59, 59, 999);

    const postponedWOs = workOrders.filter((wo: any) => {
      if (!(wo.status === 'Postponed' && (wo.postponementEndDate || wo.postponementReason))) return false;
      if (dateFromObj || dateToObj) {
        const refDateStr = wo.submittedDate || wo.dueDate;
        if (!refDateStr) return false;
        const refDate = new Date(refDateStr);
        if (isNaN(refDate.getTime())) return false;
        if (dateFromObj && refDate < dateFromObj) return false;
        if (dateToObj && refDate > dateToObj) return false;
      }
      return true;
    });

    postponements = postponedWOs.map((wo: any) => ({
      id: `temp-${wo.id}`,
      workOrderId: wo.wouuid,
      vesselId: vesselId,
      postponementNumber: 1,
      originalDueDate: wo.dueDate,
      newDueDate: wo.postponementEndDate,
      postponementReason: wo.postponementReason,
      authorizedBy: wo.postponementAuthorizedBy,
      approvalRemarks: null,
      durationDays: null,
      submittedDate: wo.submittedDate,
      approvedDate: null,
      approvedBy: null,
      status: 'Approved',
      informOffice: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })) as any;

    console.log(`[POSTPONEMENT LOG REPORT] Fallback: generated ${postponements.length} records from work orders`);
  }

  const postponedJobs = postponements.map((p: any) => {
    const wo = workOrdersMap.get(p.workOrderId);
    const comp = wo?.componentCode ? componentsByCodeMap.get(wo.componentCode) : undefined;
    const isCritical = (comp as any)?.critical === true;

    let durationDays = p.durationDays || 0;
    if (!durationDays && p.originalDueDate && p.newDueDate) {
      const origDate = new Date(p.originalDueDate);
      const newDate = new Date(p.newDueDate);
      if (!isNaN(origDate.getTime()) && !isNaN(newDate.getTime())) {
        durationDays = Math.ceil((newDate.getTime() - origDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    return {
      postponementNumber: p.postponementNumber || 1,
      workOrderNo: wo?.workOrderNo || p.workOrderId,
      jobTitle: wo?.jobTitle || '-',
      componentCode: wo?.componentCode || '-',
      componentName: wo?.component || (comp as any)?.componentName || '-',
      department: wo?.department || '-',
      originalDueDate: formatDateDisplay(p.originalDueDate),
      newDueDate: formatDateDisplay(p.newDueDate),
      durationDays,
      postponementReason: p.postponementReason || '-',
      authorizedBy: p.authorizedBy || '-',
      submittedDate: formatDateDisplay(p.submittedDate),
      status: p.status || 'Pending',
      approvedDate: formatDateDisplay(p.approvedDate),
      approvedBy: p.approvedBy || '-',
      approvalRemarks: p.approvalRemarks || '-',
      informOffice: p.informOffice ? 'Yes' : 'No',
      critical: isCritical ? 'Yes' : 'No',
      vesselName: isMultiVessel ? (vesselMap.get((p.vesselId || wo?.vesselId) as string) || (wo?.vesselId || '-')) : vesselName
    };
  });

  postponedJobs.sort((a: any, b: any) => {
    if (a.workOrderNo !== b.workOrderNo) return a.workOrderNo.localeCompare(b.workOrderNo);
    return b.postponementNumber - a.postponementNumber;
  });

  return {
    success: true,
    data: postponedJobs,
    vesselName,
    totalRecords: postponedJobs.length,
    summary: {
      totalPostponed: postponedJobs.length
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// POSTPONEMENT LOG - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportPostponementLog(
  vesselId: string,
  dateFrom?: string,
  dateTo?: string,
  status?: string,
  componentFilter?: string,
  departmentFilter?: string
): Promise<{ buffer: Buffer; filename: string }> {
  const { data: postponedJobsRaw, vesselName } = await getPostponementLogData(vesselId, dateFrom, dateTo, status);
  const postponedJobs = filterByDepartment(filterByComponent(postponedJobsRaw, componentFilter), departmentFilter);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Postponement Log', {
    views: [{ state: 'frozen', ySplit: 7, xSplit: 3 }]
  });

  const postponementColumns: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'workOrderNo', header: 'WO Number', width: 22, type: 'text', align: 'left' },
    { key: 'jobTitle', header: 'Job Title', width: 35, type: 'text', align: 'left' },
    { key: 'componentName', header: 'Component', width: 30, type: 'text', align: 'left' },
    { key: 'department', header: 'Dept', width: 12, type: 'text', align: 'center' },
    { key: 'originalDueDate', header: 'Original Due', width: 16, type: 'date', align: 'center' },
    { key: 'newDueDate', header: 'New Due', width: 16, type: 'date', align: 'center' },
    { key: 'durationDays', header: 'Days Extended', width: 14, type: 'number', align: 'center' },
    { key: 'postponementReason', header: 'Reason', width: 40, type: 'text', align: 'left' },
    { key: 'status', header: 'Status', width: 14, type: 'text', align: 'center' }
  ];

  const totalColumns = postponementColumns.length;
  const lastColLetter = getLastColumnLetter(totalColumns);
  const headerRowNum = 7;
  const dataStartRow = 8;

  applyStandardHeader(worksheet, 'JOB POSTPONEMENT LOG REPORT', 'Audit trail of all postponed jobs with approvals and justifications', vesselName, postponedJobs.length, lastColLetter);
  applyStandardTableHeader(worksheet, postponementColumns, headerRowNum);

  const preparedData = postponedJobs.map((job: any, index: number) => ({
    sno: index + 1,
    postponementNo: job.postponementNumber,
    workOrderNo: job.workOrderNo,
    jobTitle: job.jobTitle,
    componentCode: job.componentCode,
    componentName: job.componentName,
    department: job.department,
    originalDueDate: job.originalDueDate,
    newDueDate: job.newDueDate,
    durationDays: job.durationDays > 0 ? job.durationDays : '-',
    postponementReason: job.postponementReason,
    authorizedBy: job.authorizedBy,
    submittedDate: job.submittedDate,
    status: job.status,
    approvedDate: job.approvedDate,
    approvedBy: job.approvedBy,
    approvalRemarks: job.approvalRemarks,
    informOffice: job.informOffice,
    critical: job.critical
  }));

  if (preparedData.length === 0) {
    const emptyRow = worksheet.getRow(dataStartRow);
    emptyRow.getCell(1).value = 'No postponement records found';
    worksheet.mergeCells(dataStartRow, 1, dataStartRow, totalColumns);
    emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    emptyRow.getCell(1).font = { italic: true, color: { argb: COLORS.textLight }, size: 11, name: 'Arial' };
    emptyRow.height = 30;
  } else {
    preparedData.forEach((record: any, index: number) => {
      const rowNum = dataStartRow + index;
      const row = worksheet.getRow(rowNum);

      postponementColumns.forEach((col: ColumnDef, colIdx: number) => {
        const cellValue = record[col.key];
        row.getCell(colIdx + 1).value = cellValue !== undefined && cellValue !== null ? cellValue : '-';
      });

      row.height = 20;

      const isEvenRow = index % 2 === 1;
      const isCritical = record.critical === 'Yes';
      const bgColor = isCritical ? STATUS_COLORS.postponedDark : (isEvenRow ? STATUS_COLORS.postponedLight : 'FFE0F2F7');
      const textColor = isCritical ? STATUS_COLORS.textOnDark : STATUS_COLORS.textOnLight;

      row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
        if (colNumber <= totalColumns) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.font = { color: { argb: textColor }, size: 10, name: 'Arial', bold: isCritical };
          cell.alignment = {
            vertical: 'middle',
            horizontal: postponementColumns[colNumber - 1]?.align || 'left',
            wrapText: true
          };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.border } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } }
          };
        }
      });
    });
  }

  const lastDataRowNum = dataStartRow + Math.max(postponedJobs.length - 1, 0);

  worksheet.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: totalColumns } };
  applyStandardPageSetup(worksheet, headerRowNum, totalColumns, lastDataRowNum, vesselName);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('PostponementLog', vesselName);

  console.log(`[POSTPONEMENT LOG REPORT] Generated: ${filename} (${postponedJobs.length} records)`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY MAINTENANCE SUMMARY - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportMonthlySummary(
  vesselId: string,
  year: number,
  month: number
): Promise<{ buffer: Buffer; filename: string }> {
  const { getMonthlySummaryData } = await import('./monthlySnapshotService');
  const summaryData = await getMonthlySummaryData(vesselId, year, month);
  const now = new Date();

  const vesselName = summaryData.vesselName;
  const { opening, movement, closing, indicators } = summaryData;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Monthly Summary', {
    views: [{ state: 'frozen', ySplit: 6, xSplit: 0 }]
  });

  const totalColumns = 4;
  worksheet.getColumn(1).width = 30;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 15;
  worksheet.getColumn(4).width = 15;

  worksheet.mergeCells('A1:D1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'SEAFARER TECHNICAL MANAGEMENT SYSTEM';
  titleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells('A2:D2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = 'MONTHLY MAINTENANCE SUMMARY';
  subtitleCell.font = { size: 12, bold: true, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 25;

  worksheet.getRow(3).height = 8;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const reportPeriod = `${monthNames[month - 1]} ${year}`;

  worksheet.getCell('A4').value = `Vessel: ${vesselName}`;
  worksheet.getCell('A4').font = { bold: true, size: 10, name: 'Arial' };
  worksheet.mergeCells('C4:D4');
  worksheet.getCell('C4').value = `Report Period: ${reportPeriod}`;
  worksheet.getCell('C4').font = { size: 10, name: 'Arial' };
  worksheet.getCell('C4').alignment = { horizontal: 'right' };

  const genDate = new Date();
  const genDateStr = `${genDate.getDate().toString().padStart(2, '0')}-${monthNames[genDate.getMonth()].slice(0,3)}-${genDate.getFullYear()} ${genDate.getHours().toString().padStart(2,'0')}:${genDate.getMinutes().toString().padStart(2,'0')}`;
  worksheet.getCell('A5').value = `Generated: ${genDateStr}`;
  worksheet.getCell('A5').font = { size: 9, color: { argb: 'FF666666' }, name: 'Arial' };
  worksheet.mergeCells('C5:D5');
  worksheet.getCell('C5').value = 'Generated By: PMS System';
  worksheet.getCell('C5').font = { size: 9, color: { argb: 'FF666666' }, name: 'Arial' };
  worksheet.getCell('C5').alignment = { horizontal: 'right' };

  worksheet.getRow(6).height = 10;

  let currentRow = 8;

  const writeSectionHeader = (title: string) => {
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const cell = worksheet.getCell(`A${currentRow}`);
    cell.value = title;
    cell.font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
    worksheet.getRow(currentRow).height = 22;
    currentRow++;
  };

  const writeRow = (label: string, value: number | string) => {
    const bgColor = (currentRow % 2 === 0) ? 'FFFFFFFF' : 'FFF9FAFB';
    const cellA = worksheet.getCell(currentRow, 1);
    cellA.value = label;
    cellA.font = { size: 10, name: 'Arial', color: { argb: 'FF2C3E50' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cellA.alignment = { horizontal: 'left', vertical: 'middle' };

    const cellB = worksheet.getCell(currentRow, 2);
    cellB.value = value;
    cellB.font = { size: 10, name: 'Arial', color: { argb: 'FF2C3E50' }, bold: true };
    cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cellB.alignment = { horizontal: 'center', vertical: 'middle' };

    [cellA, cellB].forEach(c => {
      c.border = {
        top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
        bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
        left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
        right: { style: 'thin', color: { argb: 'FFE1E8ED' } },
      };
    });
    currentRow++;
  };

  const categories = ['Planned', 'Due', 'Overdue', 'Postponed', 'Unplanned', 'Pending Approval', 'Completed'];

  writeSectionHeader('SECTION A — OPENING POSITION');
  categories.forEach(cat => {
    writeRow(cat, opening[cat]?.count ?? 0);
  });
  currentRow += 2;

  writeSectionHeader('SECTION B — MONTHLY MOVEMENT');
  writeRow('New Jobs Entered', movement.newJobsEntered.count);
  writeRow('Completed in Month', movement.completedInMonth.count);
  writeRow('Postponed in Month', movement.postponedInMonth.count);
  writeRow('Newly Overdue in Month', movement.newlyOverdue.count);
  writeRow('Unplanned Jobs Raised', movement.unplannedRaised.count);
  writeRow('Sent to Pending Approval', movement.sentToPendingApproval.count);
  currentRow += 2;

  writeSectionHeader('SECTION C — CLOSING POSITION');
  categories.forEach(cat => {
    writeRow(cat, closing[cat]?.count ?? 0);
  });
  currentRow += 2;

  writeSectionHeader('SECTION D — PERFORMANCE INDICATORS');
  writeRow('Completion Rate', `${indicators.completionRate}%`);
  writeRow('Overdue Change (Closing - Opening)', indicators.overdueChange > 0 ? `+${indicators.overdueChange}` : `${indicators.overdueChange}`);
  writeRow('Postponements in Month', indicators.postponementCount);
  writeRow('Unplanned Jobs in Month', indicators.unplannedCount);

  worksheet.pageSetup = {
    orientation: 'portrait',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
  };

  worksheet.headerFooter = {
    oddFooter: `&L&8&"Arial"Confidential - ${vesselName}&C&8&"Arial"Page &P of &N&R&8&"Arial"Generated: &D &T`
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const safeVesselName = vesselName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `PMS_MonthlySummary_${safeVesselName}_${year}${String(month).padStart(2,'0')}.xlsx`;

  console.log(`[MONTHLY SUMMARY REPORT] Generated: ${filename} (Period: ${reportPeriod})`);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}
