import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  TrendingUp,
  Users,
  Settings,
  Eye,
  Loader2
} from "lucide-react";
import { pdfReportGenerator, fetchReportData, formatDate } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import { getJobsListQueryKey } from "@/modules/components/api/jobsApiV2";

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
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
}

const MaintenanceReports: React.FC<MaintenanceReportsProps> = ({ onBack, globalFilters }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId } = useVessel();

  const { data: workOrders = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/work-orders'],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: getJobsListQueryKey(vesselId),
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
      outputs: ["PDF", "Dashboard"],
      icon: TrendingUp,
      priority: "medium",
      lastGenerated: "3 days ago",
      estimatedTime: "3-5 min"
    },
    {
      id: "critical-equipment",
      name: "Critical Equipment Status",
      description: "Status report for SOLAS-critical and class-critical systems",
      purpose: "Regulatory compliance & risk (All stakeholders)",
      frequency: "Weekly",
      fields: ["System/Component", "Total WOs", "Due Now", "Overdue", "Last Done Date", "Next Due", "Risk Level"],
      filters: ["Vessel", "Critical System List", "Status"],
      outputs: ["PDF", "Dashboard"],
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
      estimatedTime: "2-3 min"
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
      estimatedTime: "3-4 min"
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
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFrequency = selectedFrequency === "all" || 
                           report.frequency.toLowerCase().includes(selectedFrequency.toLowerCase());
    
    const matchesPriority = selectedPriority === "all" || report.priority === selectedPriority;
    
    return matchesSearch && matchesFrequency && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const generateMaintenancePDF = async (reportId: string) => {
    const vesselName = vessels.find(v => v.id === vesselId)?.name || vesselId || 'All Vessels';
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const vesselWorkOrders = vesselId && vesselId !== 'all' 
      ? workOrders.filter((wo: any) => wo.vesselId === vesselId)
      : workOrders;

    switch (reportId) {
      case 'due-jobs-7': {
        const dueJobs = vesselWorkOrders.filter((wo: any) => {
          if (!wo.dueDate) return false;
          const dueDate = new Date(wo.dueDate);
          return wo.status !== 'Completed' && dueDate <= sevenDaysFromNow && dueDate >= now;
        });

        const columns = [
          { header: 'WO Number', field: 'workOrderNumber', width: 40 },
          { header: 'Title', field: 'title', width: 60 },
          { header: 'Component', field: 'component', width: 50 },
          { header: 'Priority', field: 'priority', width: 25 },
          { header: 'Due Date', field: 'formattedDueDate', width: 30 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const data = dueJobs.map((wo: any) => ({
          workOrderNumber: wo.workOrderNumber || wo.id,
          title: wo.title || wo.jobTitle || '-',
          component: wo.component || wo.componentName || '-',
          priority: wo.priority || 'Normal',
          formattedDueDate: formatDate(wo.dueDate),
          status: wo.status || 'Open'
        }));

        const summary = [
          { label: 'Total Due', value: data.length },
          { label: 'High Priority', value: data.filter((d: any) => d.priority === 'High' || d.priority === 'Critical').length },
          { label: 'This Week', value: data.length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Due Jobs (7 Days)', subtitle: 'Work orders due in the next 7 days', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'overdue-jobs': {
        const overdueJobs = vesselWorkOrders.filter((wo: any) => {
          if (!wo.dueDate || wo.status === 'Completed') return false;
          return new Date(wo.dueDate) < now;
        });

        const columns = [
          { header: 'WO Number', field: 'workOrderNumber', width: 40 },
          { header: 'Component', field: 'component', width: 50 },
          { header: 'Days Overdue', field: 'daysOverdue', width: 30 },
          { header: 'Priority', field: 'priority', width: 25 },
          { header: 'Original Due', field: 'formattedDueDate', width: 30 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const data = overdueJobs.map((wo: any) => {
          const dueDate = new Date(wo.dueDate);
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            workOrderNumber: wo.workOrderNumber || wo.id,
            component: wo.component || wo.componentName || '-',
            daysOverdue: daysOverdue,
            priority: wo.priority || 'Normal',
            formattedDueDate: formatDate(wo.dueDate),
            status: wo.status || 'Overdue'
          };
        });

        const summary = [
          { label: 'Total Overdue', value: data.length },
          { label: 'Critical', value: data.filter((d: any) => d.priority === 'Critical').length },
          { label: 'Avg Days Late', value: data.length > 0 ? Math.round(data.reduce((a: number, b: any) => a + b.daysOverdue, 0) / data.length) : 0 }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Overdue Jobs Report', subtitle: 'Work orders past their due dates', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'completed-jobs': {
        const completedJobs = vesselWorkOrders.filter((wo: any) => wo.status === 'Completed');

        const columns = [
          { header: 'WO Number', field: 'workOrderNumber', width: 40 },
          { header: 'Title', field: 'title', width: 60 },
          { header: 'Component', field: 'component', width: 50 },
          { header: 'Completed Date', field: 'formattedCompletedDate', width: 30 },
          { header: 'Performed By', field: 'performedBy', width: 40 }
        ];

        const data = completedJobs.map((wo: any) => ({
          workOrderNumber: wo.workOrderNumber || wo.id,
          title: wo.title || wo.jobTitle || '-',
          component: wo.component || wo.componentName || '-',
          formattedCompletedDate: formatDate(wo.completedDate || wo.updatedAt),
          performedBy: wo.performedBy || wo.assignee || '-'
        }));

        const summary = [
          { label: 'Total Completed', value: data.length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Completed Jobs Register', subtitle: 'All completed maintenance work', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'monthly-summary': {
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyWOs = vesselWorkOrders.filter((wo: any) => {
          const woDate = new Date(wo.dueDate || wo.createdAt);
          return woDate >= thisMonth;
        });

        const completed = monthlyWOs.filter((wo: any) => wo.status === 'Completed').length;
        const total = monthlyWOs.length;
        const overdue = monthlyWOs.filter((wo: any) => {
          if (!wo.dueDate || wo.status === 'Completed') return false;
          return new Date(wo.dueDate) < now;
        }).length;

        const columns = [
          { header: 'Metric', field: 'metric', width: 60 },
          { header: 'Value', field: 'value', width: 40 },
          { header: 'Percentage', field: 'percentage', width: 40 }
        ];

        const data = [
          { metric: 'Total Work Orders', value: total, percentage: '100%' },
          { metric: 'Completed', value: completed, percentage: total > 0 ? `${Math.round(completed/total*100)}%` : '0%' },
          { metric: 'In Progress', value: total - completed - overdue, percentage: total > 0 ? `${Math.round((total - completed - overdue)/total*100)}%` : '0%' },
          { metric: 'Overdue', value: overdue, percentage: total > 0 ? `${Math.round(overdue/total*100)}%` : '0%' }
        ];

        const summary = [
          { label: 'Completion Rate', value: total > 0 ? `${Math.round(completed/total*100)}%` : 'N/A' },
          { label: 'Total WOs', value: total },
          { label: 'Overdue', value: overdue }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Monthly Maintenance Summary', subtitle: `Performance metrics for ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`, vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'critical-equipment': {
        const criticalWOs = vesselWorkOrders.filter((wo: any) => 
          wo.priority === 'Critical' || wo.priority === 'High'
        );

        const columns = [
          { header: 'Component', field: 'component', width: 60 },
          { header: 'Priority', field: 'priority', width: 30 },
          { header: 'Status', field: 'status', width: 30 },
          { header: 'Due Date', field: 'formattedDueDate', width: 35 },
          { header: 'WO Number', field: 'workOrderNumber', width: 40 }
        ];

        const data = criticalWOs.map((wo: any) => ({
          component: wo.component || wo.componentName || '-',
          priority: wo.priority || 'High',
          status: wo.status || 'Open',
          formattedDueDate: formatDate(wo.dueDate),
          workOrderNumber: wo.workOrderNumber || wo.id
        }));

        const summary = [
          { label: 'Critical Items', value: data.filter((d: any) => d.priority === 'Critical').length },
          { label: 'High Priority', value: data.filter((d: any) => d.priority === 'High').length },
          { label: 'Total', value: data.length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Critical Equipment Status', subtitle: 'SOLAS-critical and class-critical systems', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'unplanned-jobs': {
        const unplannedWOs = vesselWorkOrders.filter((wo: any) => 
          wo.type === 'Unplanned' || wo.type === 'Breakdown' || wo.workOrderNumber?.startsWith('UWO')
        );

        const columns = [
          { header: 'WO Number', field: 'workOrderNumber', width: 40 },
          { header: 'Title', field: 'title', width: 60 },
          { header: 'Component', field: 'component', width: 50 },
          { header: 'Type', field: 'type', width: 30 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const data = unplannedWOs.map((wo: any) => ({
          workOrderNumber: wo.workOrderNumber || wo.id,
          title: wo.title || wo.jobTitle || '-',
          component: wo.component || wo.componentName || '-',
          type: wo.type || 'Unplanned',
          status: wo.status || 'Open'
        }));

        const summary = [
          { label: 'Total Unplanned', value: data.length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Unplanned/Breakdown Jobs', subtitle: 'Analysis of breakdown maintenance', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'postponement-log': {
        const postponedWOs = vesselWorkOrders.filter((wo: any) => 
          wo.status === 'Postponed' || wo.postponedDate
        );

        const columns = [
          { header: 'WO Number', field: 'workOrderNumber', width: 40 },
          { header: 'Title', field: 'title', width: 60 },
          { header: 'Original Due', field: 'originalDue', width: 30 },
          { header: 'New Due', field: 'newDue', width: 30 },
          { header: 'Reason', field: 'reason', width: 50 }
        ];

        const data = postponedWOs.map((wo: any) => ({
          workOrderNumber: wo.workOrderNumber || wo.id,
          title: wo.title || wo.jobTitle || '-',
          originalDue: formatDate(wo.originalDueDate || wo.dueDate),
          newDue: formatDate(wo.postponedDate || wo.newDueDate),
          reason: wo.postponementReason || wo.remarks || '-'
        }));

        const summary = [
          { label: 'Total Postponed', value: data.length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Job Postponement Log', subtitle: 'Audit trail of postponed jobs', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'priority-performance': {
        const priorityGroups: Record<string, { total: number; completed: number; overdue: number }> = {};
        
        vesselWorkOrders.forEach((wo: any) => {
          const priority = wo.priority || 'Normal';
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

        pdfReportGenerator.generateReport(
          { title: 'Work Priority Performance', subtitle: 'Performance analysis by priority levels', vessel: vesselName },
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

        pdfReportGenerator.generateReport(
          { title: 'Man-Hours Analysis', subtitle: 'Planned vs Actual hours comparison', vessel: vesselName },
          columns,
          data
        );
        break;
      }

      case 'workload-distribution': {
        const assigneeGroups: Record<string, { count: number; completed: number }> = {};
        
        vesselWorkOrders.forEach((wo: any) => {
          const assignee = wo.assignee || wo.performedBy || wo.responsibleRank || 'Unassigned';
          if (!assigneeGroups[assignee]) {
            assigneeGroups[assignee] = { count: 0, completed: 0 };
          }
          assigneeGroups[assignee].count++;
          if (wo.status === 'Completed') assigneeGroups[assignee].completed++;
        });

        const columns = [
          { header: 'Assignee/Rank', field: 'assignee', width: 50 },
          { header: 'Total Assigned', field: 'total', width: 35 },
          { header: 'Completed', field: 'completed', width: 35 },
          { header: 'Pending', field: 'pending', width: 35 },
          { header: 'Completion %', field: 'completionPercent', width: 35 }
        ];

        const data = Object.entries(assigneeGroups).map(([assignee, stats]) => ({
          assignee,
          total: stats.count,
          completed: stats.completed,
          pending: stats.count - stats.completed,
          completionPercent: stats.count > 0 ? `${Math.round((stats.completed / stats.count) * 100)}%` : '0%'
        }));

        pdfReportGenerator.generateReport(
          { title: 'Crew Workload Distribution', subtitle: 'Task distribution across ranks', vessel: vesselName },
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
      } else {
        toast({
          title: "Excel Export",
          description: "Excel export coming soon. PDF is currently available.",
        });
        return;
      }
      
      toast({
        title: "Report Generated",
        description: `${format} report downloaded successfully!`,
      });
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Generation Failed",
        description: `Failed to generate ${format} report. Please try again.`,
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

  const handlePreviewReport = (reportId: string) => {
    handleGenerateReport(reportId, 'PDF');
  };

  return (
    <div className="p-6 bg-[#fafafa] min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button 
            variant="outline" 
            onClick={onBack}
            className="flex items-center gap-2"
            data-testid="button-back-to-reports"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Button>
          <div className="h-6 border-l border-gray-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500 text-white">
                <FileText className="h-5 w-5" />
              </div>
              Maintenance & Work Orders
            </h1>
            <p className="text-gray-600">10 comprehensive reports for maintenance planning and tracking</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search maintenance reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-maintenance-reports"
            />
          </div>
          
          <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
            <SelectTrigger className="w-48" data-testid="select-frequency-filter">
              <SelectValue placeholder="Filter by frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPriority} onValueChange={setSelectedPriority}>
            <SelectTrigger className="w-48" data-testid="select-priority-filter">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
              <SelectItem value="low">Low Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-800" data-testid="text-maintenance-total-reports">10</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-maintenance-high-priority">3</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Daily Reports</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-maintenance-daily-reports">2</p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Work Orders</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-maintenance-work-orders">{workOrders.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow" data-testid={`maintenance-report-card-${report.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <Badge className={getPriorityColor(report.priority)} variant="secondary">
                        {report.priority.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{report.frequency}</p>
                    <p>{report.estimatedTime}</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <p className="text-gray-700 text-sm mb-2">{report.description}</p>
                  <p className="text-xs text-gray-500"><strong>Purpose:</strong> {report.purpose}</p>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Key Fields:</p>
                    <div className="flex flex-wrap gap-1">
                      {report.fields.slice(0, 3).map((field, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                      {report.fields.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{report.fields.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Outputs:</p>
                    <div className="flex gap-1">
                      {report.outputs.map((output, index) => (
                        <Badge key={index} className="text-xs bg-green-100 text-green-700">
                          {output}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handlePreviewReport(report.id)}
                    className="flex items-center gap-2"
                    data-testid={`button-preview-${report.id}`}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  
                  <div className="flex gap-1">
                    {report.outputs.includes('PDF') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGenerateReport(report.id, 'PDF')}
                        className="bg-red-600 hover:bg-red-700 text-white px-3"
                        disabled={generatingReports.has(`${report.id}-PDF`)}
                        data-testid={`button-pdf-${report.id}`}
                      >
                        {generatingReports.has(`${report.id}-PDF`) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'PDF'
                        )}
                      </Button>
                    )}
                    {report.outputs.includes('Excel') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGenerateReport(report.id, 'Excel')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3"
                        disabled={generatingReports.has(`${report.id}-Excel`)}
                        data-testid={`button-excel-${report.id}`}
                      >
                        {generatingReports.has(`${report.id}-Excel`) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Excel'
                        )}
                      </Button>
                    )}
                    {report.outputs.includes('Dashboard') && (
                      <Button 
                        size="sm" 
                        onClick={() => {
                          toast({
                            title: "Dashboard View",
                            description: "Dashboard view will be implemented in the next phase",
                          });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3"
                        data-testid={`button-dashboard-${report.id}`}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default MaintenanceReports;
