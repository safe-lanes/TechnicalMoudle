import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════
// PROFESSIONAL MARITIME THEME - STANDARD COLOR PALETTE
// Matches the PMS application UI theme and Excel reports
// ═══════════════════════════════════════════════════════════════
export const PDF_COLORS = {
  // Primary colors (match app sidebar/headers)
  primary: [30, 90, 142] as [number, number, number],      // Deep blue #1E5A8E
  secondary: [93, 173, 226] as [number, number, number],   // Light blue #5DADE2
  
  // Status colors
  success: [82, 196, 26] as [number, number, number],      // Green #52C41A
  warning: [250, 173, 20] as [number, number, number],     // Amber #FAAD14
  danger: [245, 34, 45] as [number, number, number],       // Red #F5222D
  
  // Text colors
  textDark: [44, 62, 80] as [number, number, number],      // Dark blue-gray #2C3E50
  textLight: [90, 108, 125] as [number, number, number],   // Medium gray #5A6C7D
  textWhite: [255, 255, 255] as [number, number, number],  // White
  textDarkRed: [156, 0, 6] as [number, number, number],    // Dark red for overdue text
  textDarkOrange: [156, 101, 0] as [number, number, number], // Dark orange for warning text
  
  // Background colors (subtle)
  bgLight: [247, 249, 252] as [number, number, number],    // Very light blue-gray #F7F9FC
  bgSuccess: [246, 255, 237] as [number, number, number],  // Very light green #F6FFED
  bgWarning: [255, 251, 230] as [number, number, number],  // Very light amber #FFFBE6
  bgDanger: [255, 241, 240] as [number, number, number],   // Very light red #FFF1F0
  
  // Border colors
  border: [225, 232, 237] as [number, number, number],     // Light gray #E1E8ED
};

export interface PDFReportConfig {
  title: string;
  subtitle?: string;
  vessel?: string;
  generatedBy?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'a3' | 'letter';
  headerColor?: [number, number, number]; // RGB color for header
  colorScheme?: 'blue' | 'red'; // For table headers
}

export interface TableColumn {
  header: string;
  field: string;
  width?: number;
}

class PDFReportGenerator {
  private doc: jsPDF | null = null;

  generateReport(
    config: PDFReportConfig,
    columns: TableColumn[],
    data: any[],
    summaryData?: { label: string; value: string | number }[]
  ): void {
    this.doc = new jsPDF({
      orientation: config.orientation || 'landscape',
      unit: 'mm',
      format: config.pageSize || 'a4'
    });

    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();
    const margin = 15;

    this.addHeader(config, pageWidth, margin);

    let startY = 32;

    if (summaryData && summaryData.length > 0) {
      startY = this.addSummarySection(summaryData, startY, margin);
    }

    this.addDataTable(columns, data, startY, margin);

    this.addFooter(pageWidth, pageHeight, margin);

    const filename = this.generateFilename(config.title, config.vessel);
    this.doc.save(filename);
  }

  private addHeader(config: PDFReportConfig, pageWidth: number, margin: number): void {
    if (!this.doc) return;

    const headerColor = config.headerColor || PDF_COLORS.primary;

    this.doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.title, margin, 15);

    if (config.subtitle) {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...PDF_COLORS.textDark);
      this.doc.text(config.subtitle, margin, 22);
    }

    this.doc.setDrawColor(headerColor[0], headerColor[1], headerColor[2]);
    this.doc.setLineWidth(0.8);
    this.doc.line(margin, config.subtitle ? 25 : 19, pageWidth - margin, config.subtitle ? 25 : 19);

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...PDF_COLORS.textDark);
    this.doc.text(`Vessel: ${config.vessel || 'All Vessels'}`, pageWidth - margin, 15, { align: 'right' });
  }

  private addSummarySection(
    summaryData: { label: string; value: string | number }[],
    startY: number,
    margin: number
  ): number {
    if (!this.doc) return startY;

    this.doc.setTextColor(...PDF_COLORS.textDark);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Summary', margin, startY);

    startY += 8;
    const boxWidth = 50;
    const boxHeight = 20;
    const gap = 5;
    
    summaryData.forEach((item, index) => {
      const x = margin + (index % 5) * (boxWidth + gap);
      const y = startY + Math.floor(index / 5) * (boxHeight + gap);

      this.doc!.setFillColor(...PDF_COLORS.bgLight);
      this.doc!.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');

      this.doc!.setFontSize(8);
      this.doc!.setFont('helvetica', 'normal');
      this.doc!.setTextColor(...PDF_COLORS.textLight);
      this.doc!.text(item.label, x + 5, y + 7);

      this.doc!.setFontSize(14);
      this.doc!.setFont('helvetica', 'bold');
      this.doc!.setTextColor(...PDF_COLORS.textDark);
      this.doc!.text(String(item.value), x + 5, y + 15);
    });

    const rows = Math.ceil(summaryData.length / 5);
    return startY + rows * (boxHeight + gap) + 10;
  }

  private addDataTable(
    columns: TableColumn[],
    data: any[],
    startY: number,
    margin: number
  ): void {
    if (!this.doc) return;

    const headers = columns.map(col => col.header);
    const body = data.map(row => 
      columns.map(col => {
        const value = row[col.field];
        if (value === null || value === undefined) return '-';
        if (value instanceof Date) return format(value, 'dd MMM yyyy');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      })
    );

    // Find indexes of special columns for conditional formatting
    const statusColIndex = columns.findIndex(col => col.field === 'statusIndicator');
    const priorityColIndex = columns.findIndex(col => col.field === 'priority');
    const daysColIndex = columns.findIndex(col => col.field === 'daysRemaining' || col.field === 'daysOverdue');

    autoTable(this.doc, {
      head: [headers],
      body: body,
      startY: startY,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        lineColor: PDF_COLORS.border,
        lineWidth: 0.1,
      },
      tableWidth: 'auto',
      headStyles: {
        fillColor: [235, 237, 240] as [number, number, number],
        textColor: [0, 0, 0] as [number, number, number],
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255] as [number, number, number],
      },
      didParseCell: (hookData) => {
        // Skip header row
        if (hookData.section !== 'body') return;
        
        const rowData = data[hookData.row.index];
        if (!rowData) return;
        
        // STANDARDIZED: Conditional formatting using PDF_COLORS palette
        // Use subtle backgrounds with dark text - no bright colors
        
        // Conditional formatting for Status column
        if (hookData.column.index === statusColIndex && statusColIndex !== -1) {
          const status = rowData.statusIndicator;
          if (status === 'OVERDUE') {
            hookData.cell.styles.fillColor = PDF_COLORS.bgDanger; // Light red bg
            hookData.cell.styles.textColor = PDF_COLORS.textDark;
            hookData.cell.styles.fontStyle = 'bold';
          } else if (status === 'URGENT') {
            hookData.cell.styles.fillColor = PDF_COLORS.bgWarning; // Light amber bg
            hookData.cell.styles.textColor = PDF_COLORS.textDark;
            hookData.cell.styles.fontStyle = 'bold';
          } else if (status === 'DUE') {
            hookData.cell.styles.textColor = PDF_COLORS.primary; // Deep blue
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
        
        // Conditional formatting for Priority column - dark text only, no bright colors
        if (hookData.column.index === priorityColIndex && priorityColIndex !== -1) {
          const priority = rowData.priority;
          if (priority === 'Critical') {
            hookData.cell.styles.textColor = PDF_COLORS.textDark;
            hookData.cell.styles.fontStyle = 'bold';
          } else if (priority === 'High') {
            hookData.cell.styles.textColor = PDF_COLORS.textDark;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
        
        // Conditional formatting for Days Remaining column (negative = overdue)
        if (hookData.column.index === daysColIndex && daysColIndex !== -1) {
          const days = rowData.daysRemaining || rowData.daysOverdue;
          if (typeof days === 'number' && days < 0) {
            hookData.cell.styles.textColor = PDF_COLORS.textDark;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
        
        // Row-level formatting for overdue rows - subtle background
        if (rowData.statusIndicator === 'OVERDUE') {
          if (hookData.column.index !== statusColIndex) {
            hookData.cell.styles.fillColor = PDF_COLORS.bgDanger; // Subtle light red
          }
        }
      },
    });
  }

  private addFooter(pageWidth: number, pageHeight: number, margin: number): void {
    if (!this.doc) return;

    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      
      this.doc.setDrawColor(...PDF_COLORS.border);
      this.doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      this.doc.setFontSize(8);
      this.doc.setTextColor(...PDF_COLORS.textLight);
      this.doc.text(
        'SAIL',
        margin,
        pageHeight - 8
      );
      this.doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' }
      );
    }
  }

  private generateFilename(title: string, vessel?: string): string {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
    const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
    const vesselPrefix = vessel && vessel !== 'All Vessels' ? `${vessel}_` : '';
    return `${vesselPrefix}${cleanTitle}_${timestamp}.pdf`;
  }

  // Specialized method for Overdue Jobs Report with STANDARDIZED MARITIME THEME
  // UPDATED: Removed severity column, simplified to 15 columns, matches Excel report
  // Uses same blue theme as all other reports - with subtle highlights for critical equipment only
  generateOverdueJobsReport(
    config: PDFReportConfig,
    columns: TableColumn[],
    data: any[],
    summaryData?: { label: string; value: string | number; color?: string }[]
  ): void {
    // Force landscape and A3 for better column visibility (15 columns)
    this.doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3' // Use A3 for 15 columns
    });

    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();
    const margin = 10;

    // STANDARDIZED: Use deep blue header (#1E5A8E) - same as all reports
    this.doc.setFillColor(...PDF_COLORS.primary);
    this.doc.rect(0, 0, pageWidth, 35, 'F');

    this.doc.setTextColor(...PDF_COLORS.textWhite);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.title, margin, 15);

    if (config.subtitle) {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(config.subtitle, margin, 24);
    }

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    const rightInfo = [
      `Vessel: ${config.vessel || 'All Vessels'}`,
      `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
      `By: ${config.generatedBy || 'System'}`
    ];
    
    let yPos = 12;
    rightInfo.forEach(info => {
      this.doc!.text(info, pageWidth - margin, yPos, { align: 'right' });
      yPos += 5;
    });

    let startY = 42;

    // Summary section - simplified, no severity-based colors
    // Only highlight critical equipment count
    if (summaryData && summaryData.length > 0) {
      this.doc.setTextColor(...PDF_COLORS.primary); // Deep blue for heading
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('SUMMARY', margin, startY);

      startY += 8;
      const boxWidth = 50;
      const boxHeight = 22;
      const gap = 4;
      
      summaryData.forEach((item, index) => {
        const x = margin + (index % 6) * (boxWidth + gap);
        const y = startY + Math.floor(index / 6) * (boxHeight + gap);

        // SIMPLIFIED color coding - only highlight critical equipment
        if (item.color === 'highlight' || item.label.toLowerCase().includes('critical')) {
          this.doc!.setFillColor(...PDF_COLORS.bgDanger); // Light red bg for critical
          this.doc!.setTextColor(...PDF_COLORS.textDarkRed);
        } else {
          this.doc!.setFillColor(...PDF_COLORS.bgLight); // Light gray bg
          this.doc!.setTextColor(...PDF_COLORS.textDark);
        }

        this.doc!.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');

        this.doc!.setFontSize(7);
        this.doc!.setFont('helvetica', 'normal');
        this.doc!.text(item.label, x + 3, y + 7);

        this.doc!.setFontSize(14);
        this.doc!.setFont('helvetica', 'bold');
        this.doc!.text(String(item.value), x + 3, y + 17);
      });

      const rows = Math.ceil(summaryData.length / 6);
      startY = startY + rows * (boxHeight + gap) + 8;
    }

    // Build table data
    const headers = columns.map(col => col.header);
    const body = data.map(row => 
      columns.map(col => {
        const value = row[col.field];
        if (value === null || value === undefined) return '-';
        if (value instanceof Date) return format(value, 'dd MMM yyyy');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      })
    );

    // Find column indices for conditional formatting
    const daysOverdueColIndex = columns.findIndex(col => col.field === 'daysPastDue' || col.field === 'daysOverdue');
    const criticalColIndex = columns.findIndex(col => col.field === 'critical');

    autoTable(this.doc, {
      head: [headers],
      body: body,
      startY: startY,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: PDF_COLORS.border,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: PDF_COLORS.secondary, // Light blue #5DADE2 - SAME as all reports
        textColor: PDF_COLORS.textWhite,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: PDF_COLORS.bgLight, // Very light blue-gray for alternating rows
      },
      columnStyles: columns.reduce((acc, col, index) => {
        if (col.width) {
          acc[index] = { cellWidth: col.width };
        }
        return acc;
      }, {} as Record<number, { cellWidth: number }>),
      didParseCell: (hookData) => {
        if (hookData.section !== 'body') return;
        
        const rowData = data[hookData.row.index];
        if (!rowData) return;

        // SIMPLIFIED: Only highlight critical equipment rows with light red background
        const isCriticalEquipment = rowData.critical === 'YES' || rowData.critical === true;
        
        if (isCriticalEquipment) {
          hookData.cell.styles.fillColor = PDF_COLORS.bgDanger; // Light red bg
        }
        
        // Format Days Overdue column based on value
        if (hookData.column.index === daysOverdueColIndex) {
          const daysOverdue = Number(rowData.daysPastDue || rowData.daysOverdue || 0);
          if (daysOverdue > 30) {
            hookData.cell.styles.textColor = PDF_COLORS.textDarkRed;
            hookData.cell.styles.fontStyle = 'bold';
          } else if (daysOverdue > 7) {
            hookData.cell.styles.textColor = PDF_COLORS.textDarkOrange;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
        
        // Format Critical Equipment column - bold red if YES
        if (hookData.column.index === criticalColIndex && isCriticalEquipment) {
          hookData.cell.styles.textColor = PDF_COLORS.textDarkRed;
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: (hookData) => {
        const pageCount = this.doc!.getNumberOfPages();
        const currentPage = hookData.pageNumber;
        
        this.doc!.setFontSize(8);
        this.doc!.setTextColor(...PDF_COLORS.textLight);
        this.doc!.text(
          `Page ${currentPage} of ${pageCount}`,
          this.doc!.internal.pageSize.getWidth() / 2,
          this.doc!.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      },
    });

    // Add action required notice after table - subtle amber background
    const finalY = (this.doc as any).lastAutoTable?.finalY || startY + 50;
    this.doc.setFillColor(...PDF_COLORS.bgWarning); // Light amber - not bright red
    this.doc.roundedRect(margin, finalY + 5, pageWidth - (margin * 2), 12, 2, 2, 'F');
    this.doc.setTextColor(...PDF_COLORS.textDarkOrange);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(
      "ACTION REQUIRED: All overdue jobs must be completed or officially postponed with Master's approval",
      pageWidth / 2,
      finalY + 12,
      { align: 'center' }
    );

    // Footer
    this.addFooter(pageWidth, pageHeight, margin);

    const filename = this.generateFilename(config.title, config.vessel);
    this.doc.save(filename);
  }

  // Comprehensive Completed Jobs Register Report
  // All 25 fields as per specification with summary statistics
  generateCompletedJobsRegisterReport(
    config: PDFReportConfig & {
      dateFrom?: string;
      dateTo?: string;
      totalJobs?: number;
      totalManHours?: number;
    },
    data: any[],
    summaryStats?: {
      byDepartment: { department: string; count: number; manHours: number }[];
      byPriority: { priority: string; count: number }[];
      byJobType: { jobType: string; count: number }[];
      avgCompletionTime?: number;
    }
  ): void {
    this.doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3'
    });

    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();
    const margin = 8;

    // Header Section
    this.doc.setFillColor(...PDF_COLORS.primary);
    this.doc.rect(0, 0, pageWidth, 40, 'F');

    this.doc.setTextColor(...PDF_COLORS.textWhite);
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('COMPLETED JOBS REGISTER', margin, 15);

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    const periodText = config.dateFrom && config.dateTo 
      ? `Report Period: ${config.dateFrom} to ${config.dateTo}`
      : 'Report Period: All Time';
    this.doc.text(periodText, margin, 24);

    this.doc.setFontSize(10);
    const vesselText = `Vessel: ${config.vessel || 'All Vessels'}`;
    this.doc.text(vesselText, margin, 32);

    // Right side info
    this.doc.setFontSize(9);
    const rightInfo = [
      `Generated: ${format(new Date(), 'dd-MMM-yyyy HH:mm')}`,
      `Total Jobs: ${config.totalJobs || data.length}`,
      `Total Man-Hours: ${config.totalManHours?.toFixed(1) || '—'}`
    ];
    
    let yPos = 12;
    rightInfo.forEach(info => {
      this.doc!.text(info, pageWidth - margin, yPos, { align: 'right' });
      yPos += 6;
    });

    let startY = 48;

    // Define all 25 columns (condensed widths for A3 landscape)
    const columns: TableColumn[] = [
      { header: 'S.No', field: 'sNo', width: 8 },
      { header: 'Work Order No', field: 'workOrderNo', width: 28 },
      { header: 'Component', field: 'componentName', width: 25 },
      { header: 'Comp Code', field: 'componentCode', width: 18 },
      { header: 'Job Title', field: 'jobTitle', width: 30 },
      { header: 'Type', field: 'jobType', width: 14 },
      { header: 'Basis', field: 'maintenanceBasis', width: 12 },
      { header: 'Dept', field: 'department', width: 12 },
      { header: 'Priority', field: 'priority', width: 12 },
      { header: 'Critical', field: 'criticality', width: 10 },
      { header: 'Class', field: 'classRelated', width: 10 },
      { header: 'Assigned To', field: 'assignedTo', width: 18 },
      { header: 'Approver', field: 'approver', width: 16 },
      { header: 'Submitted', field: 'submittedDate', width: 18 },
      { header: 'Start Date', field: 'startDate', width: 18 },
      { header: 'Start Time', field: 'startTime', width: 12 },
      { header: 'Completed', field: 'completionDate', width: 18 },
      { header: 'End Time', field: 'completionTime', width: 12 },
      { header: 'Duration', field: 'workDuration', width: 12 },
      { header: 'Persons', field: 'noOfPersons', width: 10 },
      { header: 'Man-Hrs', field: 'manHours', width: 12 },
      { header: 'Risk Assmt', field: 'riskAssessment', width: 12 },
      { header: 'Safety Chk', field: 'safetyChecklists', width: 12 },
      { header: 'Ops Forms', field: 'operationalForms', width: 12 }
    ];

    const headers = columns.map(col => col.header);
    const body = data.map(row => 
      columns.map(col => {
        const value = row[col.field];
        if (value === null || value === undefined || value === '') return '—';
        return String(value);
      })
    );

    autoTable(this.doc, {
      head: [headers],
      body: body,
      startY: startY,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 6,
        cellPadding: 1.5,
        overflow: 'linebreak',
        lineColor: PDF_COLORS.border,
        lineWidth: 0.1,
        valign: 'middle',
      },
      headStyles: {
        fillColor: PDF_COLORS.secondary,
        textColor: PDF_COLORS.textWhite,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 6,
      },
      alternateRowStyles: {
        fillColor: PDF_COLORS.bgLight,
      },
      columnStyles: columns.reduce((acc, col, index) => {
        if (col.width) {
          acc[index] = { cellWidth: col.width };
        }
        return acc;
      }, {} as Record<number, { cellWidth: number }>),
      didParseCell: (hookData) => {
        if (hookData.section !== 'body') return;
        const rowData = data[hookData.row.index];
        if (!rowData) return;

        // Highlight critical equipment rows
        if (rowData.criticality === 'Yes' || rowData.criticality === 'Critical') {
          hookData.cell.styles.fillColor = PDF_COLORS.bgSuccess;
        }
      },
      didDrawPage: (hookData) => {
        // Add "Confidential" watermark
        this.doc!.setTextColor(230, 230, 230);
        this.doc!.setFontSize(60);
        this.doc!.setFont('helvetica', 'bold');
        this.doc!.text('CONFIDENTIAL', pageWidth / 2, pageHeight / 2, {
          align: 'center',
          angle: 45
        });

        // Page number
        const pageCount = this.doc!.getNumberOfPages();
        const currentPage = hookData.pageNumber;
        this.doc!.setFontSize(8);
        this.doc!.setTextColor(...PDF_COLORS.textLight);
        this.doc!.text(
          `Page ${currentPage} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      },
    });

    // Summary Section after table
    if (summaryStats) {
      const finalY = (this.doc as any).lastAutoTable?.finalY || startY + 100;
      let summaryY = finalY + 10;

      // Check if we need a new page for summary
      if (summaryY > pageHeight - 60) {
        this.doc.addPage();
        summaryY = 20;
      }

      this.doc.setTextColor(...PDF_COLORS.primary);
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('SUMMARY STATISTICS', margin, summaryY);
      summaryY += 10;

      // Summary boxes layout
      const boxWidth = 70;
      const boxHeight = 35;
      const gap = 5;
      let boxX = margin;

      // Department Summary
      if (summaryStats.byDepartment && summaryStats.byDepartment.length > 0) {
        this.doc.setFillColor(...PDF_COLORS.bgLight);
        this.doc.roundedRect(boxX, summaryY, boxWidth, boxHeight, 2, 2, 'F');
        
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...PDF_COLORS.primary);
        this.doc.text('Jobs by Department', boxX + 3, summaryY + 6);
        
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...PDF_COLORS.textDark);
        this.doc.setFontSize(7);
        let lineY = summaryY + 12;
        summaryStats.byDepartment.slice(0, 4).forEach(dept => {
          this.doc!.text(`${dept.department}: ${dept.count} (${dept.manHours.toFixed(1)} hrs)`, boxX + 3, lineY);
          lineY += 5;
        });
        boxX += boxWidth + gap;
      }

      // Priority Summary
      if (summaryStats.byPriority && summaryStats.byPriority.length > 0) {
        this.doc.setFillColor(...PDF_COLORS.bgLight);
        this.doc.roundedRect(boxX, summaryY, boxWidth, boxHeight, 2, 2, 'F');
        
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...PDF_COLORS.primary);
        this.doc.text('Jobs by Priority', boxX + 3, summaryY + 6);
        
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...PDF_COLORS.textDark);
        this.doc.setFontSize(7);
        let lineY = summaryY + 12;
        summaryStats.byPriority.forEach(p => {
          this.doc!.text(`${p.priority}: ${p.count}`, boxX + 3, lineY);
          lineY += 5;
        });
        boxX += boxWidth + gap;
      }

      // Job Type Summary
      if (summaryStats.byJobType && summaryStats.byJobType.length > 0) {
        this.doc.setFillColor(...PDF_COLORS.bgLight);
        this.doc.roundedRect(boxX, summaryY, boxWidth, boxHeight, 2, 2, 'F');
        
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...PDF_COLORS.primary);
        this.doc.text('Jobs by Type', boxX + 3, summaryY + 6);
        
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...PDF_COLORS.textDark);
        this.doc.setFontSize(7);
        let lineY = summaryY + 12;
        summaryStats.byJobType.slice(0, 4).forEach(jt => {
          this.doc!.text(`${jt.jobType}: ${jt.count}`, boxX + 3, lineY);
          lineY += 5;
        });
        boxX += boxWidth + gap;
      }

      // Average Completion Time
      if (summaryStats.avgCompletionTime !== undefined) {
        this.doc.setFillColor(...PDF_COLORS.bgSuccess);
        this.doc.roundedRect(boxX, summaryY, boxWidth, boxHeight, 2, 2, 'F');
        
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...PDF_COLORS.primary);
        this.doc.text('Avg Completion Time', boxX + 3, summaryY + 6);
        
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...PDF_COLORS.textDark);
        this.doc.text(`${summaryStats.avgCompletionTime.toFixed(1)} hrs`, boxX + 3, summaryY + 22);
      }
    }

    // Footer
    this.addFooter(pageWidth, pageHeight, margin);

    const filename = this.generateFilename(config.title, config.vessel);
    this.doc.save(filename);
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORT 1.5: CRITICAL EQUIPMENT STATUS REPORT
  // Shows SOLAS-critical and class-critical systems with risk levels
  // ═══════════════════════════════════════════════════════════════
  generateCriticalEquipmentReport(
    config: PDFReportConfig,
    columns: TableColumn[],
    data: any[],
    summaryData?: { label: string; value: string | number; color?: string }[],
    metadata?: {
      totalCriticalEquipment: number;
      criticalOnly: number;
      classItemOnly: number;
      bothCriticalAndClass: number;
      equipmentWithOverdue: number;
      equipmentDueSoon: number;
      totalOverdueJobs: number;
      totalTrackedWorkOrders: number;
    }
  ): void {
    // Force landscape and A4 for 12 columns
    this.doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();
    const margin = 10;

    // HEADER - Deep blue (#1E5A8E)
    this.doc.setFillColor(...PDF_COLORS.primary);
    this.doc.rect(0, 0, pageWidth, 30, 'F');

    this.doc.setTextColor(...PDF_COLORS.textWhite);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.title, margin, 12);

    if (config.subtitle) {
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(config.subtitle, margin, 20);
    }

    // Right side info
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    const rightInfo = [
      `Vessel: ${config.vessel || 'All Vessels'}`,
      `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
      `By: ${config.generatedBy || 'System'}`
    ];
    
    let yPos = 10;
    rightInfo.forEach(info => {
      this.doc!.text(info, pageWidth - margin, yPos, { align: 'right' });
      yPos += 5;
    });

    let startY = 38;

    // SUMMARY SECTION
    if (summaryData && summaryData.length > 0) {
      this.doc.setTextColor(...PDF_COLORS.primary);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('SUMMARY', margin, startY);

      startY += 6;
      const boxWidth = 42;
      const boxHeight = 18;
      const gap = 4;
      
      summaryData.forEach((item, index) => {
        const x = margin + (index % 6) * (boxWidth + gap);
        const y = startY + Math.floor(index / 6) * (boxHeight + gap);

        // Color coding for overdue items
        if (item.color === 'highlight' || item.label.toLowerCase().includes('overdue')) {
          this.doc!.setFillColor(...PDF_COLORS.bgDanger);
          this.doc!.setTextColor(...PDF_COLORS.textDarkRed);
        } else if (item.label.toLowerCase().includes('due soon')) {
          this.doc!.setFillColor(...PDF_COLORS.bgWarning);
          this.doc!.setTextColor(...PDF_COLORS.textDarkOrange);
        } else {
          this.doc!.setFillColor(...PDF_COLORS.bgLight);
          this.doc!.setTextColor(...PDF_COLORS.textDark);
        }

        this.doc!.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');

        this.doc!.setFontSize(7);
        this.doc!.setFont('helvetica', 'normal');
        this.doc!.text(item.label, x + 3, y + 6);

        this.doc!.setFontSize(12);
        this.doc!.setFont('helvetica', 'bold');
        this.doc!.text(String(item.value), x + 3, y + 14);
      });

      const rows = Math.ceil(summaryData.length / 6);
      startY = startY + rows * (boxHeight + gap) + 6;
    }

    // Build table data
    const headers = columns.map(col => col.header);
    const body = data.map(row => 
      columns.map(col => {
        const value = row[col.field];
        if (value === null || value === undefined) return '-';
        if (value instanceof Date) return format(value, 'dd MMM yyyy');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      })
    );

    // Find column indices for conditional formatting
    const overdueColIndex = columns.findIndex(col => col.field === 'overdueJobs');
    const dueSoonColIndex = columns.findIndex(col => col.field === 'dueSoonJobs');
    const daysColIndex = columns.findIndex(col => col.field === 'daysUntilDue');

    autoTable(this.doc, {
      head: [headers],
      body: body,
      startY: startY,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: PDF_COLORS.border,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: PDF_COLORS.secondary,
        textColor: PDF_COLORS.textWhite,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: PDF_COLORS.bgLight,
      },
      columnStyles: columns.reduce((acc, col, index) => {
        if (col.width) {
          acc[index] = { cellWidth: col.width };
        }
        return acc;
      }, {} as Record<number, { cellWidth: number }>),
      didParseCell: (hookData) => {
        if (hookData.section !== 'body') return;
        
        const rowData = data[hookData.row.index];
        if (!rowData) return;

        // Format Overdue column - red if > 0
        if (hookData.column.index === overdueColIndex) {
          const overdueCount = parseInt(hookData.cell.text[0]) || 0;
          if (overdueCount > 0) {
            hookData.cell.styles.textColor = PDF_COLORS.textDarkRed;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }

        // Format Due Soon column - orange if > 0
        if (hookData.column.index === dueSoonColIndex) {
          const dueSoonCount = parseInt(hookData.cell.text[0]) || 0;
          if (dueSoonCount > 0) {
            hookData.cell.styles.textColor = PDF_COLORS.textDarkOrange;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }

        // Format Days Until Due column
        if (hookData.column.index === daysColIndex) {
          const days = parseInt(hookData.cell.text[0]);
          if (!isNaN(days)) {
            if (days < 0) {
              hookData.cell.styles.textColor = PDF_COLORS.textDarkRed;
              hookData.cell.styles.fontStyle = 'bold';
            } else if (days <= 7) {
              hookData.cell.styles.textColor = PDF_COLORS.textDarkOrange;
              hookData.cell.styles.fontStyle = 'bold';
            }
          }
        }

        // Highlight entire row based on overdue/due soon status
        if (rowData.overdueJobs > 0) {
          // RED background for rows with overdue jobs
          hookData.cell.styles.fillColor = PDF_COLORS.bgDanger;
        } else if (rowData.dueSoonJobs > 0) {
          // YELLOW/ORANGE background for rows with due soon but no overdue
          hookData.cell.styles.fillColor = PDF_COLORS.bgWarning;
        }
      },
      didDrawPage: (hookData) => {
        const pageCount = this.doc!.getNumberOfPages();
        const currentPage = hookData.pageNumber;
        
        this.doc!.setFontSize(8);
        this.doc!.setTextColor(...PDF_COLORS.textLight);
        this.doc!.text(
          `Page ${currentPage} of ${pageCount}`,
          this.doc!.internal.pageSize.getWidth() / 2,
          this.doc!.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      },
    });

    // Action notice if there are equipment with overdue jobs
    if (metadata && metadata.equipmentWithOverdue > 0) {
      const finalY = (this.doc as any).lastAutoTable?.finalY || startY + 50;
      this.doc.setFillColor(...PDF_COLORS.bgDanger);
      this.doc.roundedRect(margin, finalY + 5, pageWidth - (margin * 2), 12, 2, 2, 'F');
      this.doc.setTextColor(...PDF_COLORS.textDarkRed);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(
        `ACTION REQUIRED: ${metadata.equipmentWithOverdue} critical equipment have overdue work orders (${metadata.totalOverdueJobs} total overdue WOs)`,
        pageWidth / 2,
        finalY + 12,
        { align: 'center' }
      );
    }

    // Footer
    this.addFooter(pageWidth, pageHeight, margin);

    const filename = this.generateFilename(config.title, config.vessel);
    this.doc.save(filename);
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORT 1.6: UNPLANNED/BREAKDOWN JOBS PDF GENERATOR
  // Same styling as Critical Equipment Report (Report 1.5)
  // ═══════════════════════════════════════════════════════════════
  generateUnplannedBreakdownReport(
    config: PDFReportConfig,
    columns: TableColumn[],
    data: any[],
    summaryData?: { label: string; value: string | number }[],
    metadata?: {
      totalUnplannedJobs: number;
      totalManhours: string;
      avgTimeTaken: string;
      dateRange: { start: string; end: string };
    }
  ): void {
    // Force landscape and A4 for 11 columns
    this.doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();
    const margin = 10;

    // HEADER - Deep blue (#1E5A8E) - Same as Report 1.5
    this.doc.setFillColor(...PDF_COLORS.primary);
    this.doc.rect(0, 0, pageWidth, 30, 'F');

    this.doc.setTextColor(...PDF_COLORS.textWhite);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.title, margin, 12);

    if (config.subtitle) {
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(config.subtitle, margin, 20);
    }

    // Right side info
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    const rightInfo = [
      `Vessel: ${config.vessel || 'All Vessels'}`,
      `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
      `By: ${config.generatedBy || 'System'}`
    ];
    
    let yPos = 10;
    rightInfo.forEach(info => {
      this.doc!.text(info, pageWidth - margin, yPos, { align: 'right' });
      yPos += 5;
    });

    let startY = 38;

    // SUMMARY SECTION
    if (summaryData && summaryData.length > 0) {
      this.doc.setTextColor(...PDF_COLORS.primary);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('SUMMARY', margin, startY);

      startY += 6;
      const boxWidth = 50;
      const boxHeight = 18;
      const gap = 4;
      
      summaryData.forEach((item, index) => {
        const x = margin + (index % 5) * (boxWidth + gap);
        const y = startY + Math.floor(index / 5) * (boxHeight + gap);

        this.doc!.setFillColor(...PDF_COLORS.bgLight);
        this.doc!.setTextColor(...PDF_COLORS.textDark);

        this.doc!.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');

        this.doc!.setFontSize(7);
        this.doc!.setFont('helvetica', 'normal');
        this.doc!.text(item.label, x + 3, y + 6);

        this.doc!.setFontSize(12);
        this.doc!.setFont('helvetica', 'bold');
        this.doc!.text(String(item.value), x + 3, y + 14);
      });

      const rows = Math.ceil(summaryData.length / 5);
      startY = startY + rows * (boxHeight + gap) + 6;
    }

    // Build table data
    const headers = columns.map(col => col.header);
    const body = data.map(row => 
      columns.map(col => {
        const value = row[col.field];
        if (value === null || value === undefined) return '-';
        if (value instanceof Date) return format(value, 'dd MMM yyyy');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      })
    );

    autoTable(this.doc, {
      head: [headers],
      body: body,
      startY: startY,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: PDF_COLORS.border,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: PDF_COLORS.secondary,
        textColor: PDF_COLORS.textWhite,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: PDF_COLORS.bgLight,
      },
      columnStyles: columns.reduce((acc, col, index) => {
        if (col.width) {
          acc[index] = { cellWidth: col.width };
        }
        return acc;
      }, {} as Record<number, { cellWidth: number }>),
      didDrawPage: (hookData) => {
        const pageCount = this.doc!.getNumberOfPages();
        const currentPage = hookData.pageNumber;
        
        this.doc!.setFontSize(8);
        this.doc!.setTextColor(...PDF_COLORS.textLight);
        this.doc!.text(
          `Page ${currentPage} of ${pageCount}`,
          this.doc!.internal.pageSize.getWidth() / 2,
          this.doc!.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      },
    });

    // Footer
    this.addFooter(pageWidth, pageHeight, margin);

    const filename = this.generateFilename(config.title, config.vessel);
    this.doc.save(filename);
  }
}

export const pdfReportGenerator = new PDFReportGenerator();

export async function fetchReportData(endpoint: string, params?: Record<string, string>): Promise<any> {
  const queryString = params 
    ? '?' + new URLSearchParams(params).toString() 
    : '';
  
  const response = await fetch(`${endpoint}${queryString}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.statusText}`);
  }
  return response.json();
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'dd MMM yyyy');
  } catch {
    return String(date);
  }
}

export function formatNumber(num: number | null | undefined, decimals: number = 0): string {
  if (num === null || num === undefined) return '-';
  return num.toFixed(decimals);
}
