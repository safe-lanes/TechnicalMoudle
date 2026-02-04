import ExcelJS from 'exceljs';

// ═══════════════════════════════════════════════════════════════
// PROFESSIONAL MARITIME THEME - STANDARD COLOR PALETTE
// Matches the PMS application UI theme
// ═══════════════════════════════════════════════════════════════

export const COLORS = {
  // Primary colors (match app sidebar/headers)
  primary: 'FF1E5A8E',      // Deep blue - sidebar color
  secondary: 'FF5DADE2',    // Light blue - table headers
  
  // Status colors
  success: 'FF52C41A',      // Green
  warning: 'FFFAAD14',      // Amber
  danger: 'FFF5222D',       // Red - USE SPARINGLY
  
  // Text colors
  textDark: 'FF2C3E50',     // Dark blue-gray
  textLight: 'FF5A6C7D',    // Medium gray
  textWhite: 'FFFFFFFF',    // White
  
  // Background colors (subtle)
  bgLight: 'FFF7F9FC',      // Very light blue-gray (alternating rows)
  bgWhite: 'FFFFFFFF',      // White
  bgSuccess: 'FFF6FFED',    // Very light green (completed items)
  bgWarning: 'FFFFFBE6',    // Very light amber (warnings)
  bgDanger: 'FFFFF1F0',     // Very light red (critical items ONLY)
  
  // Border colors
  border: 'FFE1E8ED',       // Light gray
  borderMedium: 'FF1E5A8E', // Deep blue for emphasis
};

// ═══════════════════════════════════════════════════════════════
// MAINTENANCE WORK ORDER REPORT - STATUS-BASED COLOR PALETTE
// Full-row highlighting based on Status + Critical Equipment
// ═══════════════════════════════════════════════════════════════

export const STATUS_COLORS = {
  // Due Jobs (Orange variants)
  dueLight: 'FFFFE4B5',        // Light Orange #FFE4B5 - Due Jobs (non-critical)
  dueDark: 'FFFF8C00',         // Dark Orange #FF8C00 - Due Jobs (critical equipment)
  
  // Overdue Jobs (Red variants)
  overdueLight: 'FFFFB6C1',    // Light Red #FFB6C1 - Overdue Jobs (non-critical)
  overdueDark: 'FFDC143C',     // Dark Red (Crimson) #DC143C - Overdue Jobs (critical equipment)
  
  // Completed Jobs (Green variants)
  completedLight: 'FF90EE90',  // Light Green #90EE90 - Completed Jobs (non-critical)
  completedDark: 'FF228B22',   // Dark Green (Forest Green) #228B22 - Completed Jobs (critical equipment)
  
  // Special Status Colors
  unplanned: 'FFFFFF00',       // Yellow #FFFF00 - Unplanned/Breakdown Jobs
  postponed: 'FF87CEEB',       // Sky Blue #87CEEB - Postponed Jobs
  
  // Text colors for dark backgrounds (need white text)
  textOnDark: 'FFFFFFFF',      // White text for dark backgrounds
  textOnLight: 'FF2C3E50',     // Dark text for light backgrounds
};

// Report-specific accent colors (only used for summary section emphasis)
export const REPORT_ACCENTS = {
  dueJobs: COLORS.secondary,     // Blue accent
  overdueJobs: COLORS.warning,   // Amber accent (NOT red!)
  completedJobs: COLORS.success, // Green accent
  default: COLORS.secondary,     // Blue accent
};

// ═══════════════════════════════════════════════════════════════
// STANDARD 18-COLUMN DEFINITION FOR MAINTENANCE WORK ORDER REPORTS
// Used by ALL Maintenance & Work Order reports (except Man-Hours & Workload)
// ═══════════════════════════════════════════════════════════════

