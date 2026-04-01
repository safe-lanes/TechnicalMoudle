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
      }).catch(() => {});
    }
  }, [embedded, selectedReportId]);

  useEffect(() => {
    if (!embedded || !selectedReportId || !initialLoadRef.current) return;
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    setIsFilterRefreshing(true);
    const version = ++previewVersionRef.current;
    filterTimerRef.current = setTimeout(() => {
      setPreviewData(null);
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
      fields: ["WO No/Title", "Component", "Dept", "Priority", "Due Date/Hour", "Required Spares/Tools/Permits", "Risk Notes"],
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
      fields: ["Priority", "On-time %", "Avg Days Late", "Trend"],
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

  const generateMaintenancePDF = async (reportId: string, mode: 'download' | 'preview' = 'download'): Promise<ReportPreviewData | void> => {
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const vesselWorkOrders = filteredWorkOrders;

    switch (reportId) {
      case 'due-jobs-7': {
        // CRITICAL: Include OVERDUE jobs (dueDate < now) AND jobs due within 7 days
        // Previous bug: `dueDate >= now` was excluding all overdue jobs!
        const dueJobs = vesselWorkOrders.filter((wo: any) => {
          if (!wo.dueDate) return false;
          if (wo.status === 'Completed' || wo.status === 'Postponed') return false;
          const dueDate = new Date(wo.dueDate);
          // Include: overdue (dueDate < now) OR due within 7 days (dueDate <= sevenDaysFromNow)
          return dueDate <= sevenDaysFromNow;
        });

        // Calculate status indicator for each job
        const calculateStatus = (dueDate: Date): string => {
          const days = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (days < 0) return 'OVERDUE';
          if (days <= 2) return 'URGENT';
          if (days <= 7) return 'DUE';
          return 'ACTIVE';
        };

        const calculateDaysRemaining = (dueDate: Date): number => {
          return Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        };

        // Enhanced columns to match Excel report
        const columns = [
          { header: 'Priority', field: 'priority', width: 22 },
          { header: 'Status', field: 'statusIndicator', width: 22 },
          { header: 'WO Number', field: 'workOrderNumber', width: 45 },
          { header: 'Title', field: 'title', width: 70 },
          { header: 'Component', field: 'component', width: 50 },
          { header: 'Due Date', field: 'formattedDueDate', width: 26 },
          { header: 'Days Left', field: 'daysRemaining', width: 20 },
          { header: 'Assigned To', field: 'assignedTo', width: 35 }
        ];

        // Sort by days remaining (most urgent first)
        const sortedJobs = [...dueJobs].sort((a: any, b: any) => {
          const daysA = calculateDaysRemaining(new Date(a.dueDate));
          const daysB = calculateDaysRemaining(new Date(b.dueDate));
          return daysA - daysB;
        });

        const data = sortedJobs.map((wo: any) => {
          const dueDate = new Date(wo.dueDate);
          const days = calculateDaysRemaining(dueDate);
          return {
            workOrderNumber: wo.workOrderNumber || wo.workOrderNo || wo.id,
            title: wo.title || wo.jobTitle || '-',
            component: wo.component || wo.componentName || '-',
            priority: wo.jobPriority || 'Normal',
            formattedDueDate: formatDate(wo.dueDate),
            statusIndicator: calculateStatus(dueDate),
            daysRemaining: days,
            assignedTo: wo.assignedTo || wo.assignee || wo.responsibleRank || '-'
          };
        });

        // Calculate summary counts
        const overdueCount = data.filter((d: any) => d.statusIndicator === 'OVERDUE').length;
        const urgentCount = data.filter((d: any) => d.statusIndicator === 'URGENT').length;
        const criticalPriorityCount = data.filter((d: any) => d.priority === 'Critical').length;

        const summary = [
          { label: 'Total Due', value: data.length },
          { label: 'Overdue', value: overdueCount },
          { label: 'Urgent (≤2d)', value: urgentCount },
          { label: 'Critical Priority', value: criticalPriorityCount }
        ];

        if (mode === 'preview') return { title: 'Due Jobs (7 Days)', subtitle: 'Work orders due in the next 7 days (including overdue)', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { title: 'Due Jobs (7 Days)', subtitle: 'Work orders due in the next 7 days (including overdue)', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
          columns,
          data
        );
        break;
      }

      case 'overdue-jobs': {
        // Grace period: 7 days for calendar, 168 hours for RH
        const GRACE_PERIOD_DAYS = 7;
        const GRACE_PERIOD_RH = 168;
        const gracePeriodDate = new Date(now);
        gracePeriodDate.setDate(gracePeriodDate.getDate() - GRACE_PERIOD_DAYS);
        
        // Filter: Past grace period (dueDate < today - 7 days) or RH overdue > 168
        const overdueJobs = vesselWorkOrders.filter((wo: any) => {
          if (wo.status === 'Completed' || wo.status === 'Postponed') return false;
          
          // Calendar-based overdue (past grace period)
          if (wo.dueDate) {
            const dueDate = new Date(wo.dueDate);
            if (dueDate < gracePeriodDate) return true;
          }
          
          // RH-based overdue (past grace period of 168 RH)
          if (wo.nextDueReading && wo.currentCumulativeRH) {
            const rhOverdue = wo.currentCumulativeRH - wo.nextDueReading;
            if (rhOverdue > GRACE_PERIOD_RH) return true;
          }
          
          return false;
        });

        // Calculate overdue type
        const getOverdueType = (daysPastDue: number, hoursPastDue: number): string => {
          const calendarOverdue = daysPastDue > GRACE_PERIOD_DAYS;
          const rhOverdue = hoursPastDue > GRACE_PERIOD_RH;
          if (calendarOverdue && rhOverdue) return 'Both';
          if (rhOverdue) return 'RH';
          return 'Calendar';
        };

        // 15 columns - REMOVED Severity and Priority (not real database fields)
        const columns = [
          { header: 'S.No', field: 'sNo', width: 8 },
          { header: 'Work Order No', field: 'workOrderNumber', width: 30 },
          { header: 'Job Title', field: 'jobTitle', width: 40 },
          { header: 'Comp Code', field: 'componentCode', width: 18 },
          { header: 'Component Name', field: 'componentName', width: 32 },
          { header: 'Dept', field: 'department', width: 14 },
          { header: 'Due Date', field: 'formattedDueDate', width: 18 },
          { header: 'Days Overdue', field: 'daysOverdue', width: 16 },
          { header: 'Next Due RH', field: 'nextDueRH', width: 16 },
          { header: 'Current RH', field: 'currentRH', width: 16 },
          { header: 'RH Overdue', field: 'rhOverdue', width: 14 },
          { header: 'Type', field: 'overdueType', width: 14 },
          { header: 'Assigned To', field: 'assignedTo', width: 20 },
          { header: 'Last Done', field: 'lastDoneDate', width: 18 },
          { header: 'Critical', field: 'criticalEquip', width: 12 }
        ];

        const data = overdueJobs.map((wo: any, index: number) => {
          const dueDate = wo.dueDate ? new Date(wo.dueDate) : null;
          const daysPastDue = dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
          const hoursPastDue = (wo.nextDueReading && wo.currentCumulativeRH) 
            ? Math.max(0, wo.currentCumulativeRH - wo.nextDueReading) 
            : 0;
          const isCriticalEquip = wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true;

          return {
            sNo: index + 1,
            workOrderNumber: wo.workOrderNumber || wo.workOrderNo || wo.id,
            jobTitle: wo.title || wo.jobTitle || '-',
            componentCode: wo.componentCode || wo.componentNumber || '-',
            componentName: wo.component || wo.componentName || '-',
            department: wo.department || wo.assignedDepartment || '-',
            formattedDueDate: formatDate(wo.dueDate || wo.dueDateSnapshot),
            daysOverdue: daysPastDue > 0 ? daysPastDue : '-',
            daysPastDue: daysPastDue,
            nextDueRH: wo.nextDueReading ? wo.nextDueReading.toLocaleString() : '-',
            currentRH: wo.currentCumulativeRH ? wo.currentCumulativeRH.toLocaleString() : '-',
            rhOverdue: hoursPastDue > 0 ? hoursPastDue : '-',
            overdueType: getOverdueType(daysPastDue, hoursPastDue),
            assignedTo: wo.assignedTo || wo.assignee || wo.responsibleRank || '-',
            lastDoneDate: formatDate(wo.lastDoneDate || wo.lastDoneDateSnapshot) || 'N/A',
            criticalEquip: isCriticalEquip ? 'YES' : 'NO',
            critical: isCriticalEquip ? 'YES' : 'NO'
          };
        });

        // Sort by Critical Equipment first, then by days overdue (descending), then component name
        data.sort((a, b) => {
          if (a.criticalEquip !== b.criticalEquip) {
            return a.criticalEquip === 'YES' ? -1 : 1;
          }
          const daysA = typeof a.daysOverdue === 'number' ? a.daysOverdue : 0;
          const daysB = typeof b.daysOverdue === 'number' ? b.daysOverdue : 0;
          if (daysA !== daysB) return daysB - daysA;
          return (a.componentName || '').localeCompare(b.componentName || '');
        });

        // Re-number after sorting
        data.forEach((item, idx) => { item.sNo = idx + 1; });

        // Calculate summary statistics - ONLY real database-backed metrics
        const criticalEquipCount = data.filter(d => d.criticalEquip === 'YES').length;
        const daysOverdueArr = data.filter(d => typeof d.daysOverdue === 'number').map(d => d.daysOverdue as number);
        const avgDaysOverdue = daysOverdueArr.length > 0 
          ? Math.round(daysOverdueArr.reduce((a, b) => a + b, 0) / daysOverdueArr.length) 
          : 0;
        const maxDaysOverdue = daysOverdueArr.length > 0 ? Math.max(...daysOverdueArr) : 0;
        const calendarOverdueCount = data.filter(d => d.overdueType === 'Calendar' || d.overdueType === 'Both').length;
        const rhOverdueCount = data.filter(d => d.overdueType === 'RH' || d.overdueType === 'Both').length;

        // REMOVED fake severity counts - only show real database metrics
        const summary = [
          { label: 'Total Overdue', value: data.length },
          { label: 'Critical Equip', value: criticalEquipCount, color: 'highlight' },
          { label: 'Avg Days Overdue', value: avgDaysOverdue },
          { label: 'Max Days Overdue', value: `${maxDaysOverdue}d` },
          { label: 'Calendar/RH', value: `${calendarOverdueCount}/${rhOverdueCount}` }
        ];

        if (mode === 'preview') return { title: 'OVERDUE JOBS REPORT', subtitle: 'Work orders past grace period (7 days calendar / 168 RH overdue)', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary } as ReportPreviewData;

        // Use specialized overdue report generator
        pdfReportGenerator.generateOverdueJobsReport(
          { 
            title: 'OVERDUE JOBS REPORT', 
            subtitle: 'Work orders past grace period (7 days calendar / 168 RH overdue)', 
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          data
        );
        break;
      }

      case 'completed-jobs': {
        // Helper to format date as DD-MMM-YYYY
        const formatDateDDMMMYYYY = (dateStr: string | null | undefined): string => {
          if (!dateStr) return '—';
          try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '—';
            const day = d.getDate().toString().padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[d.getMonth()];
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
          } catch {
            return '—';
          }
        };

        // Helper to format time as HH:MM
        const formatTimeHHMM = (dateStr: string | null | undefined): string => {
          if (!dateStr) return '—';
          try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '—';
            const hours = d.getHours().toString().padStart(2, '0');
            const minutes = d.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
          } catch {
            return '—';
          }
        };

        // Helper to calculate duration in hours
        const calculateDuration = (startStr: string | null | undefined, endStr: string | null | undefined): number => {
          if (!startStr || !endStr) return 0;
          try {
            const start = new Date(startStr);
            const end = new Date(endStr);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
            return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
          } catch {
            return 0;
          }
        };

        // Get date range from filters
        const dateFrom = categoryFilters.dateRange?.from;
        const dateTo = categoryFilters.dateRange?.to;

        // Filter completed jobs by date_completed field
        let completedJobs = vesselWorkOrders.filter((wo: any) => wo.status === 'Completed');
        
        if (dateFrom || dateTo) {
          completedJobs = completedJobs.filter((wo: any) => {
            const completedDate = wo.dateCompleted || wo.completionDateTime;
            if (!completedDate) return true;
            const date = new Date(completedDate);
            if (isNaN(date.getTime())) return true;
            if (dateFrom && date < dateFrom) return false;
            if (dateTo) {
              const endOfDay = new Date(dateTo);
              endOfDay.setHours(23, 59, 59, 999);
              if (date > endOfDay) return false;
            }
            return true;
          });
        }

        // Sort by date_completed DESC, then work_order_no ASC
        completedJobs.sort((a: any, b: any) => {
          const dateA = new Date(a.dateCompleted || a.completionDateTime || 0).getTime();
          const dateB = new Date(b.dateCompleted || b.completionDateTime || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          const woA = a.workOrderNo || a.id || '';
          const woB = b.workOrderNo || b.id || '';
          return woA.localeCompare(woB);
        });

        // Transform data with all 25 fields
        let totalManHours = 0;
        const data = completedJobs.map((wo: any, index: number) => {
          const duration = parseFloat(wo.totalTimeHours) || calculateDuration(wo.startDateTime, wo.completionDateTime);
          const persons = parseInt(wo.noOfPersons) || 1;
          const manHours = parseFloat(wo.manhours) || (duration * persons);
          totalManHours += manHours;

          return {
            sNo: index + 1,
            workOrderNo: wo.workOrderNo || wo.id || '—',
            componentName: wo.component || wo.componentName || '—',
            componentCode: wo.componentCode || '—',
            jobTitle: wo.jobTitle || wo.title || '—',
            jobType: wo.taskType || wo.maintenanceType || '—',
            maintenanceBasis: wo.maintenanceBasis || '—',
            department: wo.department || '—',
            priority: wo.jobPriority || wo.priority || '—',
            criticality: wo.criticality || 'No',
            classRelated: wo.classRelated || 'No',
            assignedTo: wo.performedBy || wo.assignedTo || '—',
            approver: wo.approver || '—',
            submittedDate: formatDateDDMMMYYYY(wo.submittedDate || wo.createdAt),
            startDate: formatDateDDMMMYYYY(wo.startDateTime),
            startTime: formatTimeHHMM(wo.startDateTime),
            completionDate: formatDateDDMMMYYYY(wo.dateCompleted || wo.completionDateTime),
            completionTime: formatTimeHHMM(wo.completionDateTime),
            workDuration: duration > 0 ? duration.toFixed(1) : '—',
            noOfPersons: wo.noOfPersons || '1',
            manHours: manHours > 0 ? manHours.toFixed(1) : '—',
            riskAssessment: wo.riskAssessmentStatus || 'N/A',
            safetyChecklists: wo.safetyChecklistsStatus || 'N/A',
            operationalForms: wo.operationalFormsStatus || 'N/A'
          };
        });

        const completedColumns = [
          { header: 'S.No', field: 'sNo', width: 8 },
          { header: 'WO No', field: 'workOrderNo', width: 22 },
          { header: 'Component', field: 'componentName', width: 28 },
          { header: 'Job Title', field: 'jobTitle', width: 30 },
          { header: 'Job Type', field: 'jobType', width: 14 },
          { header: 'Dept', field: 'department', width: 12 },
          { header: 'Priority', field: 'priority', width: 12 },
          { header: 'Assigned To', field: 'assignedTo', width: 18 },
          { header: 'Start Date', field: 'startDate', width: 16 },
          { header: 'Completion Date', field: 'completionDate', width: 16 },
          { header: 'Man Hours', field: 'manHours', width: 12 }
        ];

        if (mode === 'preview') {
          const completedSummary = [
            { label: 'Total Jobs', value: data.length },
            { label: 'Total Man-Hours', value: totalManHours.toFixed(1) }
          ];
          return { title: 'COMPLETED JOBS REGISTER', subtitle: `Vessel: ${vesselName}`, vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns: completedColumns, data, summary: completedSummary } as ReportPreviewData;
        }

        pdfReportGenerator.generateReport(
          { 
            title: 'COMPLETED JOBS REGISTER', 
            subtitle: `${data.length} completed jobs | ${totalManHours.toFixed(1)} total man-hours`,
            vessel: vesselName,
            orientation: 'landscape',
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          completedColumns,
          data
        );
        break;
      }

      case 'monthly-summary': {
        // Parse DD-MMM-YYYY date format
        const parseDate = (dateStr: string | null | undefined): Date | null => {
          if (!dateStr) return null;
          const ddMmmYyyy = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
          if (ddMmmYyyy) {
            const months: Record<string, number> = {
              'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
              'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };
            const day = parseInt(ddMmmYyyy[1], 10);
            const month = months[ddMmmYyyy[2]];
            const year = parseInt(ddMmmYyyy[3], 10);
            if (month !== undefined) return new Date(year, month, day);
          }
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d;
        };
        
        // Use date range from global filters or default to current month
        let periodStart: Date;
        let periodEnd: Date;
        if (globalFilters?.dateRange?.from && globalFilters?.dateRange?.to) {
          periodStart = globalFilters.dateRange.from;
          periodEnd = new Date(globalFilters.dateRange.to);
        } else {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        periodEnd.setHours(23, 59, 59, 999);
        
        // Monthly WOs = jobs due in period OR completed in period
        const monthlyWOs = vesselWorkOrders.filter((wo: any) => {
          const dueDate = parseDate(wo.dueDate);
          const completionDate = wo.completionDateTime ? new Date(wo.completionDateTime) : null;
          const isDueInMonth = dueDate && dueDate >= periodStart && dueDate <= periodEnd;
          const isCompletedInMonth = wo.status === 'Completed' 
            && completionDate 
            && completionDate >= periodStart 
            && completionDate <= periodEnd;
          return isDueInMonth || isCompletedInMonth;
        });
        
        // Completed jobs from monthlyWOs scope
        const completedWOs = monthlyWOs.filter((wo: any) => wo.status === 'Completed');
        
        // CUMULATIVE overdue: ALL work orders with dueDate < periodEnd AND status != Completed
        const cumulativeOverdue = vesselWorkOrders.filter((wo: any) => {
          if (!wo.dueDate || wo.status === 'Completed') return false;
          const dueDate = parseDate(wo.dueDate);
          return dueDate && dueDate < periodEnd;
        });
        
        const totalInScope = monthlyWOs.length;
        const totalCompleted = completedWOs.length;
        const totalOverdue = cumulativeOverdue.length;
        const completionRate = totalInScope > 0 ? Math.round((totalCompleted / totalInScope) * 100) : 0;
        
        // Department breakdown
        const deptStats: Record<string, { planned: number; completed: number; overdue: number }> = {};
        monthlyWOs.forEach((wo: any) => {
          const dept = wo.department || wo.assignedDepartment || 'Unassigned';
          if (!deptStats[dept]) deptStats[dept] = { planned: 0, completed: 0, overdue: 0 };
          deptStats[dept].planned++;
          if (wo.status === 'Completed') deptStats[dept].completed++;
        });
        cumulativeOverdue.forEach((wo: any) => {
          const dept = wo.department || wo.assignedDepartment || 'Unassigned';
          if (!deptStats[dept]) deptStats[dept] = { planned: 0, completed: 0, overdue: 0 };
          deptStats[dept].overdue++;
        });
        
        // Priority breakdown (using jobPriority field from database)
        const priorityStats: Record<string, { total: number; completed: number; overdue: number }> = {
          'High': { total: 0, completed: 0, overdue: 0 },
          'Medium': { total: 0, completed: 0, overdue: 0 },
          'Low': { total: 0, completed: 0, overdue: 0 },
          'Normal': { total: 0, completed: 0, overdue: 0 }
        };
        monthlyWOs.forEach((wo: any) => {
          const priority = wo.jobPriority || 'Normal';
          if (!priorityStats[priority]) priorityStats[priority] = { total: 0, completed: 0, overdue: 0 };
          priorityStats[priority].total++;
          if (wo.status === 'Completed') priorityStats[priority].completed++;
        });
        cumulativeOverdue.forEach((wo: any) => {
          const priority = wo.jobPriority || 'Normal';
          if (!priorityStats[priority]) priorityStats[priority] = { total: 0, completed: 0, overdue: 0 };
          priorityStats[priority].overdue++;
        });
        
        // Man-hours calculation
        let totalManHours = 0;
        completedWOs.forEach((wo: any) => {
          totalManHours += Number(wo.manhours || wo.totalTimeHours || wo.actualHours || 0);
        });
        
        const periodLabel = periodStart.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const columns = [
          { header: 'Metric', field: 'metric', width: 60 },
          { header: 'Value', field: 'value', width: 40 },
          { header: 'Percentage', field: 'percentage', width: 40 }
        ];

        // Build comprehensive data sections
        const data = [
          { metric: '--- EXECUTIVE SUMMARY ---', value: '', percentage: '' },
          { metric: 'Jobs In Scope (Due/Completed in Period)', value: totalInScope, percentage: '100%' },
          { metric: 'Completed', value: totalCompleted, percentage: totalInScope > 0 ? `${completionRate}%` : '0%' },
          { metric: 'Active (In Progress)', value: totalInScope - totalCompleted, percentage: totalInScope > 0 ? `${Math.round((totalInScope - totalCompleted) / totalInScope * 100)}%` : '0%' },
          { metric: 'Cumulative Overdue', value: totalOverdue, percentage: '-' },
          { metric: 'Total Man-Hours', value: totalManHours.toFixed(1), percentage: '-' },
          { metric: '', value: '', percentage: '' },
          { metric: '--- PRIORITY BREAKDOWN ---', value: '', percentage: '' },
          ...Object.entries(priorityStats).filter(([_, s]) => s.total > 0 || s.overdue > 0).map(([priority, stats]) => ({
            metric: `${priority} Priority`, 
            value: `${stats.total} jobs (${stats.completed} done, ${stats.overdue} overdue)`, 
            percentage: stats.total > 0 ? `${Math.round(stats.completed / stats.total * 100)}%` : '-'
          })),
          { metric: '', value: '', percentage: '' },
          { metric: '--- DEPARTMENT BREAKDOWN ---', value: '', percentage: '' },
          ...Object.entries(deptStats).filter(([_, s]) => s.planned > 0 || s.overdue > 0).map(([dept, stats]) => ({
            metric: dept, 
            value: `${stats.planned} jobs (${stats.completed} done, ${stats.overdue} overdue)`, 
            percentage: stats.planned > 0 ? `${Math.round(stats.completed / stats.planned * 100)}%` : '-'
          }))
        ];

        const summary = [
          { label: 'Completion Rate', value: totalInScope > 0 ? `${completionRate}%` : 'N/A' },
          { label: 'Jobs In Scope', value: totalInScope },
          { label: 'Cumulative Overdue', value: totalOverdue }
        ];

        if (mode === 'preview') return { title: 'Monthly Maintenance Summary', subtitle: `Performance metrics for ${periodLabel}`, vessel: vesselName, dateRange: periodLabel, columns, data, summary } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { title: 'Monthly Maintenance Summary', subtitle: `Performance metrics for ${periodLabel}`, vessel: vesselName, dateRange: periodLabel },
          columns,
          data
        );
        break;
      }

      case 'critical-equipment': {
        // Fetch data from the new API endpoint
        const response = await fetch(
          `/technical/api/reports/critical-equipment-status?vesselId=${effectiveVesselId}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch critical equipment data');
        }
        const { data: criticalData, metadata } = await response.json();

        // Define columns matching specification (12 columns)
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

        // Build summary matching specification
        const summary = [
          { label: 'Total Critical Equipment', value: metadata.totalCriticalEquipment },
          { label: 'Critical Only', value: metadata.criticalOnly },
          { label: 'Class Item Only', value: metadata.classItemOnly },
          { label: 'Both Critical & Class', value: metadata.bothCriticalAndClass },
          { label: 'With Overdue Jobs', value: metadata.equipmentWithOverdue, color: 'highlight' },
          { label: 'Due Soon (7 days)', value: metadata.equipmentDueSoon }
        ];

        if (mode === 'preview') return { title: 'CRITICAL EQUIPMENT STATUS REPORT', subtitle: 'SOLAS-critical and class-critical equipment', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary } as ReportPreviewData;

        // Use specialized critical equipment report generator
        pdfReportGenerator.generateCriticalEquipmentReport(
          { 
            title: 'CRITICAL EQUIPMENT STATUS REPORT', 
            subtitle: 'SOLAS-critical and class-critical equipment', 
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          data,
          metadata
        );
        break;
      }

      case 'unplanned-jobs': {
        // Use date range from global filters or default to current month
        const dateFrom = globalFilters?.dateRange?.from || new Date(now.getFullYear(), now.getMonth(), 1);
        const dateTo = globalFilters?.dateRange?.to || new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const startDate = dateFrom.toISOString().split('T')[0];
        const endDate = dateTo.toISOString().split('T')[0];

        // Fetch data from the API endpoint
        const response = await fetch(
          `/technical/api/reports/unplanned-breakdown-jobs?vesselId=${effectiveVesselId}&startDate=${startDate}&endDate=${endDate}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch unplanned/breakdown jobs data');
        }
        const { data: unplannedData, metadata } = await response.json();

        // Define columns matching specification (11 columns)
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
        const summary = [
          { label: 'Total Unplanned Jobs', value: metadata.totalUnplannedJobs },
          { label: 'Total Manhours', value: metadata.totalManhours },
          { label: 'Avg Time Taken (hrs)', value: metadata.avgTimeTaken },
          { label: 'Date Range', value: `${startDate} to ${endDate}` }
        ];

        if (mode === 'preview') return { title: 'UNPLANNED/BREAKDOWN JOBS REPORT', subtitle: 'Analysis of breakdown maintenance and unplanned work', vessel: vesselName, dateRange: formatReportDateRange(globalFilters?.dateRange?.from, globalFilters?.dateRange?.to), columns, data: unplannedData, summary } as ReportPreviewData;

        // Use specialized unplanned breakdown report generator (same styling as Report 1.5)
        pdfReportGenerator.generateUnplannedBreakdownReport(
          { 
            title: 'UNPLANNED/BREAKDOWN JOBS REPORT', 
            subtitle: 'Analysis of breakdown maintenance and unplanned work', 
            vessel: vesselName,
            dateRange: formatReportDateRange(globalFilters?.dateRange?.from, globalFilters?.dateRange?.to)
          },
          columns,
          unplannedData,
          metadata
        );
        break;
      }

      case 'postponement-log': {
        const postponedWOs = vesselWorkOrders.filter((wo: any) => wo.status === 'Postponed');

        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'WO Number', field: 'workOrderNumber', width: 35 },
          { header: 'Job Title', field: 'title', width: 55 },
          { header: 'Component', field: 'componentName', width: 45 },
          { header: 'Dept', field: 'department', width: 20 },
          { header: 'Original Due', field: 'originalDue', width: 25 },
          { header: 'New Due', field: 'newDue', width: 25 },
          { header: 'Days Extended', field: 'daysExtended', width: 22 },
          { header: 'Reason', field: 'reason', width: 50 },
          { header: 'Status', field: 'status', width: 22 }
        ];

        const data = postponedWOs.map((wo: any, idx: number) => {
          let daysExtended = '-';
          const origDateStr = wo.originalDueDate || wo.dueDate;
          const newDateStr = wo.newDueDate || wo.postponedToDate;
          if (origDateStr && newDateStr) {
            const origDate = new Date(origDateStr);
            const newDate = new Date(newDateStr);
            if (!isNaN(origDate.getTime()) && !isNaN(newDate.getTime())) {
              const days = Math.ceil((newDate.getTime() - origDate.getTime()) / (1000 * 60 * 60 * 24));
              daysExtended = days > 0 ? String(days) : '-';
            }
          }
          
          return {
            sno: idx + 1,
            workOrderNumber: wo.workOrderNo || wo.workOrderNumber || wo.id,
            title: wo.title || wo.jobTitle || '-',
            componentName: wo.component || wo.componentName || '-',
            department: wo.department || wo.assignedDepartment || '-',
            originalDue: formatDate(wo.originalDueDate || wo.dueDate),
            newDue: formatDate(wo.newDueDate || wo.postponedToDate || wo.dueDate),
            daysExtended: daysExtended,
            reason: wo.postponementReason || wo.remarks || '-',
            status: 'Postponed'
          };
        });

        const summary = [
          { label: 'Total Postponed Jobs', value: data.length }
        ];

        if (mode === 'preview') return { title: 'Job Postponement Log Report', subtitle: 'Audit trail of all postponed jobs with approvals and justifications', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { 
            title: 'Job Postponement Log Report', 
            subtitle: 'Audit trail of all postponed jobs with approvals and justifications', 
            vessel: vesselName,
            orientation: 'landscape',
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          data
        );
        break;
      }

      case 'priority-performance': {
        const priorityGroups: Record<string, { total: number; completed: number; overdue: number }> = {};
        
        vesselWorkOrders.forEach((wo: any) => {
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
          { header: 'Priority', field: 'priority', width: 40 },
          { header: 'Total WOs', field: 'total', width: 30 },
          { header: 'Completed', field: 'completed', width: 30 },
          { header: 'On-Time %', field: 'onTimePercent', width: 30 },
          { header: 'Overdue', field: 'overdue', width: 30 }
        ];

        const data = Object.entries(priorityGroups).map(([priority, stats]) => ({
          priority,
          total: stats.total,
          completed: stats.completed,
          onTimePercent: stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : '0%',
          overdue: stats.overdue
        }));

        if (mode === 'preview') return { title: 'Work Priority Performance', subtitle: 'Performance analysis by priority levels', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { title: 'Work Priority Performance', subtitle: 'Performance analysis by priority levels', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
          columns,
          data
        );
        break;
      }

      case 'manhours-analysis': {
        const columns = [
          { header: 'WO Number', field: 'workOrderNumber', width: 40 },
          { header: 'Title', field: 'title', width: 60 },
          { header: 'Planned Hrs', field: 'plannedHours', width: 30 },
          { header: 'Actual Hrs', field: 'actualHours', width: 30 },
          { header: 'Variance', field: 'variance', width: 30 }
        ];

        const data = vesselWorkOrders
          .filter((wo: any) => wo.status === 'Completed')
          .map((wo: any) => {
            const planned = wo.plannedHours || wo.estimatedHours || 0;
            const actual = wo.actualHours || wo.hoursSpent || planned;
            return {
              workOrderNumber: wo.workOrderNumber || wo.id,
              title: wo.title || wo.jobTitle || '-',
              plannedHours: planned,
              actualHours: actual,
              variance: actual - planned
            };
          });

        if (mode === 'preview') return { title: 'Man-Hours Analysis', subtitle: 'Planned vs Actual hours comparison', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { title: 'Man-Hours Analysis', subtitle: 'Planned vs Actual hours comparison', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
          columns,
          data
        );
        break;
      }

      case 'workload-distribution': {
        // Enhanced workload distribution with more metrics
        const rankStats: Record<string, { 
          count: number; 
          completed: number; 
          pending: number;
          overdue: number;
          critical: number;
          highPriority: number;
          manhours: number;
          timeTaken: number;
          jobsWithTime: number;
          department: string;
        }> = {};
        
        vesselWorkOrders.forEach((wo: any) => {
          const assignee = wo.assignedTo || wo.assignee || wo.performedBy || wo.responsibleRank || 'Unassigned';
          const dept = wo.department || 'N/A';
          
          if (!rankStats[assignee]) {
            rankStats[assignee] = { 
              count: 0, 
              completed: 0, 
              pending: 0,
              overdue: 0,
              critical: 0,
              highPriority: 0,
              manhours: 0,
              timeTaken: 0,
              jobsWithTime: 0,
              department: dept
            };
          }
          
          const stats = rankStats[assignee];
          stats.count++;
          
          if (wo.status === 'Completed') {
            stats.completed++;
          } else if (wo.status === 'Overdue' || (wo.dueDate && new Date(wo.dueDate) < now && wo.status !== 'Completed')) {
            stats.overdue++;
          } else {
            stats.pending++;
          }
          
          if (wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true) {
            stats.critical++;
          }
          
          if (wo.jobPriority === 'High') {
            stats.highPriority++;
          }
          
          if (wo.manhours) {
            stats.manhours += Number(wo.manhours) || 0;
          }
          
          if (wo.totalTimeHours) {
            stats.timeTaken += Number(wo.totalTimeHours) || 0;
            stats.jobsWithTime++;
          }
        });

        // Calculate total manhours for workload percentage
        const totalManhours = Object.values(rankStats).reduce((sum, s) => sum + s.manhours, 0);

        const columns = [
          { header: 'Rank', field: 'rank', width: 45 },
          { header: 'Dept', field: 'department', width: 25 },
          { header: 'Total', field: 'total', width: 22 },
          { header: 'Done', field: 'completed', width: 22 },
          { header: 'Pending', field: 'pending', width: 22 },
          { header: 'Overdue', field: 'overdue', width: 22 },
          { header: 'Manhours', field: 'manhours', width: 28 },
          { header: 'Avg Time', field: 'avgTime', width: 25 },
          { header: 'Rate %', field: 'completionPercent', width: 25 },
          { header: 'Load %', field: 'workloadPercent', width: 25 }
        ];

        const data = Object.entries(rankStats)
          .map(([rank, stats]) => ({
            rank,
            department: stats.department,
            total: stats.count,
            completed: stats.completed,
            pending: stats.pending,
            overdue: stats.overdue,
            manhours: stats.manhours.toFixed(1),
            avgTime: stats.jobsWithTime > 0 ? (stats.timeTaken / stats.jobsWithTime).toFixed(1) : '-',
            completionPercent: stats.count > 0 ? `${Math.round((stats.completed / stats.count) * 100)}%` : '0%',
            workloadPercent: totalManhours > 0 ? `${Math.round((stats.manhours / totalManhours) * 100)}%` : '0%'
          }))
          .sort((a, b) => parseFloat(b.manhours) - parseFloat(a.manhours)); // Sort by manhours desc

        // Calculate summary stats
        const totalJobs = Object.values(rankStats).reduce((sum, s) => sum + s.count, 0);
        const totalCompleted = Object.values(rankStats).reduce((sum, s) => sum + s.completed, 0);
        const totalOverdue = Object.values(rankStats).reduce((sum, s) => sum + s.overdue, 0);
        
        const summary = [
          { label: 'Total Crew Members', value: Object.keys(rankStats).length },
          { label: 'Total Jobs', value: totalJobs },
          { label: 'Total Completed', value: totalCompleted },
          { label: 'Total Overdue', value: totalOverdue },
          { label: 'Total Manhours', value: totalManhours.toFixed(1) }
        ];

        if (mode === 'preview') return { title: 'Crew Workload Distribution', subtitle: 'Task distribution across crew ranks and assignments', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to), columns, data, summary } as ReportPreviewData;

        pdfReportGenerator.generateReport(
          { title: 'Crew Workload Distribution', subtitle: 'Task distribution across crew ranks and assignments', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
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
    
    // Add date range for reports that support it
    if (reportId === 'monthly-summary' || reportId === 'completed-jobs' || reportId === 'unplanned-jobs' || reportId === 'workload-distribution') {
      // Use category filters date range for completed-jobs, unplanned-jobs, and workload-distribution
      const dateFrom = categoryFilters.dateRange?.from;
      const dateTo = categoryFilters.dateRange?.to;
      
      if (dateFrom) {
        requestBody.dateFrom = dateFrom.toISOString().split('T')[0];
      }
      if (dateTo) {
        requestBody.dateTo = dateTo.toISOString().split('T')[0];
      }
      
      // Also support startDate/endDate for monthly-summary, unplanned-jobs, workload-distribution, equipment-utilization, and rh-anomaly-detection
      if (reportId === 'monthly-summary' || reportId === 'unplanned-jobs' || reportId === 'workload-distribution') {
        let startDate: Date;
        let endDate: Date;
        
        if (globalFilters?.dateRange?.from && globalFilters?.dateRange?.to) {
          startDate = globalFilters.dateRange.from;
          endDate = globalFilters.dateRange.to;
        } else if (categoryFilters.dateRange?.from && categoryFilters.dateRange?.to) {
          startDate = categoryFilters.dateRange.from;
          endDate = categoryFilters.dateRange.to;
        } else {
          const now = new Date();
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        requestBody.startDate = startDate.toISOString().split('T')[0];
        requestBody.endDate = endDate.toISOString().split('T')[0];
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
    if (categoryFilters.dateRange?.from || categoryFilters.dateRange?.to) {
      result = result.filter((wo: any) => {
        if (!wo.dueDate) return false;
        const dueDate = new Date(wo.dueDate);
        if (categoryFilters.dateRange.from && dueDate < categoryFilters.dateRange.from) return false;
        if (categoryFilters.dateRange.to) {
          const endOfDay = new Date(categoryFilters.dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (dueDate > endOfDay) return false;
        }
        return true;
      });
    }
    return result;
  }, [workOrders, categoryFilters.dateRange, globalVessels, globalComponent, vessels.length]);

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
      {embedded && previewData && (
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
