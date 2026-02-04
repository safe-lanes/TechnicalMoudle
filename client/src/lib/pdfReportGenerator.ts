import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

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

    let startY = 45;

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

    // Use custom header color or default blue
    const headerColor = config.headerColor || [82, 186, 243];
    this.doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
    this.doc.rect(0, 0, pageWidth, 35, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.title, margin, 15);

    if (config.subtitle) {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(config.subtitle, margin, 22);
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
  }

  private addSummarySection(
    summaryData: { label: string; value: string | number }[],
    startY: number,
    margin: number
  ): number {
    if (!this.doc) return startY;

    this.doc.setTextColor(0, 0, 0);
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

      this.doc!.setFillColor(245, 247, 250);
      this.doc!.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');

      this.doc!.setFontSize(8);
      this.doc!.setFont('helvetica', 'normal');
      this.doc!.setTextColor(100, 100, 100);
      this.doc!.text(item.label, x + 5, y + 7);

      this.doc!.setFontSize(14);
      this.doc!.setFont('helvetica', 'bold');
      this.doc!.setTextColor(0, 0, 0);
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
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [31, 78, 120], // Dark blue #1F4E78
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [242, 242, 242], // Light gray for alternating rows
      },
      columnStyles: columns.reduce((acc, col, index) => {
        if (col.width) {
          acc[index] = { cellWidth: col.width };
        }
        return acc;
      }, {} as Record<number, { cellWidth: number }>),
      didParseCell: (hookData) => {
        // Skip header row
        if (hookData.section !== 'body') return;
        
        const rowData = data[hookData.row.index];
        if (!rowData) return;
        
        // Conditional formatting for Status column
        if (hookData.column.index === statusColIndex && statusColIndex !== -1) {
          const status = rowData.statusIndicator;
          if (status === 'OVERDUE') {
            hookData.cell.styles.fillColor = [255, 199, 206]; // Light red
            hookData.cell.styles.textColor = [156, 0, 6]; // Dark red
            hookData.cell.styles.fontStyle = 'bold';
          } else if (status === 'URGENT') {
            hookData.cell.styles.fillColor = [255, 244, 206]; // Light yellow
            hookData.cell.styles.textColor = [156, 101, 0]; // Dark orange
            hookData.cell.styles.fontStyle = 'bold';
          } else if (status === 'DUE') {
            hookData.cell.styles.textColor = [0, 102, 204]; // Blue
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
        
        // Conditional formatting for Priority column
        if (hookData.column.index === priorityColIndex && priorityColIndex !== -1) {
          const priority = rowData.priority;
          if (priority === 'Critical') {
            hookData.cell.styles.textColor = [255, 0, 0]; // Red
            hookData.cell.styles.fontStyle = 'bold';
          } else if (priority === 'High') {
            hookData.cell.styles.textColor = [255, 102, 0]; // Orange
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
        
        // Conditional formatting for Days Remaining column (negative = overdue)
        if (hookData.column.index === daysColIndex && daysColIndex !== -1) {
          const days = rowData.daysRemaining || rowData.daysOverdue;
          if (typeof days === 'number' && days < 0) {
            hookData.cell.styles.textColor = [156, 0, 6]; // Dark red
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
        
        // Row-level formatting for overdue rows
        if (rowData.statusIndicator === 'OVERDUE') {
          if (hookData.column.index !== statusColIndex) {
            hookData.cell.styles.fillColor = [255, 230, 230]; // Very light red for whole row
          }
        }
      },
      didDrawPage: (hookData) => {
        const pageCount = this.doc!.getNumberOfPages();
        const currentPage = hookData.pageNumber;
        
        this.doc!.setFontSize(8);
        this.doc!.setTextColor(128, 128, 128);
        this.doc!.text(
          `Page ${currentPage} of ${pageCount}`,
          this.doc!.internal.pageSize.getWidth() / 2,
          this.doc!.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      },
    });
  }

  private addFooter(pageWidth: number, pageHeight: number, margin: number): void {
    if (!this.doc) return;

    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      
      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      this.doc.setFontSize(8);
      this.doc.setTextColor(128, 128, 128);
      this.doc.text(
        'Seafarer Technical Management System - Confidential',
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

  // Specialized method for Overdue Jobs Report with severity-based formatting
  generateOverdueJobsReport(
    config: PDFReportConfig,
    columns: TableColumn[],
    data: any[],
    summaryData?: { label: string; value: string | number; color?: string }[]
  ): void {
    // Force landscape and A3 for better column visibility
    this.doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3' // Use A3 for 17 columns
    });

    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();
    const margin = 10;

    // Red header for overdue report
    this.doc.setFillColor(192, 0, 0); // Dark red #C00000
    this.doc.rect(0, 0, pageWidth, 35, 'F');

    this.doc.setTextColor(255, 255, 255);
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

    // Enhanced summary section with color-coded boxes
    if (summaryData && summaryData.length > 0) {
      this.doc.setTextColor(192, 0, 0);
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('OVERDUE SUMMARY', margin, startY);

      startY += 8;
      const boxWidth = 45;
      const boxHeight = 22;
      const gap = 4;
      
      summaryData.forEach((item, index) => {
        const x = margin + (index % 8) * (boxWidth + gap);
        const y = startY + Math.floor(index / 8) * (boxHeight + gap);

        // Color-coded boxes based on severity
        if (item.color === 'critical') {
          this.doc!.setFillColor(255, 0, 0);
          this.doc!.setTextColor(255, 255, 255);
        } else if (item.color === 'severe') {
          this.doc!.setFillColor(255, 199, 206);
          this.doc!.setTextColor(156, 0, 6);
        } else if (item.color === 'moderate') {
          this.doc!.setFillColor(255, 244, 206);
          this.doc!.setTextColor(156, 101, 0);
        } else {
          this.doc!.setFillColor(245, 247, 250);
          this.doc!.setTextColor(0, 0, 0);
        }

        this.doc!.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');

        this.doc!.setFontSize(7);
        this.doc!.setFont('helvetica', 'normal');
        this.doc!.text(item.label, x + 3, y + 7);

        this.doc!.setFontSize(14);
        this.doc!.setFont('helvetica', 'bold');
        this.doc!.text(String(item.value), x + 3, y + 17);
      });

      const rows = Math.ceil(summaryData.length / 8);
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

    // Find severity column index
    const severityColIndex = columns.findIndex(col => col.field === 'severity');

    autoTable(this.doc, {
      head: [headers],
      body: body,
      startY: startY,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [192, 0, 0], // Dark red #C00000
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7,
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

        // Severity-based row coloring
        const severity = rowData.severity;
        
        if (severity === 'CRITICAL') {
          hookData.cell.styles.fillColor = [255, 0, 0]; // Bright red
          hookData.cell.styles.textColor = [255, 255, 255]; // White text
          hookData.cell.styles.fontStyle = 'bold';
        } else if (severity === 'SEVERE') {
          hookData.cell.styles.fillColor = [255, 199, 206]; // Light red
          hookData.cell.styles.textColor = [156, 0, 6]; // Dark red text
          hookData.cell.styles.fontStyle = 'bold';
        } else if (severity === 'MODERATE') {
          hookData.cell.styles.fillColor = [255, 244, 206]; // Light yellow
          hookData.cell.styles.textColor = [156, 101, 0]; // Dark orange text
        } else {
          // MINOR - alternate rows
          if (hookData.row.index % 2 === 1) {
            hookData.cell.styles.fillColor = [242, 242, 242];
          }
        }
      },
      didDrawPage: (hookData) => {
        const pageCount = this.doc!.getNumberOfPages();
        const currentPage = hookData.pageNumber;
        
        this.doc!.setFontSize(8);
        this.doc!.setTextColor(128, 128, 128);
        this.doc!.text(
          `Page ${currentPage} of ${pageCount}`,
          this.doc!.internal.pageSize.getWidth() / 2,
          this.doc!.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      },
    });

    // Add action required notice after table
    const finalY = (this.doc as any).lastAutoTable?.finalY || startY + 50;
    this.doc.setFillColor(255, 230, 230);
    this.doc.roundedRect(margin, finalY + 5, pageWidth - (margin * 2), 12, 2, 2, 'F');
    this.doc.setTextColor(192, 0, 0);
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
