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
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle,
  Eye,
  Loader2,
  FileText,
  Download,
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

interface CriticalEquipmentReport {
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

interface CriticalEquipmentReportsProps {
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

const CriticalEquipmentReports: React.FC<CriticalEquipmentReportsProps> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: (globalFilters?.vessels?.length === 1 ? globalFilters.vessels[0] : "all"),
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [globalVessels, setGlobalVessels] = useState<string[]>(globalFilters?.vessels || []);
  const [globalComponent, setGlobalComponent] = useState<string>(globalFilters?.component || "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classItemFilter, setClassItemFilter] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
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
      initialLoadRef.current = false;
      handlePreviewReport(selectedReportId).then(() => {
        if (previewVersionRef.current === version) {
          initialLoadRef.current = true;
        } else {
          setPreviewData(null);
        }
      });
    }
  }, [embedded, selectedReportId]);

  useEffect(() => {
    if (!embedded || !selectedReportId || !initialLoadRef.current) return;
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    setIsFilterRefreshing(true);
    const version = ++previewVersionRef.current;
    filterTimerRef.current = setTimeout(() => {
      setPreviewData(null);
      handlePreviewReport(selectedReportId).finally(() => {
        if (previewVersionRef.current !== version) {
          setPreviewData(null);
        }
        setIsFilterRefreshing(false);
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

  const { data: componentsData, isLoading: componentsLoading } = useQuery<any>({
    queryKey: ['/technical/api/reports/critical-components-list', effectiveVesselId, classItemFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('vesselId', effectiveVesselId || 'all');
      if (classItemFilter !== 'all') params.set('classItem', classItemFilter);
      const res = await fetch(`/technical/api/reports/critical-components-list?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery<any>({
    queryKey: ['/technical/api/reports/critical-equipment-schedule', effectiveVesselId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('vesselId', effectiveVesselId || 'all');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/technical/api/reports/critical-equipment-schedule?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const isLoading = componentsLoading || scheduleLoading;
  const error = !componentsData && !scheduleData && !isLoading;

  const filteredComponentsData = useMemo(() => {
    if (!componentsData?.components) return componentsData;
    let result = componentsData.components;
    if (globalVessels.length > 0 && globalVessels.length < vessels.length) {
      result = result.filter((c: any) => !c.vesselId || globalVessels.includes(c.vesselId));
    }
    if (globalComponent) {
      const q = globalComponent.toLowerCase();
      result = result.filter((c: any) => {
        const name = (c.componentName || c.name || "").toLowerCase();
        const code = (c.componentCode || c.code || "").toLowerCase();
        return name.includes(q) || code.includes(q);
      });
    }
    return { ...componentsData, components: result };
  }, [componentsData, globalVessels, globalComponent, vessels.length]);

  const filteredScheduleData = useMemo(() => {
    if (!scheduleData?.scheduleItems) return scheduleData;
    let result = scheduleData.scheduleItems;
    if (globalVessels.length > 0 && globalVessels.length < vessels.length) {
      result = result.filter((item: any) => !item.vesselId || globalVessels.includes(item.vesselId));
    }
    if (globalComponent) {
      const q = globalComponent.toLowerCase();
      result = result.filter((item: any) => {
        const name = (item.componentName || "").toLowerCase();
        const code = (item.componentCode || "").toLowerCase();
        return name.includes(q) || code.includes(q);
      });
    }
    return { ...scheduleData, scheduleItems: result, summary: { ...scheduleData.summary, total: result.length, onSchedule: result.filter((i: any) => i.status === 'On Schedule' || i.status === 'on-schedule').length, dueSoon: result.filter((i: any) => i.status === 'Due Soon' || i.status === 'due-soon').length, overdue: result.filter((i: any) => i.status === 'Overdue' || i.status === 'overdue').length } };
  }, [scheduleData, globalVessels, globalComponent, vessels.length]);

  const reports: CriticalEquipmentReport[] = [
    {
      id: "critical-components-list",
      name: "Critical Components Master List",
      description: "Complete list of all safety-critical equipment with specifications and classification status",
      purpose: "Equipment registry & compliance documentation (Superintendent/Auditor)",
      frequency: "Monthly",
      fields: ["Component Code", "Name", "Parent", "Category", "Location", "Maker", "Model", "Serial No", "Class Item", "Condition Based"],
      outputs: ["PDF", "Excel"],
      icon: Shield,
      priority: "high" as const,
      estimatedTime: "1-2 min"
    },
    {
      id: "critical-equipment-schedule",
      name: "Critical Equipment Maintenance Schedule & Status",
      description: "Comprehensive maintenance tracking with due dates, status indicators, and work order history for critical components",
      purpose: "Maintenance oversight & regulatory compliance (Chief Engineer/Office)",
      frequency: "Weekly",
      fields: ["Component", "Job", "Task Type", "Frequency", "Next Due", "Days Until Due", "Status", "Last Done", "Last WO"],
      outputs: ["PDF", "Excel"],
      icon: AlertTriangle,
      priority: "high" as const,
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

  const generateCriticalReport = async (reportId: string, mode: 'preview' | 'download' = 'download') => {
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');

    switch (reportId) {
      case 'critical-components-list': {
        if (!filteredComponentsData) {
          toast({ title: "No Data", description: "No components data available to export.", variant: "destructive" });
          return;
        }

        const columns = [
          { header: 'S.No', field: 'sno', width: 8 },
          { header: 'Component Code', field: 'componentCode', width: 25 },
          { header: 'Component Name', field: 'componentName', width: 40 },
          { header: 'Parent Component', field: 'parentName', width: 30 },
          { header: 'Category', field: 'category', width: 25 },
          { header: 'Location', field: 'location', width: 20 },
          { header: 'Maker', field: 'maker', width: 20 },
          { header: 'Model', field: 'model', width: 20 },
          { header: 'Serial No', field: 'serialNo', width: 18 },
          { header: 'Installation Date', field: 'installationDate', width: 16 },
          { header: 'Class Item', field: 'classItem', width: 12 },
          { header: 'Condition Based', field: 'conditionBased', width: 14 },
          { header: 'Active', field: 'isActive', width: 10 }
        ];

        const components = filteredComponentsData.components || [];
        const tableData = components.map((comp: any, idx: number) => ({
          sno: String(idx + 1),
          componentCode: comp.componentCode || '-',
          componentName: comp.componentName || '-',
          parentName: comp.parentName || '-',
          category: comp.category || '-',
          location: comp.location || '-',
          maker: comp.maker || '-',
          model: comp.model || '-',
          serialNo: comp.serialNo || '-',
          installationDate: comp.installationDate || '-',
          classItem: comp.classItem || '-',
          conditionBased: comp.conditionBased || '-',
          isActive: comp.isActive || '-'
        }));

        const summaryItems = [
          { label: 'Total Components', value: components.length },
          { label: 'Class Items', value: components.filter((c: any) => c.classItem === 'Yes' || c.classItem === true).length },
          { label: 'Non-Class Items', value: components.filter((c: any) => c.classItem !== 'Yes' && c.classItem !== true).length },
          { label: 'Active', value: components.filter((c: any) => c.isActive === 'Yes' || c.isActive === true).length },
          { label: 'Inactive', value: components.filter((c: any) => c.isActive !== 'Yes' && c.isActive !== true).length }
        ];

        const finalData = tableData.length > 0 ? tableData : [{ sno: '-', componentCode: '-', componentName: 'No critical components found', parentName: '-', category: '-', location: '-', maker: '-', model: '-', serialNo: '-', installationDate: '-', classItem: '-', conditionBased: '-', isActive: '-' }];

        if (mode === 'preview') {
          setPreviewData({
            title: 'Critical Components Master List',
            subtitle: `Complete list of safety-critical equipment - ${components.length} components`,
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
            title: 'Critical Components Master List',
            subtitle: `Complete list of safety-critical equipment - ${components.length} components`,
            vessel: vesselName,
            orientation: 'landscape',
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          finalData
        );
        break;
      }

      case 'critical-equipment-schedule': {
        if (!filteredScheduleData) {
          toast({ title: "No Data", description: "No schedule data available to export.", variant: "destructive" });
          return;
        }

        const columns = [
          { header: 'S.No', field: 'sno', width: 8 },
          { header: 'Comp Code', field: 'componentCode', width: 18 },
          { header: 'Component', field: 'componentName', width: 32 },
          { header: 'Location', field: 'location', width: 18 },
          { header: 'Job Code', field: 'jobCode', width: 16 },
          { header: 'Job Title', field: 'jobTitle', width: 35 },
          { header: 'Task Type', field: 'taskType', width: 16 },
          { header: 'Basis', field: 'maintenanceBasis', width: 14 },
          { header: 'Frequency', field: 'frequency', width: 14 },
          { header: 'Next Due', field: 'nextDueDate', width: 16 },
          { header: 'Days', field: 'daysUntilDue', width: 10 },
          { header: 'Status', field: 'status', width: 14 },
          { header: 'Last Done', field: 'lastDoneDate', width: 16 },
          { header: 'Last WO', field: 'lastWONumber', width: 18 },
          { header: 'Assigned To', field: 'assignedTo', width: 16 }
        ];

        const scheduleItems = filteredScheduleData.scheduleItems || [];
        const tableData = scheduleItems.map((item: any, idx: number) => ({
          ...item,
          sno: String(idx + 1)
        }));

        const summary = filteredScheduleData.summary || {};
        const summaryItems = [
          { label: 'Total Items', value: summary.total ?? 0 },
          { label: 'On Schedule', value: summary.onSchedule ?? 0 },
          { label: 'Due Soon', value: summary.dueSoon ?? 0 },
          { label: 'Overdue', value: summary.overdue ?? 0 }
        ];

        const finalData = tableData.length > 0 ? tableData : [{ sno: '-', componentCode: '-', componentName: 'No schedule items found', location: '-', jobCode: '-', jobTitle: '-', taskType: '-', maintenanceBasis: '-', frequency: '-', nextDueDate: '-', daysUntilDue: '-', status: '-', lastDoneDate: '-', lastWONumber: '-', assignedTo: '-' }];

        if (mode === 'preview') {
          setPreviewData({
            title: 'Critical Equipment Maintenance Schedule & Status',
            subtitle: `Maintenance tracking for critical components - ${scheduleItems.length} items`,
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
            title: 'Critical Equipment Maintenance Schedule & Status',
            subtitle: `Maintenance tracking for critical components - ${scheduleItems.length} items`,
            vessel: vesselName,
            orientation: 'landscape',
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          finalData
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
      await generateCriticalReport(reportId, 'preview');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast({ title: "Preview Failed", description: error.message || "Failed to load report preview.", variant: "destructive" });
    }
  };

  const handleExcelExport = async (reportId: string) => {
    const params = new URLSearchParams();
    params.set('vesselId', effectiveVesselId || 'all');
    params.set('format', 'excel');
    if (globalVessels.length > 0) params.set('vesselIds', globalVessels.join(','));
    if (globalComponent) params.set('componentSearch', globalComponent);

    if (reportId === 'critical-components-list') {
      if (classItemFilter !== 'all') params.set('classItem', classItemFilter);
    } else {
      if (statusFilter !== 'all') params.set('status', statusFilter);
    }

    const endpoint = reportId === 'critical-components-list'
      ? '/technical/api/reports/critical-components-list'
      : '/technical/api/reports/critical-equipment-schedule';

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

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel') => {
    const reportKey = `${reportId}-${format}`;

    if (generatingReports.has(reportKey)) return;

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateCriticalReport(reportId, 'download');
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground" data-testid="text-page-title">Critical Equipment</h1>
              <p className="text-sm text-gray-500 dark:text-muted-foreground">2 reports for safety-critical equipment</p>
            </div>
          </div>

          <CategoryFilters
            filters={categoryFilters}
            onFiltersChange={setCategoryFilters}
            searchPlaceholder="Search critical equipment reports..."
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
                    <SelectItem value="on-schedule">On Schedule</SelectItem>
                    <SelectItem value="due-soon">Due Soon</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-muted-foreground">Class Item:</span>
                <Select value={classItemFilter} onValueChange={setClassItemFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-class-filter">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="class">Class Only</SelectItem>
                    <SelectItem value="non-class">Non-Class</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Shield className="w-4 h-4 text-blue-500" />
                  Total Critical Components
                </CardDescription>
                <CardTitle className="text-3xl text-blue-600" data-testid="text-total-components">
                  {isLoading ? '...' : (filteredComponentsData?.components?.length ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Overdue Maintenance
                </CardDescription>
                <CardTitle className="text-3xl text-red-600" data-testid="text-overdue-count">
                  {isLoading ? '...' : (filteredScheduleData?.summary?.overdue ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  Due Soon
                </CardDescription>
                <CardTitle className="text-3xl text-yellow-600" data-testid="text-due-soon-count">
                  {isLoading ? '...' : (filteredScheduleData?.summary?.dueSoon ?? 0)}
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
                  {isLoading ? '...' : (filteredScheduleData?.summary?.onSchedule ?? 0)}
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
                    data-testid={`critical-report-row-${report.id}`}
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
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-foreground mb-2">No reports found</h3>
              <p className="text-gray-500 dark:text-muted-foreground">Try adjusting your search criteria</p>
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
          open={!!previewData}
          onClose={() => setPreviewData(null)}
          reportData={previewData}
        />
      )}
    </div>
  );
};

export default CriticalEquipmentReports;
