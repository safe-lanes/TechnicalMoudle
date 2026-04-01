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
  Clock,
  TrendingUp,
  Activity,
  AlertTriangle,
  Gauge,
  Eye,
  Loader2,
  FileText,
  Download,
  Calendar as CalendarIcon
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

interface RunningHoursReport {
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

interface RunningHoursReportsProps {
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

const RunningHoursReports: React.FC<RunningHoursReportsProps> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: (globalFilters?.vessels?.length === 1 ? globalFilters.vessels[0] : "all"),
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [globalVessels, setGlobalVessels] = useState<string[]>(globalFilters?.vessels || []);
  const [globalComponent, setGlobalComponent] = useState<string>(globalFilters?.component || "");
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
      generateRunningHoursReport(selectedReportId, 'preview').then((data) => {
        if (previewVersionRef.current === version) {
          if (data) setPreviewData(data);
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
      generateRunningHoursReport(selectedReportId, 'preview').then((data) => {
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

  const { data: components = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/components', effectiveVesselId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveVesselId && effectiveVesselId !== 'all') {
        params.set('vesselId', effectiveVesselId);
      }
      const url = `/technical/api/components${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch components');
      return res.json();
    },
  });

  const { data: runningHours = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/running-hours', effectiveVesselId],
    enabled: !!effectiveVesselId,
  });

  const filteredComponents = useMemo(() => {
    let result = components;
    if (globalVessels.length > 0 && globalVessels.length < vessels.length) {
      result = result.filter((c: any) => !c.vesselId || globalVessels.includes(c.vesselId));
    }
    if (globalComponent) {
      const q = globalComponent.toLowerCase();
      result = result.filter((c: any) => {
        const name = (c.name || c.componentName || "").toLowerCase();
        const code = (c.componentCode || c.code || "").toLowerCase();
        return name.includes(q) || code.includes(q);
      });
    }
    return result;
  }, [components, globalVessels, globalComponent, vessels.length]);

  const reports: RunningHoursReport[] = [
    {
      id: "rh-utilization-summary",
      name: "Equipment Utilization Summary",
      description: "Comprehensive utilization rates and performance metrics for all monitored equipment",
      purpose: "Monitor equipment usage efficiency (Chief Eng/Office)",
      frequency: "Weekly/Monthly",
      fields: ["Component", "Current RH", "Last Updated", "Status"],
      outputs: ["PDF", "Excel"],
      icon: TrendingUp,
      priority: "high",
      estimatedTime: "2-3 min"
    },
    {
      id: "rh-anomaly-detection",
      name: "Running Hours Anomaly Detection",
      description: "Identify equipment with unusual running patterns or potential meter issues",
      purpose: "Detect equipment issues early (Chief Eng/Office)",
      frequency: "Weekly",
      fields: ["Component", "Expected RH", "Actual RH", "Variance", "Flag"],
      outputs: ["PDF", "Excel"],
      icon: AlertTriangle,
      priority: "high",
      estimatedTime: "2-3 min"
    },
  ];

  const filteredReports = reports.filter(report => {
    if (embedded && selectedReportId) return report.id === selectedReportId;
    const matchesSearch = report.name.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase());
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

  const applyComponentFilter = (items: any[]) => {
    if (!globalComponent) return items;
    const q = globalComponent.toLowerCase();
    return items.filter((i: any) => {
      const name = (i.componentName || i.name || "").toLowerCase();
      const code = (i.componentCode || i.code || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  };

  const getVesselIdsForReport = (): string[] => {
    if (globalVessels.length > 0) return globalVessels;
    if (effectiveVesselId && effectiveVesselId !== 'all') return [effectiveVesselId];
    return vessels.map((v: any) => v.id).filter(Boolean);
  };

  const generateRunningHoursReport = async (reportId: string, mode: 'preview' | 'download' = 'download'): Promise<ReportPreviewData | void> => {
    const vesselIds = getVesselIdsForReport();
    const vesselName = vesselIds.length === 1 
      ? (vessels.find((v: any) => v.id === vesselIds[0])?.name || vesselIds[0]) 
      : `${vesselIds.length} Vessels`;

    switch (reportId) {
      case 'rh-utilization-summary': {
        let allUtilizationData: any[] = [];
        let mergedSummary: any = {};

        for (const vId of vesselIds) {
          const params = new URLSearchParams({ vesselId: vId });
          if (categoryFilters.dateRange?.from) {
            params.append('startDate', categoryFilters.dateRange.from.toISOString().split('T')[0]);
          }
          if (categoryFilters.dateRange?.to) {
            params.append('endDate', categoryFilters.dateRange.to.toISOString().split('T')[0]);
          }
          
          const response = await fetch(`/technical/api/reports/equipment-utilization-summary?${params}`);
          const result = await response.json();
          
          if (response.ok && result.success && result.data) {
            allUtilizationData = allUtilizationData.concat(result.data);
            if (!mergedSummary.periodDays) mergedSummary = { ...result.summary };
            else {
              mergedSummary.totalEquipment = (mergedSummary.totalEquipment || 0) + (result.summary?.totalEquipment || 0);
              mergedSummary.highUtilization = (mergedSummary.highUtilization || 0) + (result.summary?.highUtilization || 0);
              mergedSummary.normalUtilization = (mergedSummary.normalUtilization || 0) + (result.summary?.normalUtilization || 0);
              mergedSummary.lowUtilization = (mergedSummary.lowUtilization || 0) + (result.summary?.lowUtilization || 0);
            }
          }
        }

        if (allUtilizationData.length === 0) {
          throw new Error('No equipment utilization data returned. Please ensure the selected vessel(s) have components with running hours.');
        }

        const utilizationData = applyComponentFilter(allUtilizationData);
        
        const highUtil = utilizationData.filter((d: any) => d.utilizationBand === 'High').length;
        const normalUtil = utilizationData.filter((d: any) => d.utilizationBand === 'Normal').length;
        const lowUtil = utilizationData.filter((d: any) => d.utilizationBand === 'Low').length;
        const avgUtil = utilizationData.length > 0
          ? (utilizationData.reduce((s: number, d: any) => s + (Number(d.utilizationPercent) || 0), 0) / utilizationData.length).toFixed(1)
          : '0';
        const actualCount = utilizationData.filter((d: any) => d.dataSource === 'actual' || d.dataSource === 'Actual').length;
        const estimatedCount = utilizationData.filter((d: any) => d.dataSource === 'estimated' || d.dataSource === 'Estimated' || d.dataSource === 'estimated_capped').length;
        const noDataCount = utilizationData.filter((d: any) => d.dataSource === 'no_data' || d.dataSource === 'No Data' || !d.dataSource).length;

        const columns = [
          { header: 'S.No', field: 'sNo', width: 12 },
          { header: 'Code', field: 'componentCode', width: 30 },
          { header: 'Component Name', field: 'componentName', width: 55 },
          { header: 'Category', field: 'category', width: 35 },
          { header: 'Current Hrs', field: 'currentHours', width: 25 },
          { header: 'Period Hrs', field: 'periodHours', width: 25 },
          { header: 'Avg Daily', field: 'avgDailyHours', width: 22 },
          { header: 'Utilization', field: 'utilizationBand', width: 25 },
          { header: 'Util %', field: 'utilizationPercent', width: 20 },
          { header: 'Data Source', field: 'dataSource', width: 30 }
        ];
        
        const summaryItems = [
          { label: 'Total Equipment', value: utilizationData.length },
          { label: 'High Utilization', value: highUtil },
          { label: 'Normal Utilization', value: normalUtil },
          { label: 'Low Utilization', value: lowUtil },
          { label: 'Avg Utilization', value: `${avgUtil}%` },
          { label: 'Actual Data', value: actualCount },
          { label: 'Estimated', value: estimatedCount },
          { label: 'No Data', value: noDataCount }
        ];
        
        if (mode === 'preview') {
          return {
            title: 'Equipment Utilization Summary',
            subtitle: `Running hours analysis for ${summary.periodDays} days (${summary.periodStart} to ${summary.periodEnd})`,
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
            columns,
            data: utilizationData,
            summary: summaryItems
          };
        }

        pdfReportGenerator.generateReport(
          { 
            title: 'Equipment Utilization Summary', 
            subtitle: `Running hours analysis for ${summary.periodDays} days (${summary.periodStart} to ${summary.periodEnd})`, 
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          utilizationData
        );
        break;
      }

      case 'rh-anomaly-detection': {
        let allAnomalies: any[] = [];
        let mergedAnomalySummary: any = {};

        for (const vId of vesselIds) {
          const params = new URLSearchParams({ vesselId: vId });
          if (categoryFilters.dateRange?.from) {
            params.append('startDate', categoryFilters.dateRange.from.toISOString().split('T')[0]);
          }
          if (categoryFilters.dateRange?.to) {
            params.append('endDate', categoryFilters.dateRange.to.toISOString().split('T')[0]);
          }
          
          const response = await fetch(`/technical/api/reports/running-hours-anomaly-detection?${params}`);
          const result = await response.json();
          
          if (response.ok && result.success) {
            allAnomalies = allAnomalies.concat(result.data || []);
            if (!mergedAnomalySummary.periodStart) mergedAnomalySummary = { ...result.summary };
            else {
              mergedAnomalySummary.totalAnomalies = (mergedAnomalySummary.totalAnomalies || 0) + (result.summary?.totalAnomalies || 0);
              mergedAnomalySummary.criticalCount = (mergedAnomalySummary.criticalCount || 0) + (result.summary?.criticalCount || 0);
              mergedAnomalySummary.warningCount = (mergedAnomalySummary.warningCount || 0) + (result.summary?.warningCount || 0);
              mergedAnomalySummary.infoCount = (mergedAnomalySummary.infoCount || 0) + (result.summary?.infoCount || 0);
              mergedAnomalySummary.totalLogsAnalyzed = (mergedAnomalySummary.totalLogsAnalyzed || 0) + (result.summary?.totalLogsAnalyzed || 0);
              mergedAnomalySummary.componentsAnalyzed = (mergedAnomalySummary.componentsAnalyzed || 0) + (result.summary?.componentsAnalyzed || 0);
            }
          }
        }
        
        const anomalies = applyComponentFilter(allAnomalies);
        
        const columns = [
          { header: 'S.No', field: 'sNo', width: 12 },
          { header: 'Component Code', field: 'componentCode', width: 30 },
          { header: 'Component Name', field: 'componentName', width: 50 },
          { header: 'Prev RH', field: 'previousRh', width: 22 },
          { header: 'New RH', field: 'newRh', width: 22 },
          { header: 'Delta', field: 'delta', width: 20 },
          { header: 'Days Between', field: 'daysBetween', width: 25 },
          { header: 'Avg Daily', field: 'avgDailyHours', width: 22 },
          { header: 'Type', field: 'anomalyType', width: 30 },
          { header: 'Severity', field: 'severity', width: 22 },
          { header: 'Description', field: 'description', width: 60 }
        ];
        
        const uniqueComponents = new Set(anomalies.map((a: any) => a.componentCode || a.componentName)).size;
        const summaryItems = [
          { label: 'Total Anomalies', value: anomalies.length },
          { label: 'Critical', value: anomalies.filter((a: any) => a.severity === 'critical' || a.severity === 'Critical').length },
          { label: 'Warning', value: anomalies.filter((a: any) => a.severity === 'warning' || a.severity === 'Warning').length },
          { label: 'Info', value: anomalies.filter((a: any) => a.severity === 'info' || a.severity === 'Info').length },
          { label: 'Logs Analyzed', value: mergedAnomalySummary.totalLogsAnalyzed || 0 },
          { label: 'Components', value: uniqueComponents }
        ];
        
        const formattedData = anomalies.map((a: any) => ({
          sNo: a.sNo,
          componentCode: a.componentCode,
          componentName: a.componentName,
          previousRh: Number(a.previousRh).toFixed(1),
          newRh: Number(a.newRh).toFixed(1),
          delta: Number(a.delta).toFixed(1),
          daysBetween: Number(a.daysBetween).toFixed(1),
          avgDailyHours: Number(a.avgDailyHours).toFixed(2),
          anomalyType: a.anomalyType,
          severity: a.severity,
          description: a.description
        }));
        
        if (mode === 'preview') {
          return {
            title: 'Running Hours Anomaly Detection',
            subtitle: `Period: ${summaryData.periodStart || 'N/A'} to ${summaryData.periodEnd || 'N/A'}`,
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
            columns,
            data: formattedData,
            summary: summaryItems
          };
        }

        pdfReportGenerator.generateReport(
          { 
            title: 'Running Hours Anomaly Detection', 
            subtitle: `Period: ${summaryData.periodStart || 'N/A'} to ${summaryData.periodEnd || 'N/A'}`, 
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          formattedData
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

  const handlePreviewReport = async (reportId: string) => {
    try {
      toast({ title: "Loading Preview", description: "Fetching report data..." });
      const data = await generateRunningHoursReport(reportId, 'preview');
      if (data) {
        setPreviewData(data);
      }
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast({ title: "Preview Failed", description: error.message || "Failed to load report preview.", variant: "destructive" });
    }
  };

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel') => {
    const reportKey = `${reportId}-${format}`;
    
    if (generatingReports.has(reportKey)) return;

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateRunningHoursReport(reportId, 'download');
        toast({ title: "Report Generated", description: `${format} report downloaded successfully!` });
      } else if (format === 'Excel') {
        await generateRunningHoursExcel(reportId);
        toast({ title: "Report Generated", description: `${format} report downloaded successfully!` });
      }
      
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({ title: "Generation Failed", description: error.message || "Failed to generate report.", variant: "destructive" });
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportKey);
        return newSet;
      });
    }
  };

  const generateRunningHoursExcel = async (reportId: string) => {
    const vesselIds = getVesselIdsForReport();
    const excelVesselId = vesselIds.length === 1 ? vesselIds[0] : (effectiveVesselId || 'all');

    const reportEndpoints: Record<string, string> = {
      'rh-utilization-summary': '/technical/api/reports/equipment-utilization-summary/excel',
      'rh-anomaly-detection': '/technical/api/reports/running-hours-anomaly-detection/excel',
    };

    const endpoint = reportEndpoints[reportId];
    if (!endpoint) {
      toast({ title: "Excel Export", description: "Excel export for this report is coming soon." });
      return;
    }

    let requestBody: any = { vesselId: excelVesselId, vesselIds };
    
    // Add date range if available
    if (categoryFilters.dateRange?.from) {
      requestBody.startDate = categoryFilters.dateRange.from.toISOString().split('T')[0];
    }
    if (categoryFilters.dateRange?.to) {
      requestBody.endDate = categoryFilters.dateRange.to.toISOString().split('T')[0];
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate Excel report');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const contentDisposition = response.headers.get('content-disposition');
    const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || `${reportId}_report.xlsx`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const componentsWithRH = filteredComponents.filter((c: any) => c.runningHours !== undefined && c.runningHours !== null);
  const highPriorityCount = reports.filter(r => r.priority === 'high').length;

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
              <h1 className="text-2xl font-bold text-gray-900">Running Hours & Condition</h1>
              <p className="text-sm text-gray-500">2 reports for equipment monitoring</p>
            </div>
          </div>

          <CategoryFilters
            filters={categoryFilters}
            onFiltersChange={setCategoryFilters}
            searchPlaceholder="Search running hours reports..."
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-l-4 border-l-green-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Gauge className="w-4 h-4 text-green-500" />
                  Components with RH
                </CardDescription>
                <CardTitle className="text-3xl">{componentsWithRH.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-blue-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Activity className="w-4 h-4 text-blue-500" />
                  Total Components
                </CardDescription>
                <CardTitle className="text-3xl text-blue-600">{filteredComponents.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-purple-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-purple-500" />
                  Reports Available
                </CardDescription>
                <CardTitle className="text-3xl text-purple-600">2</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-red-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  High Priority
                </CardDescription>
                <CardTitle className="text-3xl text-red-600">{highPriorityCount}</CardTitle>
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
                    data-testid={`rh-report-row-${report.id}`}
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
                          data-testid={`button-preview-${report.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
          open={!!previewData}
          onClose={() => setPreviewData(null)}
          reportData={previewData}
        />
      )}
    </div>
  );
};

export default RunningHoursReports;
