import { useState, useEffect } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  LifeBuoy,
  Flame,
  Layers,
  CheckCircle,
  Eye,
  FileText,
  Download,
  Calendar as CalendarIcon,
  AlertTriangle,
  Clock,
  ListChecks
} from "lucide-react";
import { format } from "date-fns";
import { pdfReportGenerator, formatReportDateRange } from "@/lib/pdfReportGenerator";
import ReportPreviewModal, { ReportPreviewData } from "@/components/reports/ReportPreviewModal";
import InlineReportPreview from "@/components/reports/InlineReportPreview";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";

interface LsaFfaReportsProps {
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

interface LsaFfaReport {
  id: string;
  name: string;
  description: string;
  frequency: string;
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
  outputs: string[];
}

const LsaFfaReports: React.FC<LsaFfaReportsProps> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: globalFilters?.vessel || "all",
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const { data: masterListData, isLoading } = useQuery<any>({
    queryKey: ['/technical/api/reports/lsa-ffa-master-list', effectiveVesselId, equipmentTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('vesselId', effectiveVesselId || 'all');
      if (equipmentTypeFilter !== 'all') params.set('equipmentType', equipmentTypeFilter);
      const res = await fetch(`/technical/api/reports/lsa-ffa-master-list?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: scheduleData, isLoading: isScheduleLoading } = useQuery<any>({
    queryKey: ['/technical/api/reports/lsa-ffa-maintenance-schedule', effectiveVesselId, equipmentTypeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('vesselId', effectiveVesselId || 'all');
      if (equipmentTypeFilter !== 'all') params.set('equipmentType', equipmentTypeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/technical/api/reports/lsa-ffa-maintenance-schedule?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const reports: LsaFfaReport[] = [
    {
      id: "lsa-ffa-master-list",
      name: "LSA/FFA Equipment Master List",
      description: "Complete inventory of Life-Saving Appliances and Fire-Fighting Appliances with specifications",
      frequency: "Monthly",
      icon: LifeBuoy,
      priority: "high",
      estimatedTime: "1-2 min",
      outputs: ["PDF", "Excel"]
    },
    {
      id: "lsa-ffa-maintenance-schedule",
      name: "LSA/FFA Maintenance Schedule & Status",
      description: "Maintenance tracking for LSA and FFA equipment with due dates, overdue status, last done date, and work order history",
      frequency: "Weekly",
      icon: ListChecks,
      priority: "high",
      estimatedTime: "2-3 min",
      outputs: ["PDF", "Excel"]
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

  const generateReport = async (reportId: string, mode: 'preview' | 'download' = 'download') => {
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');

    if (reportId === 'lsa-ffa-master-list') {
      if (!masterListData) {
        toast({ title: "No Data", description: "No LSA/FFA data available to export.", variant: "destructive" });
        return;
      }

      const columns = [
        { header: 'S.No', field: 'sno', width: 8 },
        { header: 'Component Code', field: 'componentCode', width: 22 },
        { header: 'Component Name', field: 'componentName', width: 40 },
        { header: 'Equipment Type', field: 'equipmentType', width: 16 },
        { header: 'Location', field: 'location', width: 20 },
        { header: 'Maker', field: 'maker', width: 20 },
        { header: 'Model', field: 'model', width: 20 },
        { header: 'Serial No', field: 'serialNo', width: 18 },
        { header: 'Installation Date', field: 'installationDate', width: 16 },
        { header: 'Criticality', field: 'critical', width: 12 },
        { header: 'Class Item', field: 'classItem', width: 12 },
        { header: 'Active', field: 'isActive', width: 10 }
      ];

      const components = masterListData.components || [];
      const tableData = components.map((comp: any, idx: number) => ({
        sno: String(idx + 1),
        componentCode: comp.componentCode || '-',
        componentName: comp.componentName || '-',
        equipmentType: comp.equipmentType || '-',
        location: comp.location || '-',
        maker: comp.maker || '-',
        model: comp.model || '-',
        serialNo: comp.serialNo || '-',
        installationDate: comp.installationDate || '-',
        critical: comp.critical || '-',
        classItem: comp.classItem || '-',
        isActive: comp.isActive || '-'
      }));

      const summary = masterListData.summary || {};
      const summaryItems = [
        { label: 'Total LSA', value: summary.lsaCount ?? 0 },
        { label: 'Total FFA', value: summary.ffaCount ?? 0 },
        { label: 'Total Combined', value: summary.total ?? 0 },
        { label: 'Active', value: summary.activeCount ?? 0 }
      ];

      const finalData = tableData.length > 0 ? tableData : [{ sno: '-', componentCode: '-', componentName: 'No LSA/FFA components found', equipmentType: '-', location: '-', maker: '-', model: '-', serialNo: '-', installationDate: '-', critical: '-', classItem: '-', isActive: '-' }];

      if (mode === 'preview') {
        setPreviewData({
          title: 'LSA/FFA Equipment Master List',
          subtitle: `Complete inventory - ${components.length} components (LSA: ${summary.lsaCount ?? 0}, FFA: ${summary.ffaCount ?? 0})`,
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
          title: 'LSA/FFA Equipment Master List',
          subtitle: `Complete inventory - ${components.length} components (LSA: ${summary.lsaCount ?? 0}, FFA: ${summary.ffaCount ?? 0})`,
          vessel: vesselName,
          orientation: 'landscape',
          dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
        },
        columns,
        finalData,
        summaryItems
      );
    } else if (reportId === 'lsa-ffa-maintenance-schedule') {
      if (!scheduleData) {
        toast({ title: "No Data", description: "No maintenance schedule data available.", variant: "destructive" });
        return;
      }

      const columns = [
        { header: 'S.No', field: 'sno', width: 6 },
        { header: 'Comp Code', field: 'componentCode', width: 16 },
        { header: 'Component Name', field: 'componentName', width: 28 },
        { header: 'Type', field: 'equipmentType', width: 8 },
        { header: 'Location', field: 'location', width: 16 },
        { header: 'Job Code', field: 'jobCode', width: 14 },
        { header: 'Job Title', field: 'jobTitle', width: 30 },
        { header: 'Task Type', field: 'taskType', width: 14 },
        { header: 'Basis', field: 'maintenanceBasis', width: 12 },
        { header: 'Frequency', field: 'frequency', width: 12 },
        { header: 'Next Due', field: 'nextDueDate', width: 14 },
        { header: 'Days', field: 'daysUntilDue', width: 8 },
        { header: 'Status', field: 'status', width: 12 },
        { header: 'Last Done', field: 'lastDoneDate', width: 14 },
        { header: 'Last WO', field: 'lastWONumber', width: 16 },
        { header: 'Assigned To', field: 'assignedTo', width: 14 }
      ];

      const items = scheduleData.scheduleItems || [];
      const tableData = items.map((item: any) => ({
        sno: String(item.sno || ''),
        componentCode: item.componentCode || '-',
        componentName: item.componentName || '-',
        equipmentType: item.equipmentType || '-',
        location: item.location || '-',
        jobCode: item.jobCode || '-',
        jobTitle: item.jobTitle || '-',
        taskType: item.taskType || '-',
        maintenanceBasis: item.maintenanceBasis || '-',
        frequency: item.frequency || '-',
        nextDueDate: item.nextDueDate || '-',
        daysUntilDue: item.daysUntilDue !== undefined ? String(item.daysUntilDue) : '-',
        status: item.status || '-',
        lastDoneDate: item.lastDoneDate || '-',
        lastWONumber: item.lastWONumber || '-',
        assignedTo: item.assignedTo || '-'
      }));

      const summary = scheduleData.summary || {};
      const summaryItems = [
        { label: 'Total Items', value: summary.total ?? 0 },
        { label: 'On Schedule', value: summary.onSchedule ?? 0 },
        { label: 'Due Soon', value: summary.dueSoon ?? 0 },
        { label: 'Overdue', value: summary.overdue ?? 0 }
      ];

      const finalData = tableData.length > 0 ? tableData : [{ sno: '-', componentCode: '-', componentName: 'No maintenance items found', equipmentType: '-', location: '-', jobCode: '-', jobTitle: '-', taskType: '-', maintenanceBasis: '-', frequency: '-', nextDueDate: '-', daysUntilDue: '-', status: '-', lastDoneDate: '-', lastWONumber: '-', assignedTo: '-' }];

      if (mode === 'preview') {
        setPreviewData({
          title: 'LSA/FFA Maintenance Schedule & Status',
          subtitle: `${items.length} schedule items (Overdue: ${summary.overdue ?? 0}, Due Soon: ${summary.dueSoon ?? 0}, On Schedule: ${summary.onSchedule ?? 0})`,
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
          title: 'LSA/FFA Maintenance Schedule & Status',
          subtitle: `${items.length} schedule items (Overdue: ${summary.overdue ?? 0}, Due Soon: ${summary.dueSoon ?? 0}, On Schedule: ${summary.onSchedule ?? 0})`,
          vessel: vesselName,
          orientation: 'landscape',
          dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
        },
        columns,
        finalData,
        summaryItems
      );
    } else {
      toast({ title: "Report Not Available", description: "This report is not yet implemented", variant: "destructive" });
    }
  };

  const handlePreviewReport = async (reportId: string) => {
    try {
      toast({ title: "Loading Preview", description: "Preparing report data..." });
      await generateReport(reportId, 'preview');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast({ title: "Preview Failed", description: error.message || "Failed to load report preview.", variant: "destructive" });
    }
  };

  const handleExcelExport = async (reportId: string) => {
    const params = new URLSearchParams();
    params.set('vesselId', effectiveVesselId || 'all');
    params.set('format', 'excel');
    if (equipmentTypeFilter !== 'all') params.set('equipmentType', equipmentTypeFilter);

    let endpoint = '';
    if (reportId === 'lsa-ffa-master-list') {
      endpoint = '/technical/api/reports/lsa-ffa-master-list';
    } else if (reportId === 'lsa-ffa-maintenance-schedule') {
      endpoint = '/technical/api/reports/lsa-ffa-maintenance-schedule';
      if (statusFilter !== 'all') params.set('status', statusFilter);
    }

    const response = await fetch(`${endpoint}?${params.toString()}`);
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers.get('Content-Disposition');
    const filenameMatch = disposition?.match(/filename="(.+)"/);
    a.download = filenameMatch ? filenameMatch[1] : `${reportId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleGenerateReport = async (reportId: string, reportFormat: 'PDF' | 'Excel') => {
    const reportKey = `${reportId}-${reportFormat}`;
    if (generatingReports.has(reportKey)) return;

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${reportFormat} report...` });

      if (reportFormat === 'PDF') {
        await generateReport(reportId, 'download');
        toast({ title: "Report Generated", description: `${reportFormat} report downloaded successfully!` });
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

  const scheduleSummary = scheduleData?.summary || {};
  const masterSummary = masterListData?.summary || {};
  const anyLoading = isLoading || isScheduleLoading;

  return (
    <div className={embedded ? "p-4" : "p-6 bg-white dark:bg-background min-h-screen"}>
      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <Button
              variant="ghost"
              onClick={onBack}
              className="flex items-center gap-2"
              data-testid="button-back-lsa-ffa"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Reports
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground" data-testid="text-lsa-ffa-title">LSA/FFA Equipment</h1>
              <p className="text-sm text-gray-500 dark:text-muted-foreground">2 reports for life-saving and fire-fighting equipment</p>
            </div>
          </div>

          <CategoryFilters
            filters={categoryFilters}
            onFiltersChange={setCategoryFilters}
            searchPlaceholder="Search LSA/FFA reports..."
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

      <div className="mb-6">
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-muted-foreground">Equipment Type:</span>
            <Select value={equipmentTypeFilter} onValueChange={setEquipmentTypeFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-equipment-type-filter">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="LSA">LSA</SelectItem>
                <SelectItem value="FFA">FFA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-muted-foreground">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]" data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="due-soon">Due Soon</SelectItem>
                <SelectItem value="on-schedule">On Schedule</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Layers className="w-4 h-4 text-blue-500" />
              Total Items
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600" data-testid="text-total-items">
              {anyLoading ? '...' : (scheduleSummary.total ?? masterSummary.total ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Overdue
            </CardDescription>
            <CardTitle className="text-3xl text-red-600" data-testid="text-overdue-count">
              {anyLoading ? '...' : (scheduleSummary.overdue ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-amber-500" />
              Due Soon
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600" data-testid="text-due-soon-count">
              {anyLoading ? '...' : (scheduleSummary.dueSoon ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              On Schedule
            </CardDescription>
            <CardTitle className="text-3xl text-green-600" data-testid="text-on-schedule-count">
              {anyLoading ? '...' : (scheduleSummary.onSchedule ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {!masterListData && !scheduleData && !anyLoading && (
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
                data-testid={`lsa-ffa-report-row-${report.id}`}
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
                      disabled={anyLoading}
                      data-testid={`button-preview-${report.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Download PDF"
                      onClick={() => handleGenerateReport(report.id, 'PDF')}
                      disabled={generatingReports.has(`${report.id}-PDF`) || anyLoading}
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
                        disabled={generatingReports.has(`${report.id}-Excel`) || anyLoading}
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
          <LifeBuoy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-foreground mb-2">No reports found</h3>
          <p className="text-gray-500 dark:text-muted-foreground">Try adjusting your search criteria</p>
        </div>
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

export default LsaFfaReports;