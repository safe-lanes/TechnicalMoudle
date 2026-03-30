import { useState, useEffect } from "react";
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
  GitPullRequest,
  ClipboardList,
  Clock,
  CheckCircle,
  Eye,
  Loader2,
  FileText,
  Download,
  XCircle,
  Send,
  CornerDownLeft,
  Calendar as CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
import { pdfReportGenerator, formatDate, formatReportDateRange } from "@/lib/pdfReportGenerator";
import ReportPreviewModal, { ReportPreviewData } from "@/components/reports/ReportPreviewModal";
import InlineReportPreview from "@/components/reports/InlineReportPreview";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";

interface ChangeRequestReportData {
  summary: {
    totalRequests: number;
    byStatus: {
      draft: number;
      submitted: number;
      returned: number;
      approved: number;
      rejected: number;
    };
    byCategory: {
      components: number;
      work_orders: number;
      spares: number;
      stores: number;
    };
    avgApprovalTimeHours: number;
    pendingRequests: number;
  };
  requests: Array<{
    id: number;
    title: string;
    category: string;
    status: string;
    requestedBy: { name: string; rank: string; userId: string };
    reviewedBy: { name: string; rank: string; userId: string } | null;
    vessel: { id: string; name: string };
    submittedAt: string | null;
    reviewedAt: string | null;
    createdAt: string;
    reason: string;
    targetInfo: { type: string; id: string; name: string };
    changesCount: number;
    fieldChanges: Array<{
      fieldPath: string;
      oldValue: any;
      newValue: any;
      fieldLabel: string;
    }>;
    cycleTimeHours: number | null;
    revisionNumber: number;
  }>;
}

interface ChangeRequestReport {
  id: string;
  name: string;
  description: string;
  purpose: string;
  frequency: string;
  fields: string[];
  outputs: string[];
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
}

