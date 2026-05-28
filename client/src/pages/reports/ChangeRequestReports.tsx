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
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";
import { ReportColumn } from "@/components/reports/ReportPreviewModal";

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
    vessels: string[];
    component: string;
    dateRange: { from: Date | null; to: Date | null };
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
    vessel: (globalFilters?.vessels?.length === 1 ? globalFilters.vessels[0] : "all"),
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [globalVessels, setGlobalVessels] = useState<string[]>(globalFilters?.vessels || []);
  const [globalComponent, setGlobalComponent] = useState<string>(globalFilters?.component || "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const [isFilterRefreshing, setIsFilterRefreshing] = useState(false);
  const initialLoadRef = useRef(false);
  const previewVersionRef = useRef(0);
  const pendingPreviewRef = useRef(false);
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
      setPreviewData(null);
      initialLoadRef.current = false;
      ++previewVersionRef.current;
    }
  }, [embedded, selectedReportId]);

  useEffect(() => {
    if (!embedded || !selectedReportId || !initialLoadRef.current) return;
    setIsFilterRefreshing(true);
    setPreviewData(null);
    ++previewVersionRef.current;
    pendingPreviewRef.current = true;
  }, [filterFingerprint]);

  useEffect(() => {
    if (!actionTrigger || !embedded || !selectedReportId) return;
    if (actionTrigger.type === 'pdf') {
      handleGenerateReport(selectedReportId, 'PDF');
    } else if (actionTrigger.type === 'excel') {
      handleGenerateReport(selectedReportId, 'Excel');
    }
  }, [actionTrigger]);

  const effectiveVesselId = (globalFilters?.vessels !== undefined)
    ? (globalFilters.vessels.length === 1 ? globalFilters.vessels[0] : 'all')
    : (categoryFilters.vessel === 'all' ? 'all' : (categoryFilters.vessel || contextVesselId));

  const isMultiVessel = effectiveVesselId === 'all';

  const { data: reportData, isLoading, isFetching, error } = useQuery<ChangeRequestReportData>({
    queryKey: ['/technical/api/reports/change-requests-status-tracking', effectiveVesselId || 'all', statusFilter, categoryFilter, (globalFilters?.dateRange?.from ?? categoryFilters.dateRange.from)?.toISOString(), (globalFilters?.dateRange?.to ?? categoryFilters.dateRange.to)?.toISOString(), globalVessels.join(',')],
    queryFn: async () => {
      const effectiveDateRange = globalFilters?.dateRange ?? categoryFilters.dateRange;
      const params = new URLSearchParams();
      if (effectiveVesselId) params.set('vesselId', effectiveVesselId);
      else params.set('vesselId', 'all');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (effectiveDateRange?.from) params.set('startDate', effectiveDateRange.from.toISOString());
      if (effectiveDateRange?.to) params.set('endDate', effectiveDateRange.to.toISOString());
      if (isMultiVessel && globalVessels.length > 0) params.set('vesselIds', globalVessels.join(','));
      const res = await fetch(`/technical/api/reports/change-requests-status-tracking?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch report data');
      return res.json();
    },
  });

  const filteredRequests = useMemo(() => {
    const activeComponent = globalFilters?.component || "";
    if (!reportData?.requests) return [];
    let result = reportData.requests;
    if (globalVessels.length > 0 && globalVessels.length < vessels.length) {
      result = result.filter(r => !r.vessel?.id || globalVessels.includes(r.vessel.id));
    }
    if (activeComponent) {
      const q = activeComponent.toLowerCase();
      result = result.filter(r => {
        const target = (r.targetInfo?.name || "").toLowerCase();
        return target.includes(q);
      });
    }
    return result;
  }, [reportData?.requests, globalVessels, globalFilters?.component, vessels.length]);

  useEffect(() => {
    if (!embedded || !selectedReportId) return;
    if (!reportData) return;
    if (initialLoadRef.current) return;
    const version = ++previewVersionRef.current;
    initialLoadRef.current = true;
    generateChangeRequestReport(selectedReportId, 'preview').then((data) => {
      if (previewVersionRef.current === version) {
        if (data) setPreviewData(data);
      }
    }).catch((err) => { console.error('Report preview load failed:', err); });
  }, [reportData, embedded, selectedReportId]);

  useEffect(() => {
    if (!embedded || !selectedReportId || !initialLoadRef.current || !pendingPreviewRef.current) return;
    if (isFetching) return;
    pendingPreviewRef.current = false;
    const version = ++previewVersionRef.current;
    generateChangeRequestReport(selectedReportId, 'preview').then((data) => {
      if (previewVersionRef.current === version) {
        if (data) setPreviewData(data);
        setIsFilterRefreshing(false);
      }
    }).catch(() => {
      if (previewVersionRef.current === version) setIsFilterRefreshing(false);
    });
  }, [filteredRequests, isFetching]);

  const reports: ChangeRequestReport[] = [
    {
      id: "change-requests-status",
      name: "Change Requests Status & Tracking",
      description: "Comprehensive tracking of all PMS change requests including workflow status and approval progress",
      purpose: "Monitor change request pipeline & track approvals (Office/Superintendent)",
      frequency: "Weekly",
      fields: ["Request ID", "Title", "Type", "Status", "Date"],
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

  const generateChangeRequestReport = async (reportId: string, mode: 'preview' | 'download' = 'download'): Promise<ReportPreviewData | void> => {
    if (!reportData) {
      if (mode === 'download') {
        toast({ title: "No Data", description: "No report data available to export.", variant: "destructive" });
      }
      return;
    }

    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');
    const requests = filteredRequests;

    switch (reportId) {
      case 'change-requests-status': {
        const columns = [
          { header: 'S.No', field: 'sno', width: 10 },
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

        const tableData = requests.map((req, index) => ({
          sno: index + 1,
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

        const finalData = tableData.length > 0 ? tableData : [{ sno: '-', id: '-', title: 'No change requests found', category: '-', status: '-', requestedBy: '-', vessel: '-', submittedAt: '-', reviewedBy: '-', reviewedAt: '-', cycleTime: '-', target: '-', changesCount: '-', reason: '-' }];

        if (mode === 'preview') {
          return {
            title: 'Change Requests Status & Tracking',
            subtitle: `Comprehensive tracking report - ${requests.length} requests`,
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
            columns,
            data: finalData,
            summary: summaryItems
          };
        }

        pdfReportGenerator.generateReport(
          {
            title: 'Change Requests Status & Tracking',
            subtitle: `Comprehensive tracking report - ${requests.length} requests`,
            vessel: vesselName,
            orientation: 'landscape',
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          finalData
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
          return {
            title: 'Change Request Analytics',
            subtitle: 'Statistical analysis and trends',
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
            columns,
            data
          };
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
      const data = await generateChangeRequestReport(reportId, 'preview');
      if (data) {
        setPreviewData(data);
      }
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
      if (globalComponent) params.set('componentFilter', globalComponent);

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

  const summary = useMemo(() => {
    if (!reportData?.summary) return undefined;
    if (!(globalFilters?.component)) return reportData.summary;
    const reqs = filteredRequests;
    const byStatus: Record<string, number> = { draft: 0, submitted: 0, returned: 0, approved: 0, rejected: 0 };
    const byCategory: Record<string, number> = { components: 0, work_orders: 0, spares: 0, stores: 0 };
    let pendingRequests = 0;
    let totalCycle = 0;
    let cycleCount = 0;
    for (const r of reqs) {
      const st = (r.status || '').toLowerCase();
      if (byStatus[st] !== undefined) byStatus[st]++;
      if (st === 'submitted' || st === 'returned') pendingRequests++;
      const cat = r.category || '';
      if (byCategory[cat] !== undefined) byCategory[cat]++;
      if (r.cycleTimeHours && r.cycleTimeHours > 0) { totalCycle += r.cycleTimeHours; cycleCount++; }
    }
    return {
      totalRequests: reqs.length,
      byStatus,
      byCategory,
      pendingRequests,
      avgApprovalTimeHours: cycleCount > 0 ? Math.round(totalCycle / cycleCount) : 0,
    };
  }, [reportData?.summary, globalFilters?.component, filteredRequests]);

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

          {filteredReports.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-border overflow-hidden bg-white dark:bg-card">
              <ChangeRequestReportListGrid
                reports={filteredReports}
                generatingReports={generatingReports}
                isLoading={isLoading}
                getPriorityColor={getPriorityColor}
                onPreview={(id) => handlePreviewReport(id)}
                onGenerate={(id, fmt) => handleGenerateReport(id, fmt)}
              />
            </div>
          )}

          {filteredReports.length === 0 && (
            <div className="text-center py-12">
              <GitPullRequest className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-foreground mb-2">No reports found</h3>
              <p className="text-gray-500 dark:text-muted-foreground">Try adjusting your search criteria</p>
            </div>
          )}
        </>
      )}

      {embedded && isLoading && !previewData && !isFilterRefreshing && (
        <div className="flex items-center justify-center py-12" data-testid="initial-load-loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading report data...</span>
        </div>
      )}
      {embedded && isFilterRefreshing && !previewData && (
        <div className="flex items-center justify-center py-12" data-testid="filter-refresh-loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Refreshing report data...</span>
        </div>
      )}
      {embedded && previewData && (
        <InlineReportPreview reportData={previewData ? { ...previewData, reportId: previewData.reportId ?? selectedReportId ?? null } : null} embedded={embedded} />
      )}
      {!embedded && (
        <ReportPreviewModal
          open={!!previewData}
          onClose={() => setPreviewData(null)}
          reportData={previewData ? { ...previewData, reportId: previewData.reportId ?? selectedReportId ?? null } : null}
        />
      )}
    </div>
  );
};

interface ChangeRequestReportListGridProps {
  reports: ChangeRequestReport[];
  generatingReports: Set<string>;
  isLoading: boolean;
  getPriorityColor: (p: string) => string;
  onPreview: (id: string) => void;
  onGenerate: (id: string, fmt: 'PDF' | 'Excel') => void;
}

const ChangeRequestReportListGrid: React.FC<ChangeRequestReportListGridProps> = ({
  reports, generatingReports, isLoading, getPriorityColor, onPreview, onGenerate,
}) => {
  const columns: ReportColumn[] = useMemo(() => [
    {
      header: 'Report Name', field: 'name', flex: 2, minWidth: 280,
      autoHeight: true, wrapText: true,
      cellStyle: { whiteSpace: 'normal', lineHeight: '1.3', paddingTop: 8, paddingBottom: 8 },
      cellRenderer: (p: any) => (
        <div data-testid={`change-report-row-${p.data.id}`}>
          <div className="font-medium text-gray-900 dark:text-foreground">{p.data.name}</div>
          <div className="text-sm text-gray-500 dark:text-muted-foreground">{p.data.description}</div>
        </div>
      ),
    },
    {
      header: 'Frequency', field: 'frequency', flex: 1, minWidth: 120,
      cellRenderer: (p: any) => <Badge variant="outline">{p.value}</Badge>,
    },
    {
      header: 'Priority', field: 'priority', flex: 1, minWidth: 110,
      cellRenderer: (p: any) => (
        <Badge className={getPriorityColor(p.value)}>{String(p.value).toUpperCase()}</Badge>
      ),
    },
    {
      header: 'Est. Time', field: 'estimatedTime', flex: 1, minWidth: 110,
      cellRenderer: (p: any) => <span className="text-xs text-gray-500 dark:text-muted-foreground">{p.value}</span>,
    },
    {
      header: 'Actions', field: 'actions', flex: 1, minWidth: 140, sortable: false, filter: false,
      cellRenderer: (p: any) => {
        const r: ChangeRequestReport = p.data;
        return (
          <div className="flex items-center gap-1">
            <Button
              size="icon" variant="ghost" title="Preview"
              onClick={(e) => { e.stopPropagation(); onPreview(r.id); }}
              disabled={isLoading}
              data-testid={`button-preview-${r.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="ghost" title="Download PDF"
              onClick={(e) => { e.stopPropagation(); onGenerate(r.id, 'PDF'); }}
              disabled={generatingReports.has(`${r.id}-PDF`) || isLoading}
              data-testid={`button-pdf-${r.id}`}
            >
              <FileText className="h-4 w-4" />
            </Button>
            {r.outputs.includes('Excel') && (
              <Button
                size="icon" variant="ghost" title="Download Excel"
                onClick={(e) => { e.stopPropagation(); onGenerate(r.id, 'Excel'); }}
                disabled={generatingReports.has(`${r.id}-Excel`) || isLoading}
                data-testid={`button-excel-${r.id}`}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ], [generatingReports, isLoading, getPriorityColor, onPreview, onGenerate]);

  return (
    <ReportAgGridTable
      columns={columns}
      data={reports}
      domLayout="autoHeight"
      headerHeight={42}
      rowHeight={64}
      testId="grid-change-reports-list"
      noRowsMessage="No reports found"
    />
  );
};

export default ChangeRequestReports;
