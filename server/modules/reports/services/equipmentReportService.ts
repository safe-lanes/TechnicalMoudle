import ExcelJS from 'exceljs';
import * as repo from '../repositories/reportRepository';
import {
  COLORS,
  applyStandardHeader,
  applyStandardTableHeader,
  applyStandardDataRows,
  applyStandardPageSetup,
  generateFilename,
  getLastColumnLetter,
  type ColumnDef,
  type ConditionalStyle,
} from '../../../lib/excelReportStyles';

// ═══════════════════════════════════════════════════════════════
// TEMPLATE BUILDER
// ═══════════════════════════════════════════════════════════════

export async function getTemplate(templateType: string) {
  // Mock response for template builder
  const template = {
    id: templateType,
    name: `${templateType} Template`,
    description: `Template for ${templateType}`,
    fields: [],
    lastModified: new Date().toISOString()
  };

  return template;
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL EQUIPMENT STATUS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getCriticalEquipmentStatus(vesselId: string) {
  // Get all components for the vessel where critical=true OR classItem=true
  const allComponents = await repo.getComponents(vesselId);
  const criticalComponents = allComponents.filter(c =>
    c.isActive !== false && (c.critical === true || c.classItem === true)
  );

  // Get all work orders for the vessel
  const allWorkOrders = await repo.getWorkOrders(vesselId);

  // Parse date helper
  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Build report data by aggregating work orders per component
  const reportData = criticalComponents.map((component, index) => {
    // Find work orders for this component
    const componentWOs = allWorkOrders.filter(wo =>
      wo.componentCode === component.componentCode ||
      wo.componentCode === component.id ||
      wo.component === component.name
    );

    // Filter active work orders (not completed)
    const activeWOs = componentWOs.filter(wo =>
      wo.status !== 'Completed' && wo.isActive !== false
    );

    // Count by status
    const overdueCount = activeWOs.filter(wo => wo.status === 'Overdue').length;
    const dueSoonCount = activeWOs.filter(wo => {
      const dueDate = parseDate(wo.dueDate || wo.nextDueDate);
      if (!dueDate) return false;
      return dueDate >= today && dueDate <= sevenDaysFromNow;
    }).length;
    const totalActiveWOs = activeWOs.length;

    // Find next due date and last done date
    const dueDates = activeWOs
      .map(wo => parseDate(wo.dueDate || wo.nextDueDate))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    const nextDueDate = dueDates.length > 0 ? dueDates[0] : null;

    const completedWOs = componentWOs.filter(wo => wo.status === 'Completed');
    const completionDates = completedWOs
      .map(wo => parseDate(wo.dateCompleted))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime());
    const lastDoneDate = completionDates.length > 0 ? completionDates[0] : null;

    // Calculate days until due
    const daysUntilDue = nextDueDate
      ? Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      sNo: index + 1,
      componentCode: component.componentCode || component.id,
      componentName: component.name || 'Unnamed Component',
      isCritical: component.critical ? 'Yes' : 'No',
      isClassItem: component.classItem ? 'Yes' : 'No',
      department: component.department || component.eqptSystemDept || '-',
      location: component.location || '-',
      totalWorkOrders: totalActiveWOs,
      overdueJobs: overdueCount,
      dueSoonJobs: dueSoonCount,
      nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
      daysUntilDue
    };
  });

  // Sort by overdue count DESC, then next_due_date ASC (nulls last)
  reportData.sort((a, b) => {
    // First by overdue count (descending)
    if (a.overdueJobs !== b.overdueJobs) {
      return b.overdueJobs - a.overdueJobs;
    }

    // Then by next due date (ascending, nulls last)
    if (a.daysUntilDue === null && b.daysUntilDue === null) return 0;
    if (a.daysUntilDue === null) return 1;
    if (b.daysUntilDue === null) return -1;
    return a.daysUntilDue - b.daysUntilDue;
  });

  // Re-number after sorting
  reportData.forEach((item, idx) => { item.sNo = idx + 1; });

  // Calculate metadata matching specification
  const metadata = {
    totalCriticalEquipment: reportData.length,
    criticalOnly: reportData.filter(r => r.isCritical === 'Yes' && r.isClassItem === 'No').length,
    classItemOnly: reportData.filter(r => r.isClassItem === 'Yes' && r.isCritical === 'No').length,
    bothCriticalAndClass: reportData.filter(r => r.isCritical === 'Yes' && r.isClassItem === 'Yes').length,
    equipmentWithOverdue: reportData.filter(r => r.overdueJobs > 0).length,
    equipmentDueSoon: reportData.filter(r => r.dueSoonJobs > 0 && r.overdueJobs === 0).length,
    totalOverdueJobs: reportData.reduce((sum, r) => sum + r.overdueJobs, 0),
    totalTrackedWorkOrders: reportData.reduce((sum, r) => sum + r.totalWorkOrders, 0),
    reportDate: new Date().toISOString()
  };

  return {
    success: true,
    data: reportData,
    metadata
  };
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL EQUIPMENT STATUS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportCriticalEquipmentStatusExcel(
  vesselId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  // Reuse the JSON endpoint logic - fetch critical equipment data
  const allComponents = await repo.getComponents(vesselId);
  const criticalComponents = allComponents.filter(c =>
    c.isActive !== false && (c.critical === true || c.classItem === true)
  );

  const allWorkOrders = await repo.getWorkOrders(vesselId);
  const allVessels = await repo.getVessels();
  const vessel = allVessels.find(v => v.id === vesselId);
  const vesselName = vessel?.name || vesselId;

  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Build report data
  const reportData = criticalComponents.map((component, index) => {
    const componentWOs = allWorkOrders.filter(wo =>
      wo.componentCode === component.componentCode ||
      wo.componentCode === component.id ||
      wo.component === component.name
    );

    const activeWOs = componentWOs.filter(wo =>
      wo.status !== 'Completed' && wo.isActive !== false
    );

    const overdueCount = activeWOs.filter(wo => wo.status === 'Overdue').length;
    const dueSoonCount = activeWOs.filter(wo => {
      const dueDate = parseDate(wo.dueDate || wo.nextDueDate);
      if (!dueDate) return false;
      return dueDate >= today && dueDate <= sevenDaysFromNow;
    }).length;
    const totalActiveWOs = activeWOs.length;

    const dueDates = activeWOs
      .map(wo => parseDate(wo.dueDate || wo.nextDueDate))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    const nextDueDate = dueDates.length > 0 ? dueDates[0] : null;

    const daysUntilDue = nextDueDate
      ? Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      sNo: index + 1,
      componentCode: component.componentCode || component.id,
      componentName: component.name || 'Unnamed Component',
      isCritical: component.critical ? 'Yes' : 'No',
      isClassItem: component.classItem ? 'Yes' : 'No',
      department: component.department || component.eqptSystemDept || '-',
      location: component.location || '-',
      totalWorkOrders: totalActiveWOs,
      overdueJobs: overdueCount,
      dueSoonJobs: dueSoonCount,
      nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : '-',
      daysUntilDue: daysUntilDue !== null ? daysUntilDue : '-'
    };
  });

  // Sort by overdue count DESC, then next_due_date ASC (nulls last)
  reportData.sort((a, b) => {
    if (a.overdueJobs !== b.overdueJobs) {
      return b.overdueJobs - a.overdueJobs;
    }
    const daysA = a.daysUntilDue === '-' ? 9999 : (a.daysUntilDue as number);
    const daysB = b.daysUntilDue === '-' ? 9999 : (b.daysUntilDue as number);
    return daysA - daysB;
  });

  reportData.forEach((item, idx) => { item.sNo = idx + 1; });

  // Calculate summary matching specification
  const metadata = {
    totalCriticalEquipment: reportData.length,
    criticalOnly: reportData.filter(r => r.isCritical === 'Yes' && r.isClassItem === 'No').length,
    classItemOnly: reportData.filter(r => r.isClassItem === 'Yes' && r.isCritical === 'No').length,
    bothCriticalAndClass: reportData.filter(r => r.isCritical === 'Yes' && r.isClassItem === 'Yes').length,
    equipmentWithOverdue: reportData.filter(r => r.overdueJobs > 0).length,
    equipmentDueSoon: reportData.filter(r => r.dueSoonJobs > 0 && r.overdueJobs === 0).length,
    totalOverdueJobs: reportData.reduce((sum, r) => sum + r.overdueJobs, 0),
    totalTrackedWorkOrders: reportData.reduce((sum, r) => sum + r.totalWorkOrders, 0)
  };

  // Generate Excel workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Critical Equipment Status');

  // Define columns matching specification (12 columns)
  const columns: ColumnDef[] = [
    { header: 'S.No', key: 'sNo', width: 6 },
    { header: 'Comp. Code', key: 'componentCode', width: 15 },
    { header: 'Component Name', key: 'componentName', width: 30 },
    { header: 'Critical', key: 'isCritical', width: 10 },
    { header: 'Class Item', key: 'isClassItem', width: 10 },
    { header: 'Dept', key: 'department', width: 12 },
    { header: 'Location', key: 'location', width: 15 },
    { header: 'Total WOs', key: 'totalWorkOrders', width: 10 },
    { header: 'Overdue', key: 'overdueJobs', width: 10 },
    { header: 'Due Soon', key: 'dueSoonJobs', width: 10 },
    { header: 'Next Due', key: 'nextDueDate', width: 12 },
    { header: 'Days', key: 'daysUntilDue', width: 8 }
  ];

  const lastCol = getLastColumnLetter(columns.length);

  // Apply standard header (rows 1-6)
  applyStandardHeader(
    worksheet,
    'CRITICAL EQUIPMENT STATUS REPORT',
    'SOLAS-critical and class-critical equipment',
    vesselName,
    reportData.length,
    lastCol
  );

  // Apply table headers at row 7
  applyStandardTableHeader(worksheet, columns, 7);

  // Data rows with conditional formatting based on overdue/due soon status
  reportData.forEach((row, index) => {
    const dataRow = worksheet.getRow(8 + index);
    const rowData = [
      row.sNo,
      row.componentCode,
      row.componentName,
      row.isCritical,
      row.isClassItem,
      row.department,
      row.location,
      row.totalWorkOrders,
      row.overdueJobs,
      row.dueSoonJobs,
      row.nextDueDate,
      row.daysUntilDue
    ];

    rowData.forEach((value, colIdx) => {
      dataRow.getCell(colIdx + 1).value = value;
    });

    // Determine row background color based on status
    let fillColor: string;
    if (row.overdueJobs > 0) {
      fillColor = COLORS.bgDanger; // RED for overdue
    } else if (row.dueSoonJobs > 0) {
      fillColor = COLORS.bgWarning; // YELLOW/ORANGE for due soon
    } else {
      fillColor = index % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight;
    }

    dataRow.eachCell((cell, colNumber) => {
      if (colNumber <= columns.length) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.border } },
          left: { style: 'thin', color: { argb: COLORS.border } },
          bottom: { style: 'thin', color: { argb: COLORS.border } },
          right: { style: 'thin', color: { argb: COLORS.border } }
        };
      }
    });

    // Apply conditional formatting to Overdue column (column 9)
    if (row.overdueJobs > 0) {
      dataRow.getCell(9).font = { color: { argb: COLORS.danger }, bold: true };
    }

    // Apply conditional formatting to Days column (column 12)
    const daysValue = row.daysUntilDue;
    if (typeof daysValue === 'number') {
      if (daysValue < 0) {
        dataRow.getCell(12).font = { color: { argb: COLORS.danger }, bold: true };
      } else if (daysValue <= 7) {
        dataRow.getCell(12).font = { color: { argb: COLORS.warning }, bold: true };
      }
    }
  });

  // Apply auto-filter
  worksheet.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: 7 + reportData.length, column: columns.length }
  };

  // Apply standard page setup
  applyStandardPageSetup(worksheet, 7, columns.length, 7 + reportData.length, vesselName);

  // Generate buffer and send
  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `Critical_Equipment_Status_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// UNPLANNED/BREAKDOWN JOBS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getUnplannedBreakdownJobs(
  vesselId: string,
  startDate: string,
  endDate: string,
) {
  // Get all work orders for the vessel
  const allWorkOrders = await repo.getWorkOrders(vesselId);

  // Parse date helper
  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const startDateObj = new Date(startDate);
  startDateObj.setHours(0, 0, 0, 0);
  const endDateObj = new Date(endDate);
  endDateObj.setHours(23, 59, 59, 999);

  // Filter for unplanned/breakdown jobs that are completed
  const unplannedBreakdownJobs = allWorkOrders.filter(wo => {
    // Check if it's an unplanned or breakdown job
    const isUnplanned =
      wo.workOrderType === 'Unplanned' ||
      (wo.taskType && (
        wo.taskType.toLowerCase().includes('unplanned') ||
        wo.taskType.toLowerCase().includes('breakdown')
      )) ||
      (wo.workOrderNo && wo.workOrderNo.startsWith('UWO'));

    if (!isUnplanned) return false;

    // Check if completed
    if (wo.status !== 'Completed') return false;

    // Filter by dateCompleted for completed jobs report
    const completedDateStr = wo.dateCompleted ? ((wo.dateCompleted as any) instanceof Date ? (wo.dateCompleted as any).toISOString() : String(wo.dateCompleted)) : null;
    const completedDate = parseDate(completedDateStr);
    if (!completedDate) return true; // Include jobs without completion date

    return completedDate >= startDateObj && completedDate <= endDateObj;
  });

  // Format date for display
  const formatDateDisplay = (dateVal: string | Date | null | undefined): string => {
    if (!dateVal) return '-';
    try {
      const dateStr = (dateVal as any) instanceof Date ? (dateVal as Date).toISOString() : String(dateVal);
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toISOString().split('T')[0];
    } catch {
      return '-';
    }
  };

  // Build report data
  const reportData = unplannedBreakdownJobs.map((wo, index) => ({
    sNo: index + 1,
    workOrderNo: wo.workOrderNo || wo.id || '-',
    componentCode: wo.componentCode || '-',
    componentName: wo.component || '-',
    jobTitle: wo.jobTitle || '-',
    briefDescription: wo.briefWorkDescription || '-',
    createdDate: formatDateDisplay(wo.createdAt),
    completedDate: formatDateDisplay(wo.dateCompleted),
    performedBy: wo.performedBy || wo.assignedTo || '-',
    totalHours: wo.totalTimeHours ? parseFloat(wo.totalTimeHours).toFixed(1) : '0',
    manhours: wo.manhours ? parseFloat(wo.manhours).toFixed(1) : '0',
    department: wo.department || '-'
  }));

  // Calculate metadata
  const totalManhours = unplannedBreakdownJobs.reduce((sum, wo) => {
    return sum + (parseFloat(wo.manhours || '0') || 0);
  }, 0);

  const totalHours = unplannedBreakdownJobs.reduce((sum, wo) => {
    return sum + (parseFloat(wo.totalTimeHours || '0') || 0);
  }, 0);

  const avgTimeTaken = unplannedBreakdownJobs.length > 0
    ? (totalHours / unplannedBreakdownJobs.length).toFixed(2)
    : '0';

  // Group by department
  const byDepartment: Record<string, number> = {};
  unplannedBreakdownJobs.forEach(wo => {
    const dept = wo.department || 'Not Specified';
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
  });

  // Group by priority
  const byPriority: Record<string, number> = {};
  unplannedBreakdownJobs.forEach(wo => {
    const priority = wo.jobPriority || 'Not Specified';
    byPriority[priority] = (byPriority[priority] || 0) + 1;
  });

  const metadata = {
    totalUnplannedJobs: reportData.length,
    totalManhours: totalManhours.toFixed(1),
    avgTimeTaken,
    byDepartment,
    byPriority,
    reportDate: new Date().toISOString(),
    dateRange: { start: startDate, end: endDate }
  };

  return {
    success: true,
    data: reportData,
    metadata
  };
}

// ═══════════════════════════════════════════════════════════════
// UNPLANNED/BREAKDOWN JOBS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportUnplannedBreakdownJobsExcel(
  vesselId: string,
  startDate: string,
  endDate: string,
): Promise<{ buffer: Buffer; filename: string }> {
  // Get all work orders for the vessel
  const allWorkOrders = await repo.getWorkOrders(vesselId);
  const allVessels = await repo.getVessels();
  const vessel = allVessels.find(v => v.id === vesselId);
  const vesselName = vessel?.name || vesselId;

  // Parse date helper
  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const startDateObj = new Date(startDate);
  startDateObj.setHours(0, 0, 0, 0);
  const endDateObj = new Date(endDate);
  endDateObj.setHours(23, 59, 59, 999);

  // Filter for unplanned/breakdown jobs that are completed
  const unplannedBreakdownJobs = allWorkOrders.filter(wo => {
    const isUnplanned =
      wo.workOrderType === 'Unplanned' ||
      (wo.taskType && (
        wo.taskType.toLowerCase().includes('unplanned') ||
        wo.taskType.toLowerCase().includes('breakdown')
      )) ||
      (wo.workOrderNo && wo.workOrderNo.startsWith('UWO'));

    if (!isUnplanned) return false;
    if (wo.status !== 'Completed') return false;

    // Filter by dateCompleted for completed jobs report
    const completedDateStr = wo.dateCompleted ? ((wo.dateCompleted as any) instanceof Date ? (wo.dateCompleted as any).toISOString() : String(wo.dateCompleted)) : null;
    const completedDate = parseDate(completedDateStr);
    if (!completedDate) return true; // Include jobs without completion date

    return completedDate >= startDateObj && completedDate <= endDateObj;
  });

  // Format date for display
  const formatDateDisplay = (dateVal: string | Date | null | undefined): string => {
    if (!dateVal) return '-';
    try {
      const dateStr = (dateVal as any) instanceof Date ? (dateVal as Date).toISOString() : String(dateVal);
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toISOString().split('T')[0];
    } catch {
      return '-';
    }
  };

  // Build report data
  const reportData = unplannedBreakdownJobs.map((wo, index) => ({
    sNo: index + 1,
    workOrderNo: wo.workOrderNo || wo.id || '-',
    componentCode: wo.componentCode || '-',
    componentName: wo.component || '-',
    jobTitle: wo.jobTitle || '-',
    briefDescription: wo.briefWorkDescription || '-',
    createdDate: formatDateDisplay(wo.createdAt),
    completedDate: formatDateDisplay(wo.dateCompleted),
    performedBy: wo.performedBy || wo.assignedTo || '-',
    totalHours: wo.totalTimeHours ? parseFloat(wo.totalTimeHours).toFixed(1) : '0',
    manhours: wo.manhours ? parseFloat(wo.manhours).toFixed(1) : '0',
    department: wo.department || '-'
  }));

  // Calculate metadata
  const totalManhours = unplannedBreakdownJobs.reduce((sum, wo) => {
    return sum + (parseFloat(wo.manhours || '0') || 0);
  }, 0);

  const totalHours = unplannedBreakdownJobs.reduce((sum, wo) => {
    return sum + (parseFloat(wo.totalTimeHours || '0') || 0);
  }, 0);

  const avgTimeTaken = unplannedBreakdownJobs.length > 0
    ? (totalHours / unplannedBreakdownJobs.length).toFixed(2)
    : '0';

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Unplanned Breakdown Jobs');

  // Define columns (11 columns as specified)
  const columns = [
    { header: 'S.No', key: 'sNo', width: 8 },
    { header: 'WO Number', key: 'workOrderNo', width: 18 },
    { header: 'Comp. Code', key: 'componentCode', width: 15 },
    { header: 'Component Name', key: 'componentName', width: 30 },
    { header: 'Job Title', key: 'jobTitle', width: 25 },
    { header: 'Description', key: 'briefDescription', width: 35 },
    { header: 'Created Date', key: 'createdDate', width: 14 },
    { header: 'Completed Date', key: 'completedDate', width: 14 },
    { header: 'Performed By', key: 'performedBy', width: 18 },
    { header: 'Hours', key: 'totalHours', width: 10 },
    { header: 'Manhours', key: 'manhours', width: 12 }
  ];

  worksheet.columns = columns;
  const lastColLetter = getLastColumnLetter(columns.length);

  // Apply standard header using helper from excelReportStyles
  applyStandardHeader(
    worksheet,
    'UNPLANNED/BREAKDOWN JOBS REPORT',
    `Analysis of breakdown maintenance and unplanned work (${startDate} to ${endDate})`,
    vesselName,
    reportData.length,
    lastColLetter,
    `${startDate} to ${endDate}`
  );

  // Apply table headers at row 7
  applyStandardTableHeader(worksheet, columns, 7);

  // Data rows
  reportData.forEach((row, index) => {
    const dataRow = worksheet.getRow(8 + index);
    const rowData = [
      row.sNo,
      row.workOrderNo,
      row.componentCode,
      row.componentName,
      row.jobTitle,
      row.briefDescription,
      row.createdDate,
      row.completedDate,
      row.performedBy,
      row.totalHours,
      row.manhours
    ];

    rowData.forEach((value, colIdx) => {
      dataRow.getCell(colIdx + 1).value = value;
    });

    // Alternating row colors
    const fillColor = index % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight;

    dataRow.eachCell((cell: any, colNumber: number) => {
      if (colNumber <= columns.length) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.border } },
          left: { style: 'thin', color: { argb: COLORS.border } },
          bottom: { style: 'thin', color: { argb: COLORS.border } },
          right: { style: 'thin', color: { argb: COLORS.border } }
        };
      }
    });
  });

  // Apply auto-filter
  worksheet.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: 7 + reportData.length, column: columns.length }
  };

  // Apply standard page setup
  applyStandardPageSetup(worksheet, 7, columns.length, 7 + reportData.length, vesselName);

  // Generate buffer and send
  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `Unplanned_Breakdown_Jobs_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL COMPONENTS LIST
// ═══════════════════════════════════════════════════════════════

export async function getCriticalComponentsList(
  vesselId: string,
  category: string | undefined,
  classItemFilter: string | undefined,
  format: string,
) {
  const allVessels = await repo.getVessels();
  let allComponents: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      allComponents = allComponents.concat(await repo.getComponents(v.id));
    }
  } else {
    allComponents = await repo.getComponents(vesselId);
  }

  let filteredComponents = allComponents.filter((c: any) => c.critical === true);

  if (category) {
    filteredComponents = filteredComponents.filter((c: any) => c.category === category);
  }

  if (classItemFilter === 'class') {
    filteredComponents = filteredComponents.filter((c: any) => c.classItem === true);
  } else if (classItemFilter === 'non-class') {
    filteredComponents = filteredComponents.filter((c: any) => c.classItem === false);
  }

  const data = filteredComponents.map((c: any, i: number) => {
    const parent = allComponents.find((p: any) => p.id === c.parentId);
    return {
      sno: i + 1,
      componentCode: c.componentCode || '-',
      componentName: c.name || '-',
      parentCode: parent?.componentCode || '-',
      parentName: parent?.name || '-',
      category: c.category || '-',
      location: c.location || '-',
      maker: c.maker || '-',
      model: c.model || '-',
      serialNo: c.serialNo || '-',
      installationDate: c.installationDate || '-',
      classItem: c.classItem ? 'Yes' : 'No',
      conditionBased: c.conditionBased ? 'Yes' : 'No',
      isActive: c.isActive !== false ? 'Yes' : 'No'
    };
  });

  const classItemCount = filteredComponents.filter(c => c.classItem === true).length;
  const nonClassCount = filteredComponents.filter(c => c.classItem !== true).length;
  const activeCount = filteredComponents.filter(c => c.isActive !== false).length;
  const inactiveCount = filteredComponents.filter(c => c.isActive === false).length;

  const byCategory: Record<string, number> = {};
  filteredComponents.forEach(c => {
    const cat = c.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  if (format === 'excel') {
    const columns: ColumnDef[] = [
      { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
      { key: 'componentCode', header: 'Component Code', width: 18, type: 'text' },
      { key: 'componentName', header: 'Component Name', width: 35, type: 'text' },
      { key: 'parentCode', header: 'Parent Code', width: 18, type: 'text' },
      { key: 'parentName', header: 'Parent Name', width: 30, type: 'text' },
      { key: 'category', header: 'Category', width: 25, type: 'text' },
      { key: 'location', header: 'Location', width: 20, type: 'text' },
      { key: 'maker', header: 'Maker', width: 20, type: 'text' },
      { key: 'model', header: 'Model', width: 20, type: 'text' },
      { key: 'serialNo', header: 'Serial No', width: 18, type: 'text' },
      { key: 'installationDate', header: 'Installation Date', width: 16, type: 'text' },
      { key: 'classItem', header: 'Class Item', width: 12, type: 'text', align: 'center' },
      { key: 'conditionBased', header: 'Condition Based', width: 14, type: 'text', align: 'center' },
      { key: 'isActive', header: 'Active', width: 10, type: 'text', align: 'center' }
    ];

    const vesselName = vesselId !== 'all' ? (allVessels.find(v => v.id === vesselId)?.name || vesselId) : 'All Vessels';
    const lastCol = getLastColumnLetter(columns.length);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Critical Components');

    applyStandardHeader(ws, 'Critical Components Master List', `${data.length} critical components`, vesselName, data.length, lastCol);
    applyStandardTableHeader(ws, columns);
    applyStandardDataRows(ws, data, columns);

    const lastDataRow = 7 + data.length;
    applyStandardPageSetup(ws, 7, columns.length, lastDataRow, vesselName);

    const buffer = await wb.xlsx.writeBuffer();
    const filename = generateFilename('Critical_Components_List', vesselName);

    return {
      type: 'excel' as const,
      buffer: Buffer.from(buffer as ArrayBuffer),
      filename
    };
  }

  return {
    type: 'json' as const,
    components: data,
    summary: {
      total: filteredComponents.length,
      byCategory,
      classItems: classItemCount,
      nonClassItems: nonClassCount,
      activeCount,
      inactiveCount
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// LSA/FFA MASTER LIST
// ═══════════════════════════════════════════════════════════════

export async function getLsaFfaMasterList(
  vesselId: string,
  equipmentType: string | undefined,
  format: string,
) {
  const allVessels = await repo.getVessels();
  let allComponents: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      allComponents = allComponents.concat(await repo.getComponents(v.id));
    }
  } else {
    allComponents = await repo.getComponents(vesselId);
  }

  const getEffectiveDept = (c: any) => c.eqptSystemDept || c.deptCategory || c.department || '';

  let filteredComponents = allComponents.filter((c: any) => {
    const dept = getEffectiveDept(c);
    return dept === 'LSA' || dept === 'FFA';
  });

  if (equipmentType && equipmentType !== 'all') {
    filteredComponents = filteredComponents.filter((c: any) => getEffectiveDept(c) === equipmentType);
  }

  const data = filteredComponents.map((c: any, i: number) => ({
    sno: i + 1,
    componentCode: c.componentCode || '-',
    componentName: c.name || '-',
    equipmentType: getEffectiveDept(c) || '-',
    location: c.location || '-',
    maker: c.maker || '-',
    model: c.model || '-',
    serialNo: c.serialNo || '-',
    installationDate: c.installationDate || '-',
    critical: c.critical ? 'Yes' : 'No',
    classItem: c.classItem ? 'Yes' : 'No',
    isActive: c.isActive !== false ? 'Yes' : 'No',
    vesselId: c.vesselId || '-'
  }));

  const lsaCount = filteredComponents.filter(c => getEffectiveDept(c) === 'LSA').length;
  const ffaCount = filteredComponents.filter(c => getEffectiveDept(c) === 'FFA').length;
  const activeCount = filteredComponents.filter(c => c.isActive !== false).length;
  const inactiveCount = filteredComponents.filter(c => c.isActive === false).length;

  if (format === 'excel') {
    const columns: ColumnDef[] = [
      { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
      { key: 'componentCode', header: 'Component Code', width: 20, type: 'text' },
      { key: 'componentName', header: 'Component Name', width: 40, type: 'text' },
      { key: 'equipmentType', header: 'Equipment Type', width: 16, type: 'text', align: 'center' },
      { key: 'location', header: 'Location', width: 20, type: 'text' },
      { key: 'maker', header: 'Maker', width: 20, type: 'text' },
      { key: 'model', header: 'Model', width: 20, type: 'text' },
      { key: 'serialNo', header: 'Serial No', width: 18, type: 'text' },
      { key: 'installationDate', header: 'Installation Date', width: 16, type: 'text' },
      { key: 'critical', header: 'Criticality', width: 12, type: 'text', align: 'center' },
      { key: 'classItem', header: 'Class Item', width: 12, type: 'text', align: 'center' },
      { key: 'isActive', header: 'Active', width: 10, type: 'text', align: 'center' }
    ];

    const vesselName = vesselId !== 'all' ? (allVessels.find(v => v.id === vesselId)?.name || vesselId) : 'All Vessels';
    const lastCol = getLastColumnLetter(columns.length);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('LSA-FFA Equipment');

    applyStandardHeader(ws, 'LSA/FFA Equipment Master List', `${data.length} components (LSA: ${lsaCount}, FFA: ${ffaCount})`, vesselName, data.length, lastCol);
    applyStandardTableHeader(ws, columns);
    applyStandardDataRows(ws, data, columns);

    const lastDataRow = 7 + data.length;
    applyStandardPageSetup(ws, 7, columns.length, lastDataRow, vesselName);

    const buffer = await wb.xlsx.writeBuffer();
    const filename = generateFilename('LSA_FFA_Equipment_Master_List', vesselName);

    return {
      type: 'excel' as const,
      buffer: Buffer.from(buffer as ArrayBuffer),
      filename
    };
  }

  return {
    type: 'json' as const,
    components: data,
    summary: {
      total: filteredComponents.length,
      lsaCount,
      ffaCount,
      activeCount,
      inactiveCount
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// LSA/FFA MAINTENANCE SCHEDULE
// ═══════════════════════════════════════════════════════════════

export async function getLsaFfaMaintenanceSchedule(
  vesselId: string,
  statusFilter: string | undefined,
  equipmentType: string | undefined,
  format: string,
) {
  const allVessels = await repo.getVessels();
  let allComponents: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      allComponents = allComponents.concat(await repo.getComponents(v.id));
    }
  } else {
    allComponents = await repo.getComponents(vesselId);
  }

  const getEffectiveDept = (c: any) => c.eqptSystemDept || c.deptCategory || c.department || '';

  let lsaFfaComponents = allComponents.filter((c: any) => {
    const dept = getEffectiveDept(c);
    return dept === 'LSA' || dept === 'FFA';
  });

  if (equipmentType && equipmentType !== 'all') {
    lsaFfaComponents = lsaFfaComponents.filter((c: any) => getEffectiveDept(c) === equipmentType);
  }

  const lsaFfaComponentIds = new Set(lsaFfaComponents.map((c: any) => c.cuuid));
  const lsaFfaComponentMap = new Map(lsaFfaComponents.map((c: any) => [c.cuuid, c]));

  let allJobs: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      const vJobs = await repo.getJobs(v.id);
      allJobs = allJobs.concat(vJobs);
    }
  } else {
    allJobs = await repo.getJobs(vesselId);
  }
  const jobMap = new Map(allJobs.map((j: any) => [j.juuid, j]));

  let allLinks: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      const links = await repo.getJobComponentLinks(v.id);
      allLinks.push(...links);
    }
  } else {
    allLinks = await repo.getJobComponentLinks(vesselId);
  }

  let allWorkOrders: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      const wos = await repo.getWorkOrders(v.id);
      allWorkOrders = allWorkOrders.concat(wos);
    }
  } else {
    allWorkOrders = await repo.getWorkOrders(vesselId);
  }
  const woByJobId = new Map<string, any[]>();
  for (const wo of allWorkOrders) {
    const jobId = wo.jobId;
    if (jobId) {
      const existing = woByJobId.get(jobId) || [];
      existing.push(wo);
      woByJobId.set(jobId, existing);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDateStr = (d: string | null | undefined) => {
    if (!d) return '-';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${date.getDate().toString().padStart(2,'0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
    } catch { return d; }
  };

  const scheduleItems: any[] = [];

  for (const link of allLinks) {
    if (!lsaFfaComponentIds.has(link.componentId)) continue;

    const comp = lsaFfaComponentMap.get(link.componentId);
    const job = jobMap.get(link.jobId);
    if (!comp || !job) continue;

    const nextDueDateStr = link.nextDueDate || job.nextDueDate;
    let daysUntilDue: number | null = null;
    let status = 'On Schedule';

    if (nextDueDateStr) {
      const nextDueDate = new Date(nextDueDateStr);
      if (!isNaN(nextDueDate.getTime())) {
        nextDueDate.setHours(0, 0, 0, 0);
        daysUntilDue = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue < 0) {
          status = 'Overdue';
        } else if (daysUntilDue <= 30) {
          status = 'Due Soon';
        } else {
          status = 'On Schedule';
        }
      }
    }

    const jobWorkOrders = woByJobId.get(job.juuid) || [];
    const sortedWOs = jobWorkOrders.sort((a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    const lastWO = sortedWOs[0];

    const lastDoneDateStr = link.lastDoneDate || job.lastDoneDate;
    const freq = job.frequencyValue ? `${job.frequencyValue} ${job.frequencyUnit || ''}`.trim() : '-';

    scheduleItems.push({
      componentId: comp.cuuid,
      jobId: job.juuid,
      componentCode: comp.componentCode || '-',
      componentName: comp.name || '-',
      equipmentType: getEffectiveDept(comp) || '-',
      location: comp.location || '-',
      jobCode: job.jobNo || '-',
      jobTitle: job.jobTitle || '-',
      taskType: job.maintenanceType || '-',
      maintenanceBasis: job.maintenanceBasis || '-',
      frequency: freq,
      nextDueDate: formatDateStr(nextDueDateStr),
      daysUntilDue: daysUntilDue !== null ? daysUntilDue : '-',
      status,
      lastDoneDate: formatDateStr(lastDoneDateStr),
      lastWONumber: lastWO?.workOrderNo || '-',
      assignedTo: job.assignedTo || '-'
    });
  }

  if (statusFilter && statusFilter !== 'all') {
    const statusMap: Record<string, string> = {
      'on-schedule': 'On Schedule',
      'due-soon': 'Due Soon',
      'overdue': 'Overdue'
    };
    const filterValue = statusMap[statusFilter];
    if (filterValue) {
      const filtered = scheduleItems.filter(item => item.status === filterValue);
      scheduleItems.length = 0;
      scheduleItems.push(...filtered);
    }
  }

  scheduleItems.sort((a, b) => {
    const dateA = a.nextDueDate !== '-' ? new Date(a.nextDueDate).getTime() : Infinity;
    const dateB = b.nextDueDate !== '-' ? new Date(b.nextDueDate).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;
    return (a.componentCode || '').localeCompare(b.componentCode || '');
  });

  scheduleItems.forEach((item, i) => { item.sno = i + 1; });

  const onScheduleCount = scheduleItems.filter(i => i.status === 'On Schedule').length;
  const dueSoonCount = scheduleItems.filter(i => i.status === 'Due Soon').length;
  const overdueCount = scheduleItems.filter(i => i.status === 'Overdue').length;

  if (format === 'excel') {
    const columns: ColumnDef[] = [
      { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
      { key: 'componentCode', header: 'Comp Code', width: 16, type: 'text' },
      { key: 'componentName', header: 'Component Name', width: 30, type: 'text' },
      { key: 'equipmentType', header: 'Equipment Type', width: 14, type: 'text', align: 'center' },
      { key: 'location', header: 'Location', width: 18, type: 'text' },
      { key: 'jobCode', header: 'Job Code', width: 16, type: 'text' },
      { key: 'jobTitle', header: 'Job Title', width: 35, type: 'text' },
      { key: 'taskType', header: 'Task Type', width: 16, type: 'text' },
      { key: 'maintenanceBasis', header: 'Basis', width: 14, type: 'text' },
      { key: 'frequency', header: 'Frequency', width: 14, type: 'text' },
      { key: 'nextDueDate', header: 'Next Due Date', width: 16, type: 'text' },
      { key: 'daysUntilDue', header: 'Days', width: 10, type: 'number', align: 'center' },
      { key: 'status', header: 'Status', width: 14, type: 'text', align: 'center' },
      { key: 'lastDoneDate', header: 'Last Done', width: 16, type: 'text' },
      { key: 'lastWONumber', header: 'Last WO', width: 18, type: 'text' },
      { key: 'assignedTo', header: 'Assigned To', width: 16, type: 'text' }
    ];

    const conditionalStyles: ConditionalStyle[] = [
      {
        condition: (row: any) => row.status === 'Overdue',
        style: 'danger'
      },
      {
        condition: (row: any) => row.status === 'Due Soon',
        style: 'warning'
      }
    ];

    const vesselName = vesselId !== 'all' ? (allVessels.find(v => v.id === vesselId)?.name || vesselId) : 'All Vessels';
    const lastCol = getLastColumnLetter(columns.length);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('LSA-FFA Maintenance Schedule');

    applyStandardHeader(ws, 'LSA/FFA Maintenance Schedule & Status', `${scheduleItems.length} schedule items`, vesselName, scheduleItems.length, lastCol);
    applyStandardTableHeader(ws, columns);
    applyStandardDataRows(ws, scheduleItems, columns, 8, conditionalStyles);

    const lastDataRow = 7 + scheduleItems.length;
    applyStandardPageSetup(ws, 7, columns.length, lastDataRow, vesselName);

    const buffer = await wb.xlsx.writeBuffer();
    const filename = generateFilename('LSA_FFA_Maintenance_Schedule', vesselName);

    return {
      type: 'excel' as const,
      buffer: Buffer.from(buffer as ArrayBuffer),
      filename
    };
  }

  return {
    type: 'json' as const,
    scheduleItems,
    summary: {
      total: scheduleItems.length,
      onSchedule: onScheduleCount,
      dueSoon: dueSoonCount,
      overdue: overdueCount
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL EQUIPMENT SCHEDULE
// ═══════════════════════════════════════════════════════════════

export async function getCriticalEquipmentSchedule(
  vesselId: string,
  statusFilter: string | undefined,
  category: string | undefined,
  format: string,
) {
  const allVessels = await repo.getVessels();
  let allComponents: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      allComponents = allComponents.concat(await repo.getComponents(v.id));
    }
  } else {
    allComponents = await repo.getComponents(vesselId);
  }

  let criticalComponents = allComponents.filter((c: any) => c.critical === true);
  if (category) {
    criticalComponents = criticalComponents.filter((c: any) => c.category === category);
  }

  const criticalComponentIds = new Set(criticalComponents.map((c: any) => c.cuuid));
  const criticalComponentMap = new Map(criticalComponents.map((c: any) => [c.cuuid, c]));

  let allJobs: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      const vJobs = await repo.getJobs(v.id);
      allJobs = allJobs.concat(vJobs);
    }
  } else {
    allJobs = await repo.getJobs(vesselId);
  }
  const jobMap = new Map(allJobs.map((j: any) => [j.juuid, j]));

  let allLinks: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      const links = await repo.getJobComponentLinks(v.id);
      allLinks.push(...links);
    }
  } else {
    allLinks = await repo.getJobComponentLinks(vesselId);
  }

  let allWorkOrders: any[] = [];
  if (vesselId === 'all') {
    for (const v of allVessels) {
      const wos = await repo.getWorkOrders(v.id);
      allWorkOrders = allWorkOrders.concat(wos);
    }
  } else {
    allWorkOrders = await repo.getWorkOrders(vesselId);
  }
  const woByJobId = new Map<string, any[]>();
  for (const wo of allWorkOrders) {
    const jobId = wo.jobId;
    if (jobId) {
      const existing = woByJobId.get(jobId) || [];
      existing.push(wo);
      woByJobId.set(jobId, existing);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDateStr = (d: string | null | undefined) => {
    if (!d) return '-';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${date.getDate().toString().padStart(2,'0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
    } catch { return d; }
  };

  const scheduleItems: any[] = [];

  for (const link of allLinks) {
    if (!criticalComponentIds.has(link.componentId)) continue;

    const comp = criticalComponentMap.get(link.componentId);
    const job = jobMap.get(link.jobId);
    if (!comp || !job) continue;

    const nextDueDateStr = link.nextDueDate || job.nextDueDate;
    let daysUntilDue: number | null = null;
    let status = 'On Schedule';

    if (nextDueDateStr) {
      const nextDueDate = new Date(nextDueDateStr);
      if (!isNaN(nextDueDate.getTime())) {
        nextDueDate.setHours(0, 0, 0, 0);
        daysUntilDue = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue < 0) {
          status = 'Overdue';
        } else if (daysUntilDue <= 7) {
          status = 'Due Soon';
        } else {
          status = 'On Schedule';
        }
      }
    }

    const jobWorkOrders = woByJobId.get(job.juuid) || [];
    const sortedWOs = jobWorkOrders.sort((a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    const lastWO = sortedWOs[0];

    const lastDoneDateStr = link.lastDoneDate || job.lastDoneDate;
    const freq = job.frequencyValue ? `${job.frequencyValue} ${job.frequencyUnit || ''}`.trim() : '-';

    scheduleItems.push({
      componentId: comp.cuuid,
      jobId: job.juuid,
      componentCode: comp.componentCode || '-',
      componentName: comp.name || '-',
      location: comp.location || '-',
      jobCode: job.jobNo || '-',
      jobTitle: job.jobTitle || '-',
      taskType: job.maintenanceType || '-',
      maintenanceBasis: job.maintenanceBasis || '-',
      frequency: freq,
      nextDueDate: formatDateStr(nextDueDateStr),
      daysUntilDue: daysUntilDue !== null ? daysUntilDue : '-',
      status,
      lastDoneDate: formatDateStr(lastDoneDateStr),
      lastWONumber: lastWO?.workOrderNo || '-',
      lastWOStatus: lastWO?.status || '-',
      assignedTo: job.assignedTo || '-',
      estimatedManHours: '-',
      runningHours: comp.currentCumulativeRH || '-'
    });
  }

  if (statusFilter && statusFilter !== 'all') {
    const statusMap: Record<string, string> = {
      'on-schedule': 'On Schedule',
      'due-soon': 'Due Soon',
      'overdue': 'Overdue'
    };
    const filterValue = statusMap[statusFilter];
    if (filterValue) {
      const filtered = scheduleItems.filter(item => item.status === filterValue);
      scheduleItems.length = 0;
      scheduleItems.push(...filtered);
    }
  }

  scheduleItems.sort((a, b) => {
    const dateA = a.nextDueDate !== '-' ? new Date(a.nextDueDate).getTime() : Infinity;
    const dateB = b.nextDueDate !== '-' ? new Date(b.nextDueDate).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;
    return (a.componentCode || '').localeCompare(b.componentCode || '');
  });

  scheduleItems.forEach((item, i) => { item.sno = i + 1; });

  const onScheduleCount = scheduleItems.filter(i => i.status === 'On Schedule').length;
  const dueSoonCount = scheduleItems.filter(i => i.status === 'Due Soon').length;
  const overdueCount = scheduleItems.filter(i => i.status === 'Overdue').length;
  const numericDays = scheduleItems.filter(i => typeof i.daysUntilDue === 'number').map(i => i.daysUntilDue as number);
  const avgDaysUntilDue = numericDays.length > 0 ? Math.round(numericDays.reduce((a: number, b: number) => a + b, 0) / numericDays.length) : 0;

  if (format === 'excel') {
    const columns: ColumnDef[] = [
      { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
      { key: 'componentCode', header: 'Comp Code', width: 16, type: 'text' },
      { key: 'componentName', header: 'Component Name', width: 30, type: 'text' },
      { key: 'location', header: 'Location', width: 18, type: 'text' },
      { key: 'jobCode', header: 'Job Code', width: 16, type: 'text' },
      { key: 'jobTitle', header: 'Job Title', width: 35, type: 'text' },
      { key: 'taskType', header: 'Task Type', width: 16, type: 'text' },
      { key: 'maintenanceBasis', header: 'Maint. Basis', width: 14, type: 'text' },
      { key: 'frequency', header: 'Frequency', width: 14, type: 'text' },
      { key: 'nextDueDate', header: 'Next Due Date', width: 16, type: 'text' },
      { key: 'daysUntilDue', header: 'Days Until Due', width: 14, type: 'number', align: 'center' },
      { key: 'status', header: 'Status', width: 14, type: 'text', align: 'center' },
      { key: 'lastDoneDate', header: 'Last Done', width: 16, type: 'text' },
      { key: 'lastWONumber', header: 'Last WO No', width: 18, type: 'text' },
      { key: 'lastWOStatus', header: 'Last WO Status', width: 14, type: 'text' },
      { key: 'assignedTo', header: 'Assigned To', width: 16, type: 'text' },
      { key: 'estimatedManHours', header: 'Man-Hours', width: 12, type: 'number', align: 'center' },
      { key: 'runningHours', header: 'Running Hours', width: 14, type: 'text' }
    ];

    const conditionalStyles: ConditionalStyle[] = [
      {
        condition: (row: any) => row.status === 'Overdue',
        style: 'danger'
      },
      {
        condition: (row: any) => row.status === 'Due Soon',
        style: 'warning'
      }
    ];

    const vesselName = vesselId !== 'all' ? (allVessels.find(v => v.id === vesselId)?.name || vesselId) : 'All Vessels';
    const lastCol = getLastColumnLetter(columns.length);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Critical Equipment Schedule');

    applyStandardHeader(ws, 'Critical Equipment Maintenance Schedule', `${scheduleItems.length} schedule items`, vesselName, scheduleItems.length, lastCol);
    applyStandardTableHeader(ws, columns);
    applyStandardDataRows(ws, scheduleItems, columns, 8, conditionalStyles);

    const lastDataRow = 7 + scheduleItems.length;
    applyStandardPageSetup(ws, 7, columns.length, lastDataRow, vesselName);

    const buffer = await wb.xlsx.writeBuffer();
    const filename = generateFilename('Critical_Equipment_Schedule', vesselName);

    return {
      type: 'excel' as const,
      buffer: Buffer.from(buffer as ArrayBuffer),
      filename
    };
  }

  return {
    type: 'json' as const,
    scheduleItems,
    summary: {
      total: scheduleItems.length,
      onSchedule: onScheduleCount,
      dueSoon: dueSoonCount,
      overdue: overdueCount,
      avgDaysUntilDue
    }
  };
}