interface ChangeRequestReportsProps {
  onBack: () => void;
  globalFilters?: {
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
  embedded?: boolean;
  selectedReportId?: string | null;
  actionTrigger?: { type: 'pdf' | 'excel'; ts: number } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  components: 'Components',
  work_orders: 'Work Orders',
  spares: 'Spares',
  stores: 'Stores',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  returned: 'Returned',
  approved: 'Approved',
  rejected: 'Rejected',
};

const ChangeRequestReports: React.FC<ChangeRequestReportsProps> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: globalFilters?.vessel || "all",
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId: contextVesselId } = useVessel();

  useEffect(() => {
    if (globalFilters?.vessel) {
      setCategoryFilters(prev => ({ ...prev, vessel: globalFilters.vessel }));
    }
  }, [globalFilters?.vessel]);

  useEffect(() => {
    if (globalFilters?.dateRange) {
      setCategoryFilters(prev => ({ ...prev, dateRange: globalFilters.dateRange }));
    }
  }, [globalFilters?.dateRange]);

  useEffect(() => {
    if (embedded && selectedReportId) {
      setPreviewData(null);
      handlePreviewReport(selectedReportId);
    }
  }, [embedded, selectedReportId]);

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

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (effectiveVesselId) params.set('vesselId', effectiveVesselId);
    else params.set('vesselId', 'all');
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (categoryFilters.dateRange.from) params.set('startDate', categoryFilters.dateRange.from.toISOString());
    if (categoryFilters.dateRange.to) params.set('endDate', categoryFilters.dateRange.to.toISOString());
    return params.toString();
  };

  const queryString = buildQueryString();

  const { data: reportData, isLoading, error } = useQuery<ChangeRequestReportData>({
    queryKey: ['/technical/api/reports/change-requests-status-tracking', effectiveVesselId || 'all', statusFilter, categoryFilter, categoryFilters.dateRange.from?.toISOString(), categoryFilters.dateRange.to?.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/technical/api/reports/change-requests-status-tracking?${queryString}`);
      if (!res.ok) throw new Error('Failed to fetch report data');
      return res.json();
    },
  });

  const reports: ChangeRequestReport[] = [
    {
      id: "change-requests-status",
      name: "Change Requests Status & Tracking",
      description: "Comprehensive tracking of all PMS change requests including workflow status and approval progress",
      purpose: "Monitor change request pipeline & track approvals (Office/Superintendent)",
      frequency: "Weekly",
      fields: ["Request ID", "Title", "Type", "Status", "Priority", "Date"],
      outputs: ["PDF", "Excel"],
      icon: GitPullRequest,
      priority: "high",
      estimatedTime: "2-3 min"
    }
  ];

  const filteredReports = reports.filter(report => {
    if (embedded && selectedReportId) return report.id === selectedReportId;
    return report.name.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase()) ||
           report.description.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase());
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatFieldValue = (val: any): string => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  const generateChangeRequestReport = async (reportId: string, mode: 'preview' | 'download' = 'download') => {
    if (!reportData) {
      toast({ title: "No Data", description: "No report data available to export.", variant: "destructive" });
      return;
    }

    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');
    const summary = reportData.summary;

    switch (reportId) {
      case 'change-requests-status': {
        const columns = [
          { header: 'ID', field: 'id', width: 10 },
          { header: 'Title', field: 'title', width: 40 },
          { header: 'Category', field: 'category', width: 18 },
          { header: 'Status', field: 'status', width: 16 },
          { header: 'Requested By', field: 'requestedBy', width: 20 },
          { header: 'Vessel', field: 'vessel', width: 18 },
          { header: 'Submitted', field: 'submittedAt', width: 18 },
          { header: 'Reviewed By', field: 'reviewedBy', width: 20 },
          { header: 'Reviewed At', field: 'reviewedAt', width: 18 },
          { header: 'Cycle Time (hrs)', field: 'cycleTime', width: 16 },
          { header: 'Target', field: 'target', width: 28 },
          { header: 'Changes', field: 'changesCount', width: 12 },
          { header: 'Reason', field: 'reason', width: 30 }
        ];

        const tableData = reportData.requests.map(req => ({
          id: String(req.id),
          title: req.title.length > 50 ? req.title.substring(0, 47) + '...' : req.title,
          category: CATEGORY_LABELS[req.category] || req.category,
          status: STATUS_LABELS[req.status] || req.status,
          requestedBy: req.requestedBy?.name || '-',
          vessel: req.vessel?.name || '-',
          submittedAt: req.submittedAt ? formatDate(req.submittedAt) : formatDate(req.createdAt),
          reviewedBy: req.reviewedBy?.name || '-',
          reviewedAt: req.reviewedAt ? formatDate(req.reviewedAt) : '-',
          cycleTime: req.cycleTimeHours != null ? String(req.cycleTimeHours) : '-',
          target: req.targetInfo?.name ? `${CATEGORY_LABELS[req.targetInfo.type] || req.targetInfo.type} - ${req.targetInfo.name}` : '-',
          changesCount: String(req.changesCount),
          reason: req.reason || '-'
        }));

        const totalReqs = summary.totalRequests;
        const approvedPct = totalReqs > 0 ? Math.round((summary.byStatus.approved / totalReqs) * 100) : 0;
        const rejectedPct = totalReqs > 0 ? Math.round((summary.byStatus.rejected / totalReqs) * 100) : 0;

        const summaryItems = [
          { label: 'Total Requests', value: summary.totalRequests },
          { label: `Approved (${approvedPct}%)`, value: summary.byStatus.approved },
          { label: `Rejected (${rejectedPct}%)`, value: summary.byStatus.rejected },
          { label: 'Pending Review', value: summary.pendingRequests },
          { label: 'Avg Approval Time (hrs)', value: summary.avgApprovalTimeHours },
          { label: 'Components', value: summary.byCategory.components },
          { label: 'Work Orders', value: summary.byCategory.work_orders },
          { label: 'Spares', value: summary.byCategory.spares },
          { label: 'Stores', value: summary.byCategory.stores }
        ];

        const finalData = tableData.length > 0 ? tableData : [{ id: '-', title: 'No change requests found', category: '-', status: '-', requestedBy: '-', vessel: '-', submittedAt: '-', reviewedBy: '-', reviewedAt: '-', cycleTime: '-', target: '-', changesCount: '-', reason: '-' }];

        if (mode === 'preview') {
          setPreviewData({
            title: 'Change Requests Status & Tracking',
            subtitle: `Comprehensive tracking report - ${reportData.requests.length} requests`,
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
            columns,
            data: finalData,
            summary: summaryItems
          });
          return;
        }

        pdfReportGenerator.generateReport(
          {
            title: 'Change Requests Status & Tracking',
            subtitle: `Comprehensive tracking report - ${reportData.requests.length} requests`,
            vessel: vesselName,
            orientation: 'landscape',
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          finalData,
          summaryItems
        );
        break;
      }

      case 'change-analytics': {
        const columns = [
          { header: 'Metric', field: 'metric', width: 60 },
          { header: 'Value', field: 'value', width: 40 },
          { header: 'Notes', field: 'notes', width: 60 }
        ];

        const totalReqs = summary.totalRequests;
        const approvedPct = totalReqs > 0 ? `${Math.round((summary.byStatus.approved / totalReqs) * 100)}%` : 'N/A';

        const data = [
          { metric: 'Total Change Requests', value: summary.totalRequests, notes: 'Current period' },
          { metric: 'Approved Requests', value: summary.byStatus.approved, notes: `Approval rate: ${approvedPct}` },
          { metric: 'Rejected Requests', value: summary.byStatus.rejected, notes: 'Review needed for patterns' },
          { metric: 'Pending Review', value: summary.pendingRequests, notes: 'Submitted + Returned' },
          { metric: 'Avg Approval Time (hours)', value: summary.avgApprovalTimeHours, notes: 'From submission to review' },
          { metric: 'Components Changes', value: summary.byCategory.components, notes: 'Component modifications' },
          { metric: 'Work Order Changes', value: summary.byCategory.work_orders, notes: 'Work order modifications' },
          { metric: 'Spares Changes', value: summary.byCategory.spares, notes: 'Spare parts modifications' },
          { metric: 'Stores Changes', value: summary.byCategory.stores, notes: 'Stores modifications' }
        ];

        if (mode === 'preview') {
          setPreviewData({
            title: 'Change Request Analytics',
            subtitle: 'Statistical analysis and trends',
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
            columns,
            data
          });
          return;
        }

        pdfReportGenerator.generateReport(
          { title: 'Change Request Analytics', subtitle: 'Statistical analysis and trends', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
          columns,
          data
        );
        break;
      }

      default:
        toast({ title: "Report Not Available", description: "This report is not yet implemented", variant: "destructive" });
    }
  };

  const handlePreviewReport = async (reportId: string) => {
    try {
      toast({ title: "Loading Preview", description: "Preparing report data..." });
      await generateChangeRequestReport(reportId, 'preview');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast({ title: "Preview Failed", description: error.message || "Failed to load report preview.", variant: "destructive" });
    }
  };

  const handleExcelExport = async (reportId: string) => {
    if (reportId !== 'change-requests-status') {
      toast({ title: "Not Available", description: "Excel export is only available for the Status & Tracking report.", variant: "destructive" });
      return;
    }

    try {
      const params = new URLSearchParams();
      params.set('vesselId', effectiveVesselId || 'all');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (categoryFilters.dateRange.from) params.set('startDate', categoryFilters.dateRange.from.toISOString());
      if (categoryFilters.dateRange.to) params.set('endDate', categoryFilters.dateRange.to.toISOString());

      const response = await fetch(`/technical/api/reports/change-requests-status-tracking/export?${params.toString()}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch ? filenameMatch[1] : 'Change_Requests_Status_Tracking.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export error:', err);
      throw err;
    }
  };

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel') => {
    const reportKey = `${reportId}-${format}`;

    if (generatingReports.has(reportKey)) return;

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateChangeRequestReport(reportId, 'download');
        toast({ title: "Report Generated", description: `${format} report downloaded successfully!` });
      } else {
        await handleExcelExport(reportId);
        toast({ title: "Report Generated", description: "Excel report downloaded successfully!" });
      }

    } catch (error) {
      console.error('Error generating report:', error);
      toast({ title: "Generation Failed", description: "Failed to generate report.", variant: "destructive" });
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportKey);
        return newSet;
      });
    }
  };

  const summary = reportData?.summary;

  return (
    <div className={embedded ? "p-4" : "p-6 bg-white dark:bg-background min-h-screen"}>
      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6 flex-wrap">
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground" data-testid="text-page-title">Change Requests</h1>
              <p className="text-sm text-gray-500 dark:text-muted-foreground">1 report for change tracking</p>
            </div>
          </div>

          <CategoryFilters
            filters={categoryFilters}
            onFiltersChange={setCategoryFilters}
            searchPlaceholder="Search change request reports..."
          />

          {(categoryFilters.dateRange?.from || categoryFilters.dateRange?.to) && (
            <div className="flex items-center gap-2 px-3 py-2 mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300">
              <CalendarIcon className="h-4 w-4 flex-shrink-0" />
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
          <div className="mb-6">
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-muted-foreground">Status:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-muted-foreground">Category:</span>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-category-filter">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="components">Components</SelectItem>
                    <SelectItem value="work_orders">Work Orders</SelectItem>
                    <SelectItem value="spares">Spares</SelectItem>
                    <SelectItem value="stores">Stores</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Send className="w-4 h-4 text-blue-500" />
                  Submitted
                </CardDescription>
                <CardTitle className="text-3xl" data-testid="text-submitted-count">
                  {isLoading ? '...' : (summary?.byStatus.submitted ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  Pending Review
                </CardDescription>
                <CardTitle className="text-3xl text-yellow-600" data-testid="text-pending-count">
                  {isLoading ? '...' : (summary?.pendingRequests ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <ClipboardList className="w-4 h-4 text-blue-500" />
                  Total Requests
                </CardDescription>
                <CardTitle className="text-3xl text-blue-600" data-testid="text-total-count">
                  {isLoading ? '...' : (summary?.totalRequests ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Approved
                </CardDescription>
                <CardTitle className="text-3xl text-green-600" data-testid="text-approved-count">
                  {isLoading ? '...' : (summary?.byStatus.approved ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" data-testid="text-error-message">
              <p className="text-red-700 dark:text-red-300 text-sm">Failed to load report data. Please try again.</p>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 dark:border-border overflow-hidden bg-white dark:bg-card">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-muted/50 border-b border-gray-200 dark:border-border">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-foreground">Report Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-foreground">Frequency</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-foreground">Priority</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-foreground">Est. Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-border">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover-elevate cursor-pointer"
                    data-testid={`change-report-row-${report.id}`}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-foreground">{report.name}</div>
                        <div className="text-sm text-gray-500 dark:text-muted-foreground">{report.description}</div>
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
                      <span className="text-xs text-gray-500 dark:text-muted-foreground">{report.estimatedTime}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Preview"
                          onClick={() => handlePreviewReport(report.id)}
                          disabled={isLoading}
                          data-testid={`button-preview-${report.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Download PDF"
                          onClick={() => handleGenerateReport(report.id, 'PDF')}
                          disabled={generatingReports.has(`${report.id}-PDF`) || isLoading}
                          data-testid={`button-pdf-${report.id}`}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {report.outputs.includes('Excel') && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Download Excel"
                            onClick={() => handleGenerateReport(report.id, 'Excel')}
                            disabled={generatingReports.has(`${report.id}-Excel`) || isLoading}
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
              <GitPullRequest className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-foreground mb-2">No reports found</h3>
              <p className="text-gray-500 dark:text-muted-foreground">Try adjusting your search criteria</p>
            </div>
          )}
        </>
      )}

      {embedded && previewData && (
        <InlineReportPreview reportData={previewData} />
      )}
      {!embedded && (
        <ReportPreviewModal
          open={!!previewData}
          onClose={() => setPreviewData(null)}
          reportData={previewData}
        />
      )}
    </div>
  );
};

export default ChangeRequestReports;
