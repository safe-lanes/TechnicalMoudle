// Report Generation Engine for PMS Reports
import { format } from "date-fns";

export interface ReportData {
  title: string;
  subtitle?: string;
  category: string;
  reportType: string;
  generatedAt: Date;
  generatedBy: string;
  vessel?: string;
  department?: string;
  filters?: Record<string, any>;
  data: any[];
  metadata?: {
    totalRecords: number;
    dateRange?: {
      from: Date;
      to: Date;
    };
    priority?: string;
    status?: string;
  };
}

export interface ReportTemplate {
  id: string;
  name: string;
  category: string;
  columns: ReportColumn[];
  headers: string[];
  formatting?: {
    showHeader?: boolean;
    showFooter?: boolean;
    pageSize?: 'A4' | 'A3' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    colorScheme?: string;
  };
}

export interface ReportColumn {
  field: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'status' | 'priority';
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: string;
}

class ReportGeneratorService {
  private baseURL = '/technical/api/reports';

  async generateReport(
    reportId: string,
    format: 'PDF' | 'Excel' | 'CSV',
    data: ReportData,
    template?: ReportTemplate
  ): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseURL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          format,
          data,
          template,
        }),
      });

      if (!response.ok) {
        throw new Error(`Report generation failed: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  async generateMaintenanceReport(
    reportType: string,
    format: 'PDF' | 'Excel' | 'CSV',
    filters: any = {}
  ): Promise<Blob> {
    // Mock data for maintenance reports until backend is ready
    const mockData = this.getMockMaintenanceData(reportType, filters);
    const template = this.getMaintenanceTemplate(reportType);
    
    return this.generateReport(reportType, format, mockData, template);
  }

  async downloadReport(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  generateFilename(reportName: string, fileFormat: string, vessel?: string): string {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const vesselPrefix = vessel ? `${vessel}_` : '';
    const cleanName = reportName.replace(/[^a-zA-Z0-9]/g, '_');
    const extension = this.getFileExtension(fileFormat);
    return `${vesselPrefix}${cleanName}_${timestamp}.${extension}`;
  }

  private getFileExtension(format: string): string {
    const extensions: Record<string, string> = {
      'PDF': 'pdf',
      'Excel': 'xlsx',
      'CSV': 'csv'
    };
    return extensions[format] || format.toLowerCase();
  }

  private getMockMaintenanceData(reportType: string, filters: any): ReportData {
    const baseData: ReportData = {
      title: this.getReportTitle(reportType),
      category: 'Maintenance & Work Orders',
      reportType,
      generatedAt: new Date(),
      generatedBy: 'Current User', // Will be replaced with actual user
      vessel: filters.vessel || 'All Vessels',
      department: filters.department || 'All Departments',
      filters,
      data: [],
      metadata: {
        totalRecords: 0,
      },
    };

    switch (reportType) {
      case 'due-jobs-7':
        baseData.data = this.getMockDueJobs();
        break;
      case 'overdue-jobs':
        baseData.data = this.getMockOverdueJobs();
        break;
      case 'completed-jobs':
        baseData.data = this.getMockCompletedJobs();
        break;
      case 'monthly-summary':
        baseData.data = this.getMockMonthlySummary();
        break;
      case 'critical-equipment':
        baseData.data = this.getMockCriticalEquipment();
        break;
      case 'unplanned-jobs':
        baseData.data = this.getMockUnplannedJobs();
        break;
      case 'postponement-log':
        baseData.data = this.getMockPostponementLog();
        break;
      case 'priority-performance':
        baseData.data = this.getMockPriorityPerformance();
        break;
      case 'manhours-analysis':
        baseData.data = this.getMockManhoursAnalysis();
        break;
      case 'workload-distribution':
        baseData.data = this.getMockWorkloadDistribution();
        break;
      default:
        baseData.data = [];
    }

    baseData.metadata!.totalRecords = baseData.data.length;
    return baseData;
  }

  private getMaintenanceTemplate(reportType: string): ReportTemplate {
    const baseTemplate: ReportTemplate = {
      id: reportType,
      name: this.getReportTitle(reportType),
      category: 'maintenance',
      columns: [],
      headers: ['PMS MAINTENANCE REPORT', 'Generated: ' + format(new Date(), 'dd/MM/yyyy HH:mm')],
      formatting: {
        showHeader: true,
        showFooter: true,
        pageSize: 'A4',
        orientation: 'landscape',
        colorScheme: 'blue',
      },
    };

    // Define columns based on report type
    switch (reportType) {
      case 'due-jobs-7':
        baseTemplate.columns = [
          { field: 'woNumber', header: 'WO No', type: 'text', width: 80 },
          { field: 'title', header: 'Title', type: 'text', width: 200 },
          { field: 'component', header: 'Component', type: 'text', width: 150 },
          { field: 'department', header: 'Dept', type: 'text', width: 80 },
          { field: 'priority', header: 'Priority', type: 'priority', width: 80 },
          { field: 'dueDate', header: 'Due Date', type: 'date', width: 100 },
          { field: 'requiredSpares', header: 'Required Spares', type: 'text', width: 150 },
        ];
        break;
      case 'overdue-jobs':
        baseTemplate.columns = [
          { field: 'woNumber', header: 'WO No', type: 'text', width: 80 },
          { field: 'component', header: 'Component', type: 'text', width: 150 },
          { field: 'daysOverdue', header: 'Days Overdue', type: 'number', width: 100 },
          { field: 'priority', header: 'Priority', type: 'priority', width: 80 },
          { field: 'reason', header: 'Reason', type: 'text', width: 200 },
          { field: 'escalationStatus', header: 'Escalation', type: 'status', width: 100 },
        ];
        break;
      case 'completed-jobs':
        baseTemplate.columns = [
          { field: 'woNumber', header: 'WO No', type: 'text', width: 80 },
          { field: 'component', header: 'Component', type: 'text', width: 150 },
          { field: 'completedDate', header: 'Completed', type: 'date', width: 100 },
          { field: 'manHours', header: 'Man Hours', type: 'number', width: 80 },
          { field: 'performedBy', header: 'Performed By', type: 'text', width: 120 },
          { field: 'notes', header: 'Notes', type: 'text', width: 200 },
        ];
        break;
      default:
        baseTemplate.columns = [
          { field: 'id', header: 'ID', type: 'text', width: 80 },
          { field: 'description', header: 'Description', type: 'text', width: 300 },
        ];
    }

    return baseTemplate;
  }

  private getReportTitle(reportType: string): string {
    const titles: Record<string, string> = {
      'due-jobs-7': 'Due Jobs (7 days)',
      'overdue-jobs': 'Overdue Work Orders',
      'completed-jobs': 'Completed Work Orders Register',
      'monthly-summary': 'Monthly Maintenance Summary',
      'critical-equipment': 'Critical Equipment Status',
      'unplanned-jobs': 'Unplanned/Breakdown Work Orders',
      'postponement-log': 'Work Order Postponement Log',
      'priority-performance': 'Work Priority Performance',
      'manhours-analysis': 'Man-Hours Planned vs Actual',
      'workload-distribution': 'Crew Workload Distribution',
    'wo-overview': 'Work Orders Overview',
    };
    return titles[reportType] || 'Unknown Report';
  }

  // Mock data methods
  private getMockDueJobs() {
    return [
      {
        woNumber: 'WO-2024-0847',
        title: 'Main Engine Cylinder Head Inspection',
        component: 'Main Engine - Unit 1',
        department: 'Engine',
        priority: 'High',
        dueDate: new Date('2024-09-26'),
        requiredSpares: 'Gasket Set, Inspection Tools',
        riskNotes: 'Critical for voyage safety'
      },
      {
        woNumber: 'WO-2024-0851',
        title: 'Fire Fighting System Monthly Test',
        component: 'Fire Fighting System',
        department: 'Safety',
        priority: 'High',
        dueDate: new Date('2024-09-27'),
        requiredSpares: 'Test Equipment',
        riskNotes: 'SOLAS requirement'
      },
      {
        woNumber: 'WO-2024-0856',
        title: 'Generator 2 Oil Change',
        component: 'Auxiliary Generator 2',
        department: 'Engine',
        priority: 'Medium',
        dueDate: new Date('2024-09-28'),
        requiredSpares: 'Engine Oil (20L), Oil Filter',
        riskNotes: 'Standard maintenance'
      },
      // Add more mock data as needed
    ];
  }

  private getMockOverdueJobs() {
    return [
      {
        woNumber: 'WO-2024-0832',
        component: 'Bow Thruster',
        daysOverdue: 5,
        priority: 'High',
        reason: 'Waiting for spare parts',
        escalationStatus: 'Office Notified'
      },
      {
        woNumber: 'WO-2024-0829',
        component: 'Radar System',
        daysOverdue: 12,
        priority: 'Medium',
        reason: 'Technical expertise required',
        escalationStatus: 'Specialist Arranged'
      },
    ];
  }

  private getMockCompletedJobs() {
    return [
      {
        woNumber: 'WO-2024-0845',
        component: 'Air Compressor 1',
        completedDate: new Date('2024-09-20'),
        manHours: 4.5,
        performedBy: 'Chief Engineer, 2nd Engineer',
        notes: 'Replaced pressure relief valve, tested system'
      },
      {
        woNumber: 'WO-2024-0843',
        component: 'Steering Gear',
        completedDate: new Date('2024-09-19'),
        manHours: 8.0,
        performedBy: 'Chief Engineer, Motorman',
        notes: 'Complete hydraulic oil change and system flush'
      },
    ];
  }

  private getMockMonthlySummary() {
    return [
      {
        metric: 'Total Work Orders',
        planned: 45,
        completed: 42,
        onTime: 38,
        percentage: '84%'
      },
      {
        metric: 'Critical Jobs',
        planned: 8,
        completed: 8,
        onTime: 7,
        percentage: '88%'
      },
    ];
  }

  private getMockCriticalEquipment() {
    return [
      {
        component: 'Main Engine',
        totalJobs: 12,
        due: 2,
        overdue: 1,
        riskLevel: 'High'
      },
      {
        component: 'Fire Fighting System',
        totalJobs: 8,
        due: 1,
        overdue: 0,
        riskLevel: 'Critical'
      },
    ];
  }

  private getMockUnplannedJobs() {
    return [
      {
        woNumber: 'WO-2024-0850',
        failureCategory: 'Electrical',
        rootCause: 'Cable insulation failure',
        timeToRepair: 6.5,
        recurrence: false
      },
    ];
  }

  private getMockPostponementLog() {
    return [
      {
        woNumber: 'WO-2024-0848',
        originalDue: new Date('2024-09-15'),
        newDue: new Date('2024-09-30'),
        reason: 'Spare parts not available',
        approver: 'Chief Engineer'
      },
    ];
  }

  private getMockPriorityPerformance() {
    return [
      {
        priority: 'Critical',
        onTimePercentage: 95,
        averageDaysLate: 0.5
      },
      {
        priority: 'High',
        onTimePercentage: 87,
        averageDaysLate: 2.1
      },
    ];
  }

  private getMockManhoursAnalysis() {
    return [
      {
        woNumber: 'WO-2024-0845',
        plannedHours: 4.0,
        actualHours: 4.5,
        variance: 0.5,
        efficiency: '89%'
      },
    ];
  }

  private getMockWorkloadDistribution() {
    return [
      {
        rank: 'Chief Engineer',
        assignedJobs: 15,
        totalHours: 45.5,
        backlog: 3
      },
      {
        rank: '2nd Engineer',
        assignedJobs: 12,
        totalHours: 38.0,
        backlog: 2
      },
    ];
  }
}

export const reportGenerator = new ReportGeneratorService();