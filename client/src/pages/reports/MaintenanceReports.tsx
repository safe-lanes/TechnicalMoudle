import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  TrendingUp,
  Users,
  Settings,
  Eye,
  Loader2,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { pdfReportGenerator, fetchReportData, formatDate, formatReportDateRange } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";
import ReportPreviewModal, { ReportPreviewData } from "@/components/reports/ReportPreviewModal";
import InlineReportPreview from "@/components/reports/InlineReportPreview";
import MonthlySummaryPreview, { type MonthlySummaryData } from "@/components/reports/MonthlySummaryPreview";

interface MaintenanceReport {
  id: string;
  name: string;
  description: string;
  purpose: string;
  frequency: string;
  fields: string[];
  filters: string[];
  outputs: string[];
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
  lastGenerated?: string;
  estimatedTime: string;
}

interface MaintenanceReportsProps {
  onBack: () => void;
  globalFilters?: {
    vessels: string[];
    component: string;
    dateRange: { from: Date | null; to: Date | null };
  };
  embedded?: boolean;
  selectedReportId?: string | null;
  actionTrigger?: { type: 'pdf' | 'excel'; ts: number } | null;
}

const MaintenanceReports: React.FC<MaintenanceReportsProps> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: (globalFilters?.vessels?.length === 1 ? globalFilters.vessels[0] : "all"),
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [globalVessels, setGlobalVessels] = useState<string[]>(globalFilters?.vessels || []);
  const [globalComponent, setGlobalComponent] = useState<string>(globalFilters?.component || "");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const [monthlySummaryData, setMonthlySummaryData] = useState<{ data: MonthlySummaryData; vesselId: string; year: number; month: number } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isFilterRefreshing, setIsFilterRefreshing] = useState(false);
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(false);
  const previewVersionRef = useRef(0);
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId: contextVesselId } = useVessel();

  useEffect(() => {
    if (globalFilters?.vessels) {
      setGlobalVessels(globalFilters.vessels);
      const v = globalFilters.vessels.length === 1 ? globalFilters.vessels[0] : "all";
      setCategoryFilters(prev => ({ ...prev, vessel: v }));
    }
  }, [globalFilters?.vessels]);

  useEffect(() => {
    if (globalFilters?.dateRange) {
      setCategoryFilters(prev => ({ ...prev, dateRange: globalFilters.dateRange }));
    }
  }, [globalFilters?.dateRange]);

  useEffect(() => {
    if (globalFilters) {
      setGlobalComponent(globalFilters.component || "");
    }
  }, [globalFilters?.component]);

  const filterFingerprint = useMemo(() => JSON.stringify({
    v: globalFilters?.vessels,
    c: globalFilters?.component,
    df: globalFilters?.dateRange?.from?.getTime(),
    dt: globalFilters?.dateRange?.to?.getTime(),
  }), [globalFilters?.vessels, globalFilters?.component, globalFilters?.dateRange?.from, globalFilters?.dateRange?.to]);

  useEffect(() => {
    if (embedded && selectedReportId) {
      if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
      const version = ++previewVersionRef.current;
      setPreviewData(null);
      setMonthlySummaryData(null);
      setPreviewOpen(false);
      initialLoadRef.current = false;
      generateMaintenancePDF(selectedReportId, 'preview').then((data) => {
        if (previewVersionRef.current === version) {
          if (data) {
            setPreviewData(data);
            setPreviewOpen(true);
          }
          initialLoadRef.current = true;
        }
      }).catch((err) => { console.error('Report preview load failed:', err); });
    }
  }, [embedded, selectedReportId]);

  useEffect(() => {
    if (!embedded || !selectedReportId || !initialLoadRef.current) return;
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    setIsFilterRefreshing(true);
    const version = ++previewVersionRef.current;
    filterTimerRef.current = setTimeout(() => {
      setPreviewData(null);
      setMonthlySummaryData(null);
      generateMaintenancePDF(selectedReportId, 'preview').then((data) => {
        if (previewVersionRef.current === version) {
          if (data) setPreviewData(data);
          setIsFilterRefreshing(false);
        }
      }).catch(() => {
        if (previewVersionRef.current === version) setIsFilterRefreshing(false);
      });
    }, 300);
    return () => { if (filterTimerRef.current) clearTimeout(filterTimerRef.current); };
  }, [filterFingerprint]);

  useEffect(() => {
    if (!actionTrigger || !embedded || !selectedReportId) return;
    if (actionTrigger.type === 'pdf') {
      handleGenerateReport(selectedReportId, 'PDF');
    } else if (actionTrigger.type === 'excel') {
      handleGenerateReport(selectedReportId, 'Excel');
    }
  }, [actionTrigger]);
  
  const effectiveVesselId = categoryFilters.vessel === 'all' 
    ? 'all' 
    : (categoryFilters.vessel || contextVesselId);

  const { data: workOrders = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/work-orders', effectiveVesselId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveVesselId && effectiveVesselId !== 'all') {
        params.set('vesselId', effectiveVesselId);
      }
      const url = `/technical/api/work-orders${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch work orders');
      return response.json();
    },
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/jobs', effectiveVesselId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveVesselId && effectiveVesselId !== 'all') {
        params.set('vesselId', effectiveVesselId);
      }
      const url = `/technical/api/jobs${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
  });

  const reports: MaintenanceReport[] = [
    {
      id: "due-jobs-7",
      name: "Due Jobs (7 days)",
      description: "Upcoming work orders due in the next 7 days",
      purpose: "Plan upcoming work (Chief Eng/Chief Off)",
      frequency: "Daily/Weekly",
      fields: ["WO No/Title", "Component", "Dept", "Due Date/Hour", "Required Spares/Tools/Permits", "Risk Notes"],
      filters: ["Vessel", "Dept", "Priority", "Window (7/14/30)", "Component/System"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Clock,
      priority: "high",
      lastGenerated: "2 hours ago",
      estimatedTime: "< 1 min"
    },
    {
      id: "overdue-jobs",
      name: "Overdue Jobs",
      description: "Work orders that are past their due dates requiring immediate attention",
      purpose: "Focus late work & escalation (Vessel/Office)",
      frequency: "Daily",
      fields: ["WO", "Component", "Days Overdue", "Reason/Comments", "Escalation Status", "Approver"],
      filters: ["Vessel", "Dept", "Priority", "Critical"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: AlertTriangle,
      priority: "high",
      lastGenerated: "1 hour ago",
      estimatedTime: "< 1 min"
    },
    {
      id: "completed-jobs",
      name: "Completed Jobs Register",
      description: "Comprehensive register of all completed maintenance work",
      purpose: "Evidence of work done (Audits/Office)",
      frequency: "Weekly/Monthly",
      fields: ["WO", "Component", "Dates (Start/Finish)", "Man-Hours", "Performed By", "Part-B Notes", "Attachments"],
      filters: ["Vessel", "Dept", "Date Range", "Component"],
      outputs: ["PDF", "Excel"],
      icon: CheckCircle,
      priority: "medium",
      lastGenerated: "1 day ago",
      estimatedTime: "2-3 min"
    },
    {
      id: "monthly-summary",
      name: "Monthly Maintenance Summary",
      description: "KPI overview and performance metrics for management",
      purpose: "KPI overview (Management)",
      frequency: "Monthly",
      fields: ["Planned vs Completed", "On-time %", "Avg Days Late", "Breakdown by Dept/System/Criticality", "Trend vs last 3 months"],
      filters: ["Vessel", "Dept", "Period"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: TrendingUp,
      priority: "medium",
      lastGenerated: "3 days ago",
      estimatedTime: "3-5 min"
    },
    {
      id: "critical-equipment",
      name: "Critical Equipment Status",
      description: "Status report for SOLAS-critical and class-critical equipment (component-centric view)",
      purpose: "Regulatory compliance & risk (All stakeholders)",
      frequency: "Weekly",
      fields: ["Comp. Code", "Component Name", "Critical (Yes/No)", "Class Item (Yes/No)", "Dept", "Location", "Total WOs", "Overdue", "Due Soon", "Next Due", "Days"],
      filters: ["Vessel", "Critical System List", "Status"],
      outputs: ["PDF", "Excel"],
      icon: Settings,
      priority: "high",
      lastGenerated: "6 hours ago",
      estimatedTime: "1-2 min"
    },
    {
      id: "unplanned-jobs",
      name: "Unplanned/Breakdown Jobs",
      description: "Analysis of breakdown maintenance and unplanned work",
      purpose: "Identify reliability issues (Office/RCA)",
      frequency: "Monthly",
      fields: ["WO", "Failure Category", "Root-Cause (if known)", "Time-to-Repair", "Recurrence Flag"],
      filters: ["Vessel", "Dept", "Failure Category", "Date Range"],
      outputs: ["PDF", "Excel"],
      icon: AlertTriangle,
      priority: "medium",
      lastGenerated: "1 week ago",
      estimatedTime: "2-3 min"
    },
    {
      id: "postponement-log",
      name: "Job Postponement Log",
      description: "Audit trail of all postponed jobs with justifications",
      purpose: "Audit trail for deferred work (Vessel/Office)",
      frequency: "Monthly",
      fields: ["WO", "Original Due", "New Due", "Postponement Reason", "Approver", "Office Approval"],
      filters: ["Vessel", "Dept", "Approval Status", "Date Range"],
      outputs: ["PDF", "Excel"],
      icon: Clock,
      priority: "medium",
      lastGenerated: "2 days ago",
      estimatedTime: "1-2 min"
    },
    {
      id: "priority-performance",
      name: "Work Priority Performance",
      description: "Performance analysis by work order priority levels",
      purpose: "Ensure critical jobs get attention (Office)",
      frequency: "Monthly",
      fields: ["On-time %", "Avg Days Late", "Trend"],
      filters: ["Vessel", "Dept", "Date Range"],
      outputs: ["PDF", "Dashboard"],
      icon: TrendingUp,
      priority: "low",
      lastGenerated: "5 days ago",
      estimatedTime: "2-3 min",
      hidden: true
    },
    {
      id: "manhours-analysis",
      name: "Man-Hours Planned vs Actual",
      description: "Resource planning analysis comparing estimated vs actual hours",
      purpose: "Resourcing (Office)",
      frequency: "Monthly",
      fields: ["WO", "Planned Hrs", "Actual Hrs", "Variance", "Rank Mix", "Comments"],
      filters: ["Vessel", "Dept", "Date Range"],
      outputs: ["PDF", "Excel"],
      icon: Users,
      priority: "medium",
      lastGenerated: "1 week ago",
      estimatedTime: "3-4 min",
      hidden: true
    },
    {
      id: "workload-distribution",
      name: "Crew Workload Distribution",
      description: "Analysis of task distribution across crew ranks and assignments",
      purpose: "Balance tasks across ranks (Vessel/Office)",
      frequency: "Monthly",
      fields: ["Jobs/Hours by Assignee/Rank", "Overtime Flags", "Backlog by Rank"],
      filters: ["Vessel", "Dept", "Period"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Users,
      priority: "low",
      lastGenerated: "1 week ago",
      estimatedTime: "2-3 min"
    }
  ];

  const filteredReports = reports.filter(report => {
    if ((report as any).hidden) return false;
    if (embedded && selectedReportId) return report.id === selectedReportId;
    
    const matchesSearch = report.name.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase()) ||
                         report.purpose.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toLocalDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateMaintenancePDF = async (reportId: string, mode: 'download' | 'preview' = 'download'): Promise<ReportPreviewData | void> => {
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Use globalFilters.dateRange as the authoritative source for date range because
    // filterFingerprint (which triggers this function) is based on globalFilters.
    // categoryFilters.dateRange lags one render behind due to its useEffect sync.
    // When globalFilters is available (embedded mode), always prefer it — even when
    // both from and to are null (i.e. the filter was cleared).
    const effectiveDateRange = globalFilters?.dateRange !== undefined
      ? globalFilters.dateRange
      : categoryFilters.dateRange;
    
    const vesselWorkOrders = filteredWorkOrders;

    const applyComponentFilter = (items: any[]) => {
      if (!globalComponent) return items;
      const q = globalComponent.toLowerCase();
      return items.filter((item: any) => {
        const compName = (item.componentName || item.component || "").toLowerCase();
        const compCode = (item.componentCode || "").toLowerCase();
        return compName.includes(q) || compCode.includes(q);
      });
    };

    switch (reportId) {
      case 'due-jobs-7': {
        const dueJobsResponse = await fetch(
          `/technical/api/reports/due-jobs-7-days/preview?vesselId=${effectiveVesselId}`
        );
        if (!dueJobsResponse.ok) {
          throw new Error('Failed to fetch due jobs data');
        }
        const { data: dueJobsRaw, vesselName: dueVessel, summary: dueJobsSummary } = await dueJobsResponse.json();

        const filteredDueJobs = applyComponentFilter(dueJobsRaw);

        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Status', field: 'statusIndicator', width: 22 },
          { header: 'WO Number', field: 'workOrderNo', width: 45 },
          { header: 'Title', field: 'jobTitle', width: 70 },
          { header: 'Component', field: 'componentName', width: 50 },
          { header: 'Due Date', field: 'formattedDueDate', width: 26 },
          { header: 'Days Left', field: 'daysRemaining', width: 20 },
          { header: 'Assigned To', field: 'assignedTo', width: 35 }
        ];

        const data = filteredDueJobs.map((job: any, index: number) => ({
          sno: index + 1,
          workOrderNo: job.workOrderNo,
          jobTitle: job.jobTitle,
          componentName: job.componentName,
          priority: job.priority,
          formattedDueDate: formatDate(job.dueDate),
          statusIndicator: job.statusIndicator,
          daysRemaining: job.daysRemaining,
          assignedTo: job.assignedTo
        }));

        const summary = [
          { label: 'Total Due', value: data.length },
          { label: 'Overdue', value: data.filter((d: any) => d.statusIndicator === 'OVERDUE').length },
          { label: 'Urgent (≤2d)', value: data.filter((d: any) => typeof d.daysRemaining === 'number' && d.daysRemaining <= 2 && d.daysRemaining >= 0).length },
          { label: 'Critical Priority', value: data.filter((d: any) => d.priority === 'Critical').length }
        ];

        if (mode === 'preview') return { title: 'Due Jobs (7 Days)', subtitle: 'Work orders due in the next 7 days (including overdue)', vessel: dueVessel || vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to), columns, data, summary } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { title: 'Due Jobs (7 Days)', subtitle: 'Work orders due in the next 7 days (including overdue)', vessel: dueVessel || vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to) },
          columns,
          data
        );
        break;
      }

      case 'overdue-jobs': {
        let overdueUrl = `/technical/api/reports/overdue-jobs/preview?vesselId=${effectiveVesselId}`;
        if (effectiveDateRange?.from) {
          overdueUrl += `&dateFrom=${toLocalDateStr(effectiveDateRange.from)}`;
        }
        if (effectiveDateRange?.to) {
          overdueUrl += `&dateTo=${toLocalDateStr(effectiveDateRange.to)}`;
        }
        const overdueResponse = await fetch(overdueUrl);
        if (!overdueResponse.ok) {
          throw new Error('Failed to fetch overdue jobs data');
        }
        const { data: overdueRaw, vesselName: overdueVessel, summary: overdueSummary } = await overdueResponse.json();

        const filteredOverdue = applyComponentFilter(overdueRaw);

        const columns = [
          { header: 'S.No', field: 'sNo', width: 8 },
          { header: 'WO Code', field: 'workOrderNo', width: 30 },
          { header: 'WO Title', field: 'jobTitle', width: 40 },
          { header: 'Component Code', field: 'componentCode', width: 18 },
          { header: 'Component Name', field: 'componentName', width: 32 },
          { header: 'Department', field: 'department', width: 14 },
          { header: 'Task Type', field: 'taskType', width: 16 },
          { header: 'Job Type', field: 'jobType', width: 16 },
          { header: 'Last Done Date', field: 'lastDoneDate', width: 18 },
          { header: 'Due Date', field: 'dueDate', width: 18 },
          { header: 'RH When Last Done', field: 'rhWhenLastDone', width: 18 },
          { header: 'Days/RH Overdue', field: 'daysRhOverdue', width: 18 },
          { header: 'Assigned To', field: 'assignedTo', width: 20 },
          { header: 'Critical', field: 'critical', width: 12 }
        ];

        const data = filteredOverdue.map((job: any, index: number) => {
          const overdueType = job.overdueType || '';
          let daysRhOverdue = '-';
          if (overdueType === 'RH' || overdueType === 'Both') {
            daysRhOverdue = job.hoursPastDue > 0 ? `${job.hoursPastDue} RH` : '-';
          } else if (overdueType === 'Calendar') {
            daysRhOverdue = job.daysPastDue > 0 ? `${job.daysPastDue} days` : '-';
          }
          return {
            sNo: index + 1,
            workOrderNo: job.workOrderNo,
            jobTitle: job.jobTitle,
            componentCode: job.componentCode,
            componentName: job.componentName,
            department: job.department,
            taskType: job.taskType || '-',
            jobType: job.maintenanceBasis || '-',
            lastDoneDate: job.lastDoneDate,
            dueDate: formatDate(job.dueDate),
            rhWhenLastDone: job.lastDoneRH ?? '-',
            daysRhOverdue,
            overdueType,
            assignedTo: job.assignedTo,
            critical: job.critical
          };
        });

        const calendarCount = data.filter((d: any) => d.overdueType === 'Calendar' || d.overdueType === 'Both').length;
        const rhCount = data.filter((d: any) => d.overdueType === 'RH' || d.overdueType === 'Running Hours' || d.overdueType === 'Both').length;
        const daysValues = data.map((d: any) => {
          const m = (d.daysRhOverdue || '').match(/(\d+)\s*days/);
          return m ? parseInt(m[1]) : 0;
        }).filter((v: number) => v > 0);
        const avgDays = daysValues.length > 0 ? Math.round(daysValues.reduce((a: number, b: number) => a + b, 0) / daysValues.length) : overdueSummary.avgDaysOverdue;
        const maxDays = daysValues.length > 0 ? Math.max(...daysValues) : overdueSummary.maxDaysOverdue;
        const summary = [
          { label: 'Total Overdue', value: data.length },
          { label: 'Critical Equip', value: data.filter((d: any) => d.critical === 'YES' || d.critical === 'Yes').length, color: 'highlight' },
          { label: 'Avg Days Overdue', value: avgDays },
          { label: 'Max Days Overdue', value: `${maxDays}d` },
          { label: 'Calendar/RH', value: `${calendarCount}/${rhCount}` }
        ];

        if (mode === 'preview') return { title: 'OVERDUE JOBS REPORT', subtitle: 'Work orders past grace period (7 days calendar / 168 RH overdue)', vessel: overdueVessel || vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to), columns, data, summary } as ReportPreviewData;

        pdfReportGenerator.generateOverdueJobsReport(
          { 
            title: 'OVERDUE JOBS REPORT', 
            subtitle: 'Work orders past grace period (7 days calendar / 168 RH overdue)', 
            vessel: overdueVessel || vesselName,
            dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to)
          },
          columns,
          data
        );
        break;
      }

      case 'completed-jobs': {
        let completedUrl = `/technical/api/reports/completed-jobs/preview?vesselId=${effectiveVesselId}`;
        if (effectiveDateRange?.from) {
          completedUrl += `&dateFrom=${toLocalDateStr(effectiveDateRange.from)}`;
        }
        if (effectiveDateRange?.to) {
          completedUrl += `&dateTo=${toLocalDateStr(effectiveDateRange.to)}`;
        }
        const completedResponse = await fetch(completedUrl);
        if (!completedResponse.ok) {
          throw new Error('Failed to fetch completed jobs data');
        }
        const { data: completedRawAll, vesselName: completedVessel, summary: completedSummaryData } = await completedResponse.json();
        const completedRaw = applyComponentFilter(completedRawAll);

        const completedColumns = [
          { header: 'S.No', field: 'sNo', width: 8 },
          { header: 'WO No', field: 'workOrderNo', width: 22 },
          { header: 'Component', field: 'componentName', width: 28 },
          { header: 'Job Title', field: 'jobTitle', width: 30 },
          { header: 'Job Type', field: 'jobType', width: 14 },
          { header: 'Dept', field: 'department', width: 12 },
          { header: 'Assigned To', field: 'assignedTo', width: 18 },
          { header: 'Start Date', field: 'startDate', width: 16 },
          { header: 'Completion Date', field: 'completionDate', width: 16 },
          { header: 'Man Hours', field: 'manHours', width: 12 },
          { header: 'Skipped Cycles', field: 'skippedCycles', width: 14 }
        ];

        const data = completedRaw;

        if (mode === 'preview') {
          const filteredManHours = data.reduce((sum: number, d: any) => sum + (parseFloat(d.manHours) || 0), 0);
          const completedSummary = [
            { label: 'Total Jobs', value: data.length },
            { label: 'Total Man-Hours', value: filteredManHours.toFixed(1) }
          ];
          return { title: 'COMPLETED JOBS REGISTER', subtitle: `Vessel: ${completedVessel || vesselName}`, vessel: completedVessel || vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to), columns: completedColumns, data, summary: completedSummary } as ReportPreviewData;
        }

        const pdfManHours = data.reduce((sum: number, d: any) => sum + (parseFloat(d.manHours) || 0), 0);
        pdfReportGenerator.generateReport(
          { 
            title: 'COMPLETED JOBS REGISTER', 
            subtitle: `${data.length} completed jobs | ${pdfManHours.toFixed(1)} total man-hours`,
            vessel: completedVessel || vesselName,
            orientation: 'landscape',
            dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to)
          },
          completedColumns,
          data
        );
        break;
      }

      case 'monthly-summary': {
        let periodYear: number;
        let periodMonth: number;
        if (globalFilters?.dateRange?.from) {
          periodYear = globalFilters.dateRange.from.getFullYear();
          periodMonth = globalFilters.dateRange.from.getMonth() + 1;
        } else {
          periodYear = now.getFullYear();
          periodMonth = now.getMonth() + 1;
        }

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        const periodLabel = `${monthNames[periodMonth - 1]} ${periodYear}`;

        const res = await fetch(`/technical/api/reports/maintenance/monthly-summary/preview?vesselId=${effectiveVesselId}&year=${periodYear}&month=${periodMonth}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to fetch monthly summary' }));
          throw new Error(err.error || 'Failed to fetch monthly summary');
        }
        const summaryApiData: MonthlySummaryData = await res.json();

        if (mode === 'preview') {
          setMonthlySummaryData({ data: summaryApiData, vesselId: effectiveVesselId, year: periodYear, month: periodMonth });
          return { title: 'Monthly Maintenance Summary', subtitle: `Control report for ${periodLabel}`, vessel: vesselName, dateRange: periodLabel, columns: [], data: [], summary: [] } as ReportPreviewData;
        }

        const categories = ['Planned', 'Due', 'Overdue', 'Postponed', 'Unplanned', 'Pending Approval', 'Completed'];
        const pdfColumns = [
          { header: 'Category', field: 'category', width: 40 },
          { header: 'Opening', field: 'opening', width: 20 },
          { header: 'Movement', field: 'movement', width: 30 },
          { header: 'Closing', field: 'closing', width: 20 }
        ];
        const pdfData: Array<{ category: string; opening: string | number; movement: string; closing: string | number }> = categories.map(c => ({
          category: c,
          opening: summaryApiData.opening[c]?.count ?? 0,
          movement: '-',
          closing: summaryApiData.closing[c]?.count ?? 0,
        }));
        pdfData.push(
          { category: '', opening: '', movement: '', closing: '' },
          { category: 'New Jobs Entered', opening: '', movement: String(summaryApiData.movement.newJobsEntered.count), closing: '' },
          { category: 'Completed in Month', opening: '', movement: String(summaryApiData.movement.completedInMonth.count), closing: '' },
          { category: 'Postponed in Month', opening: '', movement: String(summaryApiData.movement.postponedInMonth.count), closing: '' },
          { category: 'Newly Overdue', opening: '', movement: String(summaryApiData.movement.newlyOverdue.count), closing: '' },
        );

        pdfReportGenerator.generateReport(
          { title: 'Monthly Maintenance Summary', subtitle: `Control report for ${periodLabel}`, vessel: vesselName, dateRange: periodLabel },
          pdfColumns,
          pdfData
        );
        break;
      }

      case 'critical-equipment': {
        let critUrl = `/technical/api/reports/critical-equipment-status?vesselId=${effectiveVesselId}`;
        if (effectiveDateRange?.from) {
          critUrl += `&startDate=${toLocalDateStr(effectiveDateRange.from)}`;
        }
        if (effectiveDateRange?.to) {
          critUrl += `&endDate=${toLocalDateStr(effectiveDateRange.to)}`;
        }
        const response = await fetch(critUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch critical equipment data');
        }
        const { data: criticalDataRaw, metadata } = await response.json();
        const criticalData = applyComponentFilter(criticalDataRaw);

        const columns = [
          { header: 'S.No', field: 'sNo', width: 8 },
          { header: 'Comp. Code', field: 'componentCode', width: 18 },
          { header: 'Component Name', field: 'componentName', width: 38 },
          { header: 'Critical', field: 'isCritical', width: 12 },
          { header: 'Class Item', field: 'isClassItem', width: 12 },
          { header: 'Dept', field: 'department', width: 15 },
          { header: 'Location', field: 'location', width: 15 },
          { header: 'Total WOs', field: 'totalWorkOrders', width: 12 },
          { header: 'Overdue', field: 'overdueJobs', width: 12 },
          { header: 'Due Soon', field: 'dueSoonJobs', width: 12 },
          { header: 'Next Due', field: 'nextDueDate', width: 18 },
          { header: 'Days', field: 'daysUntilDue', width: 10 }
        ];

        // Transform data for display
        const data = criticalData.map((row: any) => ({
          ...row,
          nextDueDate: row.nextDueDate ? formatDate(row.nextDueDate) : '-',
          daysUntilDue: row.daysUntilDue !== null ? row.daysUntilDue : '-'
        }));

        const summary = [
          { label: 'Total Critical Equipment', value: data.length },
          { label: 'Critical Only', value: data.filter((d: any) => d.isCritical === 'Yes' && d.isClassItem !== 'Yes').length },
          { label: 'Class Item Only', value: data.filter((d: any) => d.isClassItem === 'Yes' && d.isCritical !== 'Yes').length },
          { label: 'Both Critical & Class', value: data.filter((d: any) => d.isCritical === 'Yes' && d.isClassItem === 'Yes').length },
          { label: 'With Overdue Jobs', value: data.filter((d: any) => (d.overdueJobs || 0) > 0).length, color: 'highlight' },
          { label: (effectiveDateRange?.from || effectiveDateRange?.to) ? 'Due in Period' : 'Due Soon (7 days)', value: data.filter((d: any) => (d.dueSoonJobs || 0) > 0).length }
        ];

        if (mode === 'preview') return { title: 'CRITICAL EQUIPMENT STATUS REPORT', subtitle: 'SOLAS-critical and class-critical equipment', vessel: vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to), columns, data, summary } as ReportPreviewData;

        const filteredMetadata = {
          totalCriticalEquipment: data.length,
          criticalOnly: data.filter((d: any) => d.isCritical === 'Yes' && d.isClassItem !== 'Yes').length,
          classItemOnly: data.filter((d: any) => d.isClassItem === 'Yes' && d.isCritical !== 'Yes').length,
          bothCriticalAndClass: data.filter((d: any) => d.isCritical === 'Yes' && d.isClassItem === 'Yes').length,
          equipmentWithOverdue: data.filter((d: any) => (d.overdueJobs || 0) > 0).length,
          equipmentDueSoon: data.filter((d: any) => (d.dueSoonJobs || 0) > 0).length,
        };
        pdfReportGenerator.generateCriticalEquipmentReport(
          { 
            title: 'CRITICAL EQUIPMENT STATUS REPORT', 
            subtitle: 'SOLAS-critical and class-critical equipment', 
            vessel: vesselName,
            dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to)
          },
          columns,
          data,
          filteredMetadata
        );
        break;
      }

      case 'unplanned-jobs': {
        const dateFrom = effectiveDateRange?.from || new Date(now.getFullYear(), now.getMonth(), 1);
        const dateTo = effectiveDateRange?.to || new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const startDate = toLocalDateStr(dateFrom);
        const endDate = toLocalDateStr(dateTo);

        // Fetch data from the API endpoint
        const response = await fetch(
          `/technical/api/reports/unplanned-breakdown-jobs?vesselId=${effectiveVesselId}&startDate=${startDate}&endDate=${endDate}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch unplanned/breakdown jobs data');
        }
        const { data: unplannedDataRaw, metadata } = await response.json();
        const unplannedData = applyComponentFilter(unplannedDataRaw);

        const columns = [
          { header: 'S.No', field: 'sNo', width: 8 },
          { header: 'WO Number', field: 'workOrderNo', width: 20 },
          { header: 'Comp. Code', field: 'componentCode', width: 15 },
          { header: 'Component Name', field: 'componentName', width: 30 },
          { header: 'Job Title', field: 'jobTitle', width: 25 },
          { header: 'Description', field: 'briefDescription', width: 35 },
          { header: 'Created Date', field: 'createdDate', width: 16 },
          { header: 'Completed Date', field: 'completedDate', width: 16 },
          { header: 'Performed By', field: 'performedBy', width: 18 },
          { header: 'Hours', field: 'totalHours', width: 10 },
          { header: 'Manhours', field: 'manhours', width: 12 }
        ];

        // Build summary matching specification
        const filteredTotalManhours = unplannedData.reduce((sum: number, d: any) => sum + (parseFloat(d.manhours) || 0), 0);
        const filteredTotalHours = unplannedData.reduce((sum: number, d: any) => sum + (parseFloat(d.totalHours) || 0), 0);
        const summary = [
          { label: 'Total Unplanned Jobs', value: unplannedData.length },
          { label: 'Total Manhours', value: filteredTotalManhours.toFixed(1) },
          { label: 'Avg Time Taken (hrs)', value: unplannedData.length > 0 ? (filteredTotalHours / unplannedData.length).toFixed(1) : '0' },
          { label: 'Date Range', value: `${startDate} to ${endDate}` }
        ];

        if (mode === 'preview') return { title: 'UNPLANNED/BREAKDOWN JOBS REPORT', subtitle: 'Analysis of breakdown maintenance and unplanned work', vessel: vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to), columns, data: unplannedData, summary } as ReportPreviewData;

        pdfReportGenerator.generateUnplannedBreakdownReport(
          { 
            title: 'UNPLANNED/BREAKDOWN JOBS REPORT', 
            subtitle: 'Analysis of breakdown maintenance and unplanned work', 
            vessel: vesselName,
            dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to)
          },
          columns,
          unplannedData,
          metadata
        );
        break;
      }

      case 'postponement-log': {
        let postponeUrl = `/technical/api/reports/postponement-log/preview?vesselId=${effectiveVesselId}`;
        if (effectiveDateRange?.from) {
          postponeUrl += `&dateFrom=${toLocalDateStr(effectiveDateRange.from)}`;
        }
        if (effectiveDateRange?.to) {
          postponeUrl += `&dateTo=${toLocalDateStr(effectiveDateRange.to)}`;
        }
        const postponeResponse = await fetch(postponeUrl);
        if (!postponeResponse.ok) {
          throw new Error('Failed to fetch postponement log data');
        }
        const { data: postponeRawAll, vesselName: postponeVessel, summary: postponeSummary } = await postponeResponse.json();
        const postponeRaw = applyComponentFilter(postponeRawAll);

        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'WO Number', field: 'workOrderNo', width: 35 },
          { header: 'Job Title', field: 'jobTitle', width: 55 },
          { header: 'Component', field: 'componentName', width: 45 },
          { header: 'Dept', field: 'department', width: 20 },
          { header: 'Original Due', field: 'originalDueDate', width: 25 },
          { header: 'New Due', field: 'newDueDate', width: 25 },
          { header: 'Days Extended', field: 'durationDays', width: 22 },
          { header: 'Reason', field: 'postponementReason', width: 50 },
          { header: 'Status', field: 'status', width: 22 }
        ];

        const data = postponeRaw.map((job: any, idx: number) => ({
          sno: idx + 1,
          workOrderNo: job.workOrderNo,
          jobTitle: job.jobTitle,
          componentName: job.componentName,
          department: job.department,
          originalDueDate: job.originalDueDate,
          newDueDate: job.newDueDate,
          durationDays: job.durationDays > 0 ? job.durationDays : '-',
          postponementReason: job.postponementReason,
          status: job.status
        }));

        const summary = [
          { label: 'Total Postponed Jobs', value: data.length }
        ];

        if (mode === 'preview') return { title: 'Job Postponement Log Report', subtitle: 'Audit trail of all postponed jobs with approvals and justifications', vessel: postponeVessel || vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to), columns, data, summary } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { 
            title: 'Job Postponement Log Report', 
            subtitle: 'Audit trail of all postponed jobs with approvals and justifications', 
            vessel: postponeVessel || vesselName,
            orientation: 'landscape',
            dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to)
          },
          columns,
          data
        );
        break;
      }

      case 'priority-performance': {
        const priorityGroups: Record<string, { total: number; completed: number; overdue: number }> = {};
        
        const ppFilteredWOs = isDateRangeSet
          ? vesselWorkOrders.filter((wo: any) => isDateInRange(wo.dueDate, dateFrom, dateTo))
          : vesselWorkOrders;
        ppFilteredWOs.forEach((wo: any) => {
          const priority = wo.jobPriority || 'Normal';
          if (!priorityGroups[priority]) {
            priorityGroups[priority] = { total: 0, completed: 0, overdue: 0 };
          }
          priorityGroups[priority].total++;
          if (wo.status === 'Completed') priorityGroups[priority].completed++;
          if (wo.dueDate && new Date(wo.dueDate) < now && wo.status !== 'Completed') {
            priorityGroups[priority].overdue++;
          }
        });

        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Total WOs', field: 'total', width: 30 },
          { header: 'Completed', field: 'completed', width: 30 },
          { header: 'On-Time %', field: 'onTimePercent', width: 30 },
          { header: 'Overdue', field: 'overdue', width: 30 }
        ];

        const data = Object.entries(priorityGroups).map(([priority, stats], index) => ({
          sno: index + 1,
          priority,
          total: stats.total,
          completed: stats.completed,
          onTimePercent: stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : '0%',
          overdue: stats.overdue
        }));

        if (mode === 'preview') return { title: 'Work Priority Performance', subtitle: 'Performance analysis by priority levels', vessel: vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to), columns, data } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { title: 'Work Priority Performance', subtitle: 'Performance analysis by priority levels', vessel: vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to) },
          columns,
          data
        );
        break;
      }

      case 'manhours-analysis': {
        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'WO Number', field: 'workOrderNumber', width: 40 },
          { header: 'Title', field: 'title', width: 60 },
          { header: 'Planned Hrs', field: 'plannedHours', width: 30 },
          { header: 'Actual Hrs', field: 'actualHours', width: 30 },
          { header: 'Variance', field: 'variance', width: 30 }
        ];

        const data = vesselWorkOrders
          .filter((wo: any) => wo.status === 'Completed' && (!isDateRangeSet || isDateInRange(wo.dateCompleted || wo.completedDate, dateFrom, dateTo)))
          .map((wo: any, index: number) => {
            const planned = wo.plannedHours || wo.estimatedHours || 0;
            const actual = wo.actualHours || wo.hoursSpent || planned;
            return {
              sno: index + 1,
              workOrderNumber: wo.workOrderNumber || wo.id,
              title: wo.title || wo.jobTitle || '-',
              plannedHours: planned,
              actualHours: actual,
              variance: actual - planned
            };
          });

        if (mode === 'preview') return { title: 'Man-Hours Analysis', subtitle: 'Planned vs Actual hours comparison', vessel: vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to), columns, data } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { title: 'Man-Hours Analysis', subtitle: 'Planned vs Actual hours comparison', vessel: vesselName, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to) },
          columns,
          data
        );
        break;
      }

      case 'workload-distribution': {
        let wdStartDate: string;
        let wdEndDate: string;
        if (globalFilters?.dateRange?.from && globalFilters?.dateRange?.to) {
          wdStartDate = toLocalDateStr(globalFilters.dateRange.from);
          wdEndDate = toLocalDateStr(globalFilters.dateRange.to);
        } else if (effectiveDateRange?.from && effectiveDateRange?.to) {
          wdStartDate = toLocalDateStr(effectiveDateRange.from);
          wdEndDate = toLocalDateStr(effectiveDateRange.to);
        } else {
          const wdNow = new Date();
          wdStartDate = toLocalDateStr(new Date(wdNow.getFullYear(), wdNow.getMonth(), 1));
          wdEndDate = toLocalDateStr(new Date(wdNow.getFullYear(), wdNow.getMonth() + 1, 0));
        }
        const wdResponse = await fetch(
          `/technical/api/reports/crew-workload-distribution?vesselId=${effectiveVesselId}&startDate=${wdStartDate}&endDate=${wdEndDate}&viewType=summary`
        );
        if (!wdResponse.ok) {
          throw new Error('Failed to fetch crew workload data');
        }
        const wdResult = await wdResponse.json();
        const wdData = wdResult.data || [];
        const wdMeta = wdResult.metadata || {};

        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Rank', field: 'rank', width: 45 },
          { header: 'Dept', field: 'department', width: 25 },
          { header: 'Total', field: 'totalJobs', width: 22 },
          { header: 'Done', field: 'completedJobs', width: 22 },
          { header: 'Pending', field: 'pendingJobs', width: 22 },
          { header: 'Overdue', field: 'overdueJobs', width: 22 },
          { header: 'Manhours', field: 'totalManhours', width: 28 },
          { header: 'Avg Time', field: 'avgTimePerJob', width: 25 },
          { header: 'Rate %', field: 'completionRate', width: 25 },
          { header: 'Load %', field: 'workloadPercent', width: 25 }
        ];

        const data = wdData.map((row: any, index: number) => ({
          sno: index + 1,
          rank: row.rank || row.assignedTo || 'Unassigned',
          department: row.department || 'N/A',
          totalJobs: row.totalJobs ?? row.total ?? 0,
          completedJobs: row.completedJobs ?? row.completed ?? 0,
          pendingJobs: row.pendingJobs ?? row.pending ?? 0,
          overdueJobs: row.overdueJobs ?? row.overdue ?? 0,
          totalManhours: row.totalManhours != null ? Number(row.totalManhours).toFixed(1) : '0.0',
          avgTimePerJob: row.avgTimePerJob != null ? Number(row.avgTimePerJob).toFixed(1) : '-',
          completionRate: row.completionRate != null ? `${row.completionRate}%` : '0%',
          workloadPercent: row.workloadPercent != null ? `${row.workloadPercent}%` : '0%'
        }));

        const summary = [
          { label: 'Total Crew Members', value: wdMeta.totalCrewMembers || data.length },
          { label: 'Total Jobs', value: wdMeta.totalJobs || 0 },
          { label: 'Total Completed', value: wdMeta.totalCompleted || 0 },
          { label: 'Total Overdue', value: wdMeta.totalOverdue || 0 },
          { label: 'Total Manhours', value: wdMeta.totalManhours != null ? Number(wdMeta.totalManhours).toFixed(1) : '0.0' }
        ];

        const wdVessel = wdMeta.vesselName || vesselName;

        if (mode === 'preview') return { title: 'Crew Workload Distribution', subtitle: 'Task distribution across crew ranks and assignments', vessel: wdVessel, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to), columns, data, summary } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { title: 'Crew Workload Distribution', subtitle: 'Task distribution across crew ranks and assignments', vessel: wdVessel, dateRange: formatReportDateRange(effectiveDateRange?.from, effectiveDateRange?.to) },
          columns,
          data
        );
        break;
      }

      default:
        toast({
          title: "Report Not Available",
          description: "This report type is not yet implemented",
          variant: "destructive"
        });
    }
  };

  const generateExcelReport = async (reportId: string) => {
    if (!effectiveVesselId || effectiveVesselId === 'all') {
      toast({
        title: "Vessel Required",
        description: "Please select a specific vessel to generate the report.",
        variant: "destructive",
      });
      return;
    }

    const reportEndpoints: Record<string, string> = {
      'due-jobs-7': '/technical/api/reports/due-jobs-7-days',
      'overdue-jobs': '/technical/api/reports/overdue-jobs',
      'completed-jobs': '/technical/api/reports/completed-jobs',
      'unplanned-jobs': '/technical/api/reports/unplanned-breakdown-jobs/excel',
      'postponement-log': '/technical/api/reports/postponement-log',
      'monthly-summary': '/technical/api/reports/maintenance/monthly-summary/excel',
      'critical-equipment': '/technical/api/reports/critical-equipment-status/excel',
      'workload-distribution': '/technical/api/reports/crew-workload-distribution/excel',
    };

    const endpoint = reportEndpoints[reportId];
    if (!endpoint) {
      toast({
        title: "Excel Export",
        description: "Excel export for this report is coming soon. PDF is currently available.",
      });
      return;
    }

    let requestBody: any = { vesselId: effectiveVesselId };

    if (globalComponent) {
      requestBody.componentFilter = globalComponent;
    }
    
    // Add date range for reports that support it
    if (reportId === 'monthly-summary' || reportId === 'completed-jobs' || reportId === 'unplanned-jobs' || reportId === 'workload-distribution' || reportId === 'postponement-log' || reportId === 'critical-equipment' || reportId === 'overdue-jobs') {
      const dateFrom = categoryFilters.dateRange?.from;
      const dateTo = categoryFilters.dateRange?.to;
      
      if (reportId !== 'critical-equipment') {
        if (dateFrom) {
          requestBody.dateFrom = toLocalDateStr(dateFrom);
        }
        if (dateTo) {
          requestBody.dateTo = toLocalDateStr(dateTo);
        }
      }
      
      if (reportId === 'monthly-summary' || reportId === 'unplanned-jobs' || reportId === 'workload-distribution' || reportId === 'critical-equipment') {
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        
        if (categoryFilters.dateRange?.from && categoryFilters.dateRange?.to) {
          startDate = categoryFilters.dateRange.from;
          endDate = categoryFilters.dateRange.to;
        } else if (globalFilters?.dateRange?.from && globalFilters?.dateRange?.to) {
          startDate = globalFilters.dateRange.from;
          endDate = globalFilters.dateRange.to;
        } else if (reportId !== 'critical-equipment') {
          const now = new Date();
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        if (startDate) requestBody.startDate = toLocalDateStr(startDate);
        if (endDate) requestBody.endDate = toLocalDateStr(endDate);

        if (reportId === 'monthly-summary' && startDate) {
          requestBody.year = startDate.getFullYear();
          requestBody.month = startDate.getMonth() + 1;
        }
      }
      
      // Add viewType for workload-distribution (default to summary view)
      if (reportId === 'workload-distribution') {
        requestBody.viewType = 'summary'; // Default to summary view for Excel export
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate report');
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `report_${reportId}.xlsx`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        filename = match[1];
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel' | 'CSV') => {
    const reportKey = `${reportId}-${format}`;
    
    if (generatingReports.has(reportKey)) {
      return;
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      
      toast({
        title: "Generating Report",
        description: `Creating ${format} report...`,
      });

      if (format === 'PDF') {
        await generateMaintenancePDF(reportId);
      } else if (format === 'Excel') {
        await generateExcelReport(reportId);
      } else {
        toast({
          title: "CSV Export",
          description: "CSV export coming soon.",
        });
        return;
      }
      
      toast({
        title: "Report Generated",
        description: `${format} report downloaded successfully!`,
      });
      
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: "Generation Failed",
        description: error.message || `Failed to generate ${format} report. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportKey);
        return newSet;
      });
    }
  };

  const handlePreviewReport = async (reportId: string) => {
    try {
      setGeneratingReports(prev => new Set(prev).add(`${reportId}-PDF`));
      const data = await generateMaintenancePDF(reportId, 'preview');
      if (data) {
        setPreviewData(data);
        setPreviewOpen(true);
      }
    } catch (error: any) {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate report preview.",
        variant: "destructive",
      });
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${reportId}-PDF`);
        return newSet;
      });
    }
  };

  const isDateInRange = (dateStr: string | null | undefined, from: Date | null | undefined, to: Date | null | undefined): boolean => {
    if (!from && !to) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (from && d < from) return false;
    if (to) {
      const endOfDay = new Date(to);
      endOfDay.setHours(23, 59, 59, 999);
      if (d > endOfDay) return false;
    }
    return true;
  };

  const filteredWorkOrders = useMemo(() => {
    let result = workOrders;
    if (globalVessels.length > 0 && globalVessels.length < vessels.length) {
      result = result.filter((wo: any) => globalVessels.includes(wo.vesselId));
    }
    if (globalComponent) {
      const q = globalComponent.toLowerCase();
      result = result.filter((wo: any) => {
        const compName = (wo.componentName || wo.component || "").toLowerCase();
        const compCode = (wo.componentCode || "").toLowerCase();
        return compName.includes(q) || compCode.includes(q);
      });
    }
    return result;
  }, [workOrders, globalVessels, globalComponent, vessels.length]);

  const dateFrom = categoryFilters.dateRange?.from;
  const dateTo = categoryFilters.dateRange?.to;
  const isDateRangeSet = !!(dateFrom || dateTo);

  const isDateRangeActive = !!(categoryFilters.dateRange?.from || categoryFilters.dateRange?.to);

  const highPriorityCount = reports.filter(r => r.priority === 'high').length;
  const dailyReportsCount = reports.filter(r => r.frequency.toLowerCase().includes('daily')).length;

  return (
    <div className={embedded ? "p-4" : "p-6 bg-white min-h-screen"}>
      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              onClick={onBack}
              className="flex items-center gap-2"
              data-testid="button-back-to-reports"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Reports
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Maintenance & Work Orders</h1>
              <p className="text-sm text-gray-500">10 reports for maintenance tracking</p>
            </div>
          </div>

          <CategoryFilters
            filters={categoryFilters}
            onFiltersChange={setCategoryFilters}
            searchPlaceholder="Search maintenance reports..."
          />

          {(categoryFilters.dateRange?.from || categoryFilters.dateRange?.to) && (
            <div className="flex items-center gap-2 px-3 py-2 mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>
                Date range active: {categoryFilters.dateRange.from ? format(categoryFilters.dateRange.from, "MMM dd, yyyy") : "Start"}
                {" - "}
                {categoryFilters.dateRange.to ? format(categoryFilters.dateRange.to, "MMM dd, yyyy") : "End"}
                {" — applied when generating reports"}
              </span>
            </div>
          )}

        </div>
      )}

      {!embedded && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-l-4 border-l-blue-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Total Reports
                </CardDescription>
                <CardTitle className="text-3xl" data-testid="text-maintenance-total-reports">10</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-red-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  High Priority
                </CardDescription>
                <CardTitle className="text-3xl text-red-600" data-testid="text-maintenance-high-priority">{highPriorityCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-green-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-green-500" />
                  Daily Reports
                </CardDescription>
                <CardTitle className="text-3xl text-green-600" data-testid="text-maintenance-daily-reports">{dailyReportsCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-purple-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  {isDateRangeActive ? "Work Orders (Filtered)" : "Work Orders"}
                </CardDescription>
                <CardTitle className="text-3xl text-purple-600" data-testid="text-maintenance-work-orders">{filteredWorkOrders.length}</CardTitle>
                {isDateRangeActive && (
                  <p className="text-xs text-blue-600 mt-1">Filtered by date range</p>
                )}
              </CardHeader>
            </Card>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Report Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Frequency</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Priority</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Est. Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <tr 
                    key={report.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    data-testid={`maintenance-report-row-${report.id}`}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900">{report.name}</div>
                        <div className="text-sm text-gray-500">{report.description}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{report.frequency}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getPriorityColor(report.priority)}>
                        {report.priority.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-gray-500">{report.estimatedTime}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          title="Preview"
                          onClick={() => handlePreviewReport(report.id)}
                          disabled={generatingReports.has(`${report.id}-PDF`)}
                          data-testid={`button-preview-${report.id}`}
                        >
                          {generatingReports.has(`${report.id}-PDF`) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {report.outputs.includes('PDF') && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            title="Download PDF"
                            onClick={() => handleGenerateReport(report.id, 'PDF')}
                            disabled={generatingReports.has(`${report.id}-PDF`)}
                            data-testid={`button-pdf-${report.id}`}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {report.outputs.includes('Excel') && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            title="Download Excel"
                            onClick={() => handleGenerateReport(report.id, 'Excel')}
                            disabled={generatingReports.has(`${report.id}-Excel`)}
                            data-testid={`button-excel-${report.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReports.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
              <p className="text-gray-500">Try adjusting your search criteria or filters</p>
            </div>
          )}
        </>
      )}
      {embedded && isFilterRefreshing && !previewData && (
        <div className="flex items-center justify-center py-12" data-testid="filter-refresh-loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Refreshing report data...</span>
        </div>
      )}
      {embedded && previewData && monthlySummaryData && selectedReportId === 'monthly-summary' && (
        <MonthlySummaryPreview
          data={monthlySummaryData.data}
          vesselId={monthlySummaryData.vesselId}
          year={monthlySummaryData.year}
          month={monthlySummaryData.month}
          onRegenerate={async () => {
            const res = await fetch('/technical/api/reports/maintenance/monthly-summary/regenerate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ vesselId: monthlySummaryData.vesselId, year: monthlySummaryData.year, month: monthlySummaryData.month }),
            });
            if (!res.ok) throw new Error('Failed to regenerate');
            const newData: MonthlySummaryData = await res.json();
            setMonthlySummaryData({ ...monthlySummaryData, data: newData });
          }}
        />
      )}
      {embedded && previewData && (!monthlySummaryData || selectedReportId !== 'monthly-summary') && (
        <InlineReportPreview reportData={previewData} embedded={embedded} />
      )}
      {!embedded && (
        <ReportPreviewModal
          open={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewData(null); }}
          reportData={previewData}
        />
      )}
    </div>
  );
};

export default MaintenanceReports;