export const STANDARD_WORK_ORDER_COLUMNS: ColumnDef[] = [
  { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
  { key: 'workOrderNo', header: 'Work Order No', width: 18, type: 'text' },
  { key: 'jobCode', header: 'Job Code', width: 14, type: 'text' },
  { key: 'jobTitle', header: 'Job Title', width: 35, type: 'text' },
  { key: 'componentCode', header: 'Comp Code', width: 14, type: 'text' },
  { key: 'componentName', header: 'Component Name', width: 28, type: 'text' },
  { key: 'department', header: 'Dept', width: 10, type: 'text', align: 'center' },
  { key: 'priority', header: 'Priority', width: 10, type: 'text', align: 'center' },
  { key: 'status', header: 'Status', width: 12, type: 'text', align: 'center' },
  { key: 'dueDate', header: 'Due Date', width: 12, type: 'date', align: 'center' },
  { key: 'lastDoneDate', header: 'Last Done', width: 12, type: 'date', align: 'center' },
  { key: 'daysLeft', header: 'Days Left', width: 10, type: 'number', align: 'right' },
  { key: 'daysOverdue', header: 'Days Overdue', width: 12, type: 'number', align: 'right' },
  { key: 'nextDueRH', header: 'Next Due RH', width: 12, type: 'number', align: 'right' },
  { key: 'currentRH', header: 'Current RH', width: 12, type: 'number', align: 'right' },
  { key: 'rhRemaining', header: 'RH Remaining', width: 12, type: 'number', align: 'right' },
  { key: 'assignedTo', header: 'Assigned To', width: 16, type: 'text' },
  { key: 'criticalEquipment', header: 'Critical Equip', width: 12, type: 'text', align: 'center' },
];

// Work Order Status Types for row highlighting
export type WorkOrderStatus = 
  | 'due'           // Due within threshold (Light Orange / Dark Orange if critical)
  | 'overdue'       // Past due date (Light Red / Dark Red if critical)
  | 'completed'     // Completed (Light Green / Dark Green if critical)
  | 'unplanned'     // Unplanned/Breakdown (Yellow)
  | 'postponed'     // Postponed (Sky Blue)
  | 'active';       // Normal active (alternating white/gray)

export interface WorkOrderRowData {
  _rowStatus: WorkOrderStatus;  // Internal field for row highlighting (underscore prefix)
  isCriticalEquipment: boolean;
  [key: string]: any;
}

export interface ReportConfig {
  sheetName: string;
  reportTitle: string;
  reportSubtitle: string;
  vesselName: string;
  totalColumns: number;
  columns: ColumnDef[];
  data: any[];
  summary: SummaryItem[];
  reportType?: 'dueJobs' | 'overdueJobs' | 'completedJobs' | 'default';
}

export interface ColumnDef {
  key: string;
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  type?: 'text' | 'number' | 'date';
}

export interface SummaryItem {
  label: string;
  value: string | number;
  highlight?: boolean; // If true, use red color for value
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: REPORT HEADER (Rows 1-6)
// ═══════════════════════════════════════════════════════════════

export function applyStandardHeader(
  worksheet: ExcelJS.Worksheet,
  reportTitle: string,
  reportSubtitle: string,
  vesselName: string,
  totalRecords: number,
  lastColumn: string
): void {
  const reportDate = new Date();
  const formatDate = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate().toString().padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Row 1: Company/System Title - Deep Blue background
  worksheet.mergeCells(`A1:${lastColumn}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'SEAFARER TECHNICAL MANAGEMENT SYSTEM';
  titleCell.font = { size: 14, bold: true, color: { argb: COLORS.textWhite }, name: 'Arial' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.primary }
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Row 2: Report Title - Light gray background with deep blue text
  worksheet.mergeCells(`A2:${lastColumn}2`);
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = reportTitle;
  subtitleCell.font = { size: 12, bold: true, color: { argb: COLORS.textDark }, name: 'Arial' };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.bgLight }
  };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleCell.border = {
    bottom: { style: 'medium', color: { argb: COLORS.primary } }
  };
  worksheet.getRow(2).height = 25;

  // Row 3: Empty separator
  worksheet.getRow(3).height = 10;

  // Row 4: Vessel & Date Info
  worksheet.getCell('A4').value = `Vessel: ${vesselName}`;
  worksheet.getCell('A4').font = { bold: true, size: 10, color: { argb: COLORS.textDark }, name: 'Arial' };
  
  // Right side - Report Date (merge last 3 columns)
  const dateColStart = String.fromCharCode(lastColumn.charCodeAt(0) - 2);
  worksheet.mergeCells(`${dateColStart}4:${lastColumn}4`);
  worksheet.getCell(`${dateColStart}4`).value = `Report Date: ${formatDate(reportDate)}`;
  worksheet.getCell(`${dateColStart}4`).font = { size: 10, color: { argb: COLORS.textLight }, name: 'Arial' };
  worksheet.getCell(`${dateColStart}4`).alignment = { horizontal: 'right' };
  worksheet.getRow(4).height = 18;

  // Row 5: Generated By & Total Records
  worksheet.getCell('A5').value = 'Generated By: PMS System';
  worksheet.getCell('A5').font = { size: 9, color: { argb: COLORS.textLight }, name: 'Arial' };
  
  worksheet.mergeCells(`${dateColStart}5:${lastColumn}5`);
  worksheet.getCell(`${dateColStart}5`).value = `Total Records: ${totalRecords}`;
  worksheet.getCell(`${dateColStart}5`).font = { bold: true, size: 9, color: { argb: COLORS.primary }, name: 'Arial' };
  worksheet.getCell(`${dateColStart}5`).alignment = { horizontal: 'right' };
  worksheet.getRow(5).height = 18;

  // Row 6: Empty separator
  worksheet.getRow(6).height = 5;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2: TABLE HEADER (Row 7) - Light Blue
// ═══════════════════════════════════════════════════════════════

export function applyStandardTableHeader(
  worksheet: ExcelJS.Worksheet,
  columns: ColumnDef[],
  headerRowNum: number = 7
): void {
  // Set column widths
  columns.forEach((col, idx) => {
    worksheet.getColumn(idx + 1).width = col.width;
  });

  // Add header values
  const headerRow = worksheet.getRow(headerRowNum);
  columns.forEach((col, idx) => {
    headerRow.getCell(idx + 1).value = col.header;
  });

  // Style header row - Light Blue (#5DADE2)
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber <= columns.length) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.secondary }
      };
      cell.font = { bold: true, color: { argb: COLORS.textWhite }, size: 10, name: 'Arial' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.textWhite } },
        left: { style: 'thin', color: { argb: COLORS.textWhite } },
        bottom: { style: 'thin', color: { argb: COLORS.textWhite } },
        right: { style: 'thin', color: { argb: COLORS.textWhite } }
      };
    }
  });
  headerRow.height = 25;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3: DATA ROWS - Subtle alternating with conditional styling
// ═══════════════════════════════════════════════════════════════

export interface ConditionalStyle {
  condition: (row: any) => boolean;
  style: 'success' | 'warning' | 'danger';
  textOnly?: boolean; // If true, only style text, not background
}

export function applyStandardDataRows(
  worksheet: ExcelJS.Worksheet,
  data: any[],
  columns: ColumnDef[],
  dataStartRow: number = 8,
  conditionalStyles?: ConditionalStyle[]
): void {
  if (data.length === 0) {
    const emptyRow = worksheet.getRow(dataStartRow);
    emptyRow.getCell(1).value = 'No records found';
    worksheet.mergeCells(dataStartRow, 1, dataStartRow, columns.length);
    emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    emptyRow.getCell(1).font = { italic: true, color: { argb: COLORS.textLight }, size: 11, name: 'Arial' };
    emptyRow.height = 30;
    return;
  }

  data.forEach((record, index) => {
    const rowNum = dataStartRow + index;
    const row = worksheet.getRow(rowNum);
    
    // Set cell values
    columns.forEach((col, colIdx) => {
      const cellValue = record[col.key];
      row.getCell(colIdx + 1).value = cellValue !== undefined && cellValue !== null ? cellValue : '-';
    });

    row.height = 20;

    // Determine base background color (alternating)
    const isEvenRow = index % 2 === 1;
    const baseColor = isEvenRow ? COLORS.bgLight : COLORS.bgWhite;

    // Check for conditional styles
    let appliedStyle: 'success' | 'warning' | 'danger' | null = null;
    let textOnly = false;
    
    if (conditionalStyles) {
      for (const cs of conditionalStyles) {
        if (cs.condition(record)) {
          appliedStyle = cs.style;
          textOnly = cs.textOnly || false;
          break; // Apply first matching condition only
        }
      }
    }

    // Apply styling to each cell
    row.eachCell((cell, colNum) => {
      if (colNum > columns.length) return;

      const colDef = columns[colNum - 1];
      
      // Background color
      let bgColor = baseColor;
      let fontColor = COLORS.textDark;
      let isBold = false;

      if (appliedStyle && !textOnly) {
        switch (appliedStyle) {
          case 'success':
            bgColor = COLORS.bgSuccess;
            fontColor = COLORS.success;
            break;
          case 'warning':
            bgColor = COLORS.bgWarning;
            fontColor = 'FF9C6500'; // Dark orange
            isBold = true;
            break;
          case 'danger':
            bgColor = COLORS.bgDanger;
            fontColor = 'FF9C0006'; // Dark red
            isBold = true;
            break;
        }
      }

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };

      cell.font = { 
        color: { argb: fontColor }, 
        size: 9, 
        name: 'Arial',
        bold: isBold
      };

      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.border } },
        left: { style: 'thin', color: { argb: COLORS.border } },
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } }
      };

      // Alignment based on column type
      if (colDef.type === 'number' || colDef.align === 'right') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colDef.type === 'date' || colDef.align === 'center') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: SUMMARY SECTION
// ═══════════════════════════════════════════════════════════════

export function applyStandardSummary(
  worksheet: ExcelJS.Worksheet,
  summary: SummaryItem[],
  startRow: number,
  totalColumns: number,
  actionNote?: string
): number {
  // Add thick border line above summary
  for (let col = 1; col <= totalColumns; col++) {
    const borderCell = worksheet.getRow(startRow - 1).getCell(col);
    borderCell.border = {
      bottom: { style: 'medium', color: { argb: COLORS.primary } }
    };
  }

  // Summary Header
  worksheet.getCell(`A${startRow}`).value = 'SUMMARY:';
  worksheet.getCell(`A${startRow}`).font = { bold: true, size: 11, color: { argb: COLORS.primary }, name: 'Arial' };
  worksheet.getCell(`A${startRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.bgLight }
  };

  // Summary items
  summary.forEach((item, idx) => {
    const rowNum = startRow + 1 + idx;
    worksheet.getCell(`A${rowNum}`).value = item.label;
    worksheet.getCell(`A${rowNum}`).font = { size: 9, color: { argb: COLORS.textDark }, name: 'Arial' };
    
    worksheet.getCell(`B${rowNum}`).value = item.value;
    worksheet.getCell(`B${rowNum}`).font = { 
      bold: true, 
      size: 9, 
      name: 'Arial',
      color: item.highlight && Number(item.value) > 0 
        ? { argb: COLORS.danger } 
        : { argb: COLORS.primary }
    };
  });

  let lastRow = startRow + summary.length;

  // Action note (optional)
  if (actionNote) {
    lastRow += 2;
    const lastColLetter = String.fromCharCode('A'.charCodeAt(0) + totalColumns - 1);
    worksheet.mergeCells(`A${lastRow}:${lastColLetter}${lastRow}`);
    
    const noteCell = worksheet.getCell(`A${lastRow}`);
    noteCell.value = actionNote;
    noteCell.font = { size: 9, italic: true, color: { argb: COLORS.textLight }, name: 'Arial' };
    noteCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.bgWarning }
    };
    noteCell.alignment = { horizontal: 'left', vertical: 'middle' };
    noteCell.border = {
      top: { style: 'medium', color: { argb: COLORS.warning } },
      bottom: { style: 'medium', color: { argb: COLORS.warning } },
      left: { style: 'medium', color: { argb: COLORS.warning } },
      right: { style: 'medium', color: { argb: COLORS.warning } }
    };
    worksheet.getRow(lastRow).height = 25;
  }

  return lastRow;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5: PAGE SETUP
// ═══════════════════════════════════════════════════════════════

export function applyStandardPageSetup(
  worksheet: ExcelJS.Worksheet,
  headerRowNum: number,
  totalColumns: number,
  lastRow: number,
  vesselName: string
): void {
  const lastColLetter = String.fromCharCode('A'.charCodeAt(0) + totalColumns - 1);

  worksheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:${lastColLetter}${lastRow}`,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3
    }
  };

  // Print title rows
  worksheet.pageSetup.printTitlesRow = `${headerRowNum}:${headerRowNum}`;

  // Footer
  worksheet.headerFooter = {
    oddFooter: `&L&8&"Arial"Confidential - ${vesselName}&C&8&"Arial"Page &P of &N&R&8&"Arial"Generated: &D &T`
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: Generate professional filename
// ═══════════════════════════════════════════════════════════════

export function generateFilename(reportName: string, vesselName: string): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
  const timeStr = `${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
  const safeVesselName = vesselName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeReportName = reportName.replace(/[^a-zA-Z0-9]/g, '');
  return `PMS_${safeReportName}_${safeVesselName}_${dateStr}_${timeStr}.xlsx`;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: Get last column letter from column count
// ═══════════════════════════════════════════════════════════════

export function getLastColumnLetter(columnCount: number): string {
  if (columnCount <= 26) {
    return String.fromCharCode('A'.charCodeAt(0) + columnCount - 1);
  }
  // Handle columns beyond Z (AA, AB, etc.)
  const first = Math.floor((columnCount - 1) / 26);
  const second = (columnCount - 1) % 26;
  return String.fromCharCode('A'.charCodeAt(0) + first - 1) + String.fromCharCode('A'.charCodeAt(0) + second);
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6: STATUS-BASED ROW HIGHLIGHTING FOR WORK ORDER REPORTS
// Full-row color based on Status + Critical Equipment combination
// ═══════════════════════════════════════════════════════════════

export function getStatusRowColors(status: WorkOrderStatus, isCriticalEquipment: boolean): {
  bgColor: string;
  textColor: string;
} {
  switch (status) {
    case 'due':
      return {
        bgColor: isCriticalEquipment ? STATUS_COLORS.dueDark : STATUS_COLORS.dueLight,
        textColor: isCriticalEquipment ? STATUS_COLORS.textOnDark : STATUS_COLORS.textOnLight
      };
    case 'overdue':
      return {
        bgColor: isCriticalEquipment ? STATUS_COLORS.overdueDark : STATUS_COLORS.overdueLight,
        textColor: isCriticalEquipment ? STATUS_COLORS.textOnDark : STATUS_COLORS.textOnLight
      };
    case 'completed':
      return {
        bgColor: isCriticalEquipment ? STATUS_COLORS.completedDark : STATUS_COLORS.completedLight,
        textColor: isCriticalEquipment ? STATUS_COLORS.textOnDark : STATUS_COLORS.textOnLight
      };
    case 'unplanned':
      return {
        bgColor: STATUS_COLORS.unplanned,
        textColor: STATUS_COLORS.textOnLight
      };
    case 'postponed':
      return {
        bgColor: STATUS_COLORS.postponed,
        textColor: STATUS_COLORS.textOnLight
      };
    case 'active':
    default:
      return {
        bgColor: COLORS.bgWhite,
        textColor: COLORS.textDark
      };
  }
}

export function applyWorkOrderDataRows(
  worksheet: ExcelJS.Worksheet,
  data: WorkOrderRowData[],
  columns: ColumnDef[],
  dataStartRow: number = 8
): void {
  if (data.length === 0) {
    const emptyRow = worksheet.getRow(dataStartRow);
    emptyRow.getCell(1).value = 'No records found';
    worksheet.mergeCells(dataStartRow, 1, dataStartRow, columns.length);
    emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    emptyRow.getCell(1).font = { italic: true, color: { argb: COLORS.textLight }, size: 11, name: 'Arial' };
    emptyRow.height = 30;
    return;
  }

  data.forEach((record, index) => {
    const rowNum = dataStartRow + index;
    const row = worksheet.getRow(rowNum);
    
    // Set cell values
    columns.forEach((col, colIdx) => {
      const cellValue = record[col.key];
      row.getCell(colIdx + 1).value = cellValue !== undefined && cellValue !== null ? cellValue : '-';
    });

    row.height = 20;

    // Get status-based colors using _rowStatus field
    const { bgColor, textColor } = getStatusRowColors(record._rowStatus, record.isCriticalEquipment);

    // Apply styling to each cell in the row
    row.eachCell((cell, colNum) => {
      if (colNum > columns.length) return;

      const colDef = columns[colNum - 1];
      
      // Apply background color
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };

      // Apply text color and font
      cell.font = { 
        color: { argb: textColor }, 
        size: 9, 
        name: 'Arial',
        bold: record.status === 'overdue' || record.isCriticalEquipment
      };

      // Apply border
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.border } },
        left: { style: 'thin', color: { argb: COLORS.border } },
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } }
      };

      // Alignment based on column type
      if (colDef.type === 'number' || colDef.align === 'right') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colDef.type === 'date' || colDef.align === 'center') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: Prepare standard work order data for Excel export
// Maps raw work order data to the standard 18-column format
// ═══════════════════════════════════════════════════════════════

export interface RawWorkOrderData {
  workOrderNo: string;
  jobCode?: string;
  jobTitle: string;
  componentCode?: string;
  componentName?: string;
  department?: string;
  priority?: string;
  woStatus?: string;
  dueDate?: string | Date | null;
  lastDoneDate?: string | Date | null;
  daysRemaining?: number | null;
  daysOverdue?: number | null;
  nextDueRH?: number | string | null;
  currentRH?: number | string | null;
  rhRemaining?: number | null;
  assignedTo?: string;
  isCriticalEquipment?: boolean;
  maintenanceBasis?: string;
  isUnplanned?: boolean;
  isPostponed?: boolean;
}

export function prepareStandardWorkOrderData(
  rawData: RawWorkOrderData[],
  reportType: 'due' | 'overdue' | 'completed' | 'unplanned' | 'postponed' | 'active'
): WorkOrderRowData[] {
  return rawData.map((item, index) => {
    const isCritical = item.isCriticalEquipment === true;
    const isCalendarBased = item.maintenanceBasis === 'Calendar';
    
    // Determine status for row highlighting
    let status: WorkOrderStatus = reportType;
    if (item.isUnplanned) status = 'unplanned';
    if (item.isPostponed) status = 'postponed';
    
    // Days Left vs Days Overdue are mutually exclusive
    const daysLeft = (item.daysRemaining !== null && item.daysRemaining !== undefined && item.daysRemaining >= 0) 
      ? item.daysRemaining 
      : '-';
    const daysOverdue = (item.daysOverdue !== null && item.daysOverdue !== undefined && item.daysOverdue > 0)
      ? item.daysOverdue
      : '-';
    
    // Running Hours columns show "-" for Calendar-based jobs
    const nextDueRH = isCalendarBased ? '-' : (item.nextDueRH ?? '-');
    const currentRH = isCalendarBased ? '-' : (item.currentRH ?? '-');
    const rhRemaining = isCalendarBased ? '-' : (item.rhRemaining ?? '-');
    
    return {
      sno: index + 1,
      workOrderNo: item.workOrderNo || '-',
      jobCode: item.jobCode || '-',
      jobTitle: item.jobTitle || '-',
      componentCode: item.componentCode || '-',
      componentName: item.componentName || '-',
      department: item.department || '-',
      priority: item.priority || '-',
      status: item.woStatus || '-',
      dueDate: item.dueDate || '-',
      lastDoneDate: item.lastDoneDate || '-',
      daysLeft,
      daysOverdue,
      nextDueRH,
      currentRH,
      rhRemaining,
      assignedTo: item.assignedTo || '-',
      criticalEquipment: isCritical ? 'YES' : 'No',
      isCriticalEquipment: isCritical,
      _rowStatus: status
    } as WorkOrderRowData;
  });
}
