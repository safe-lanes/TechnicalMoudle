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

    this.doc.setFillColor(82, 186, 243);
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
        fillColor: [82, 186, 243],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: columns.reduce((acc, col, index) => {
        if (col.width) {
          acc[index] = { cellWidth: col.width };
        }
        return acc;
      }, {} as Record<number, { cellWidth: number }>),
      didDrawPage: (data) => {
        const pageCount = this.doc!.getNumberOfPages();
        const currentPage = data.pageNumber;
        
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
