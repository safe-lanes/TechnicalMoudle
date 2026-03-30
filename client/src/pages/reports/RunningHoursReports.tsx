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
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
  embedded?: boolean;
  selectedReportId?: string | null;
}

const RunningHoursReports: React.FC<RunningHoursReportsProps> = ({ onBack, globalFilters, embedded, selectedReportId }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: globalFilters?.vessel || "all",
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
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
    enabled: !!effectiveVesselId && effectiveVesselId !== 'all',
  });

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

  const generateRunningHoursReport = async (reportId: string, mode: 'preview' | 'download' = 'download') => {
    if (!effectiveVesselId || effectiveVesselId === 'all') {
      throw new Error('Please select a specific vessel to generate the report. "All Vessels" is not supported for exports.');
    }
    
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');

    switch (reportId) {
      case 'rh-utilization-summary': {
        const params = new URLSearchParams({ vesselId: effectiveVesselId });
        if (categoryFilters.dateRange?.from) {
          params.append('startDate', categoryFilters.dateRange.from.toISOString().split('T')[0]);
        }
        if (categoryFilters.dateRange?.to) {
          params.append('endDate', categoryFilters.dateRange.to.toISOString().split('T')[0]);
        }
        
        const response = await fetch(`/technical/api/reports/equipment-utilization-summary?${params}`);
        const result = await response.json();
        
        if (!response.ok || result.error) {
          throw new Error(result.error || `Failed to fetch data (status ${response.status})`);
        }
        
        if (!result.success || !result.data) {
          throw new Error('No equipment utilization data returned. Please ensure the vessel has components with running hours.');
        }
        
        const utilizationData = result.data;
        const summary = result.summary;
        
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
          { label: 'Total Equipment', value: summary.totalEquipment },
          { label: 'High Utilization', value: summary.highUtilization },
          { label: 'Normal Utilization', value: summary.normalUtilization },
          { label: 'Low Utilization', value: summary.lowUtilization },
          { label: 'Avg Utilization', value: `${summary.avgUtilization}%` },
          { label: 'Actual Data', value: summary.actualData || 0 },
          { label: 'Estimated', value: (summary.estimatedData || 0) + (summary.estimatedCapped || 0) },
          { label: 'No Data', value: summary.noData || 0 }
        ];
        
        if (mode === 'preview') {
          setPreviewData({
            title: 'Equipment Utilization Summary',
            subtitle: `Running hours analysis for ${summary.periodDays} days (${summary.periodStart} to ${summary.periodEnd})`,
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
            columns,
            data: utilizationData,
            summary: summaryItems
          });
          return;
        }

        pdfReportGenerator.generateReport(
          { 
            title: 'Equipment Utilization Summary', 
            subtitle: `Running hours analysis for ${summary.periodDays} days (${summary.periodStart} to ${summary.periodEnd})`, 
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          utilizationData,
          summaryItems
        );
        break;
      }

      case 'rh-anomaly-detection': {
        const params = new URLSearchParams({ vesselId: effectiveVesselId || '' });
        if (categoryFilters.dateRange?.from) {
          params.append('startDate', categoryFilters.dateRange.from.toISOString().split('T')[0]);
        }
        if (categoryFilters.dateRange?.to) {
          params.append('endDate', categoryFilters.dateRange.to.toISOString().split('T')[0]);
        }
        
        const response = await fetch(`/technical/api/reports/running-hours-anomaly-detection?${params}`);
        const result = await response.json();
        
        if (!response.ok || result.error) {
          throw new Error(result.error || `Failed to fetch data (status ${response.status})`);
        }
        
        if (!result.success) {
          throw new Error('Failed to fetch anomaly data');
        }
        
        const anomalies = result.data || [];
        const summaryData = result.summary || {};
        
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
        
        const summaryItems = [
          { label: 'Total Anomalies', value: summaryData.totalAnomalies || 0 },
          { label: 'Critical', value: summaryData.criticalCount || 0 },
          { label: 'Warning', value: summaryData.warningCount || 0 },
          { label: 'Info', value: summaryData.infoCount || 0 },
          { label: 'Logs Analyzed', value: summaryData.totalLogsAnalyzed || 0 },
          { label: 'Components', value: summaryData.componentsAnalyzed || 0 }
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
          setPreviewData({
            title: 'Running Hours Anomaly Detection',
            subtitle: `Period: ${summaryData.periodStart || 'N/A'} to ${summaryData.periodEnd || 'N/A'}`,
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to),
            columns,
            data: formattedData,
            summary: summaryItems
          });
          return;
        }

        pdfReportGenerator.generateReport(
          { 
            title: 'Running Hours Anomaly Detection', 
            subtitle: `Period: ${summaryData.periodStart || 'N/A'} to ${summaryData.periodEnd || 'N/A'}`, 
            vessel: vesselName,
            dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to)
          },
          columns,
          formattedData,
          summaryItems
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
    const isAllVessels = !effectiveVesselId || 
                         effectiveVesselId === 'all' || 
                         effectiveVesselId === 'all-vessels' ||
                         effectiveVesselId.toLowerCase().includes('all');
    
    if (isAllVessels) {
      toast({ 
        title: "Vessel Required", 
        description: "Please select a specific vessel from the dropdown to preview this report.",
        variant: "destructive" 
      });
      return;
    }

    try {
      toast({ title: "Loading Preview", description: "Fetching report data..." });
      await generateRunningHoursReport(reportId, 'preview');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast({ title: "Preview Failed", description: error.message || "Failed to load report preview.", variant: "destructive" });
    }
  };

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel') => {
    const reportKey = `${reportId}-${format}`;
    
    if (generatingReports.has(reportKey)) return;

    // Require vessel selection for these reports
    // Check for various "all vessels" representations
    const isAllVessels = !effectiveVesselId || 
                         effectiveVesselId === 'all' || 
                         effectiveVesselId === 'all-vessels' ||
                         effectiveVesselId.toLowerCase().includes('all');
    
    if (isAllVessels) {
      toast({ 
        title: "Vessel Required", 
        description: "Please select a specific vessel from the dropdown to generate this report.",
        variant: "destructive" 
      });
      return;
    }

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
    // Check if a vessel is selected
    if (!effectiveVesselId || effectiveVesselId === 'all') {
      throw new Error('Please select a specific vessel to generate the Excel report. "All Vessels" is not supported for exports.');
    }
    
    const reportEndpoints: Record<string, string> = {
      'rh-utilization-summary': '/technical/api/reports/equipment-utilization-summary/excel',
      'rh-anomaly-detection': '/technical/api/reports/running-hours-anomaly-detection/excel',
    };

    const endpoint = reportEndpoints[reportId];
    if (!endpoint) {
      toast({ title: "Excel Export", description: "Excel export for this report is coming soon." });
      return;
    }

    let requestBody: any = { vesselId: effectiveVesselId };
    
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

  const componentsWithRH = components.filter((c: any) => c.runningHours !== undefined && c.runningHours !== null);
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
            <CardTitle className="text-3xl text-blue-600">{components.length}</CardTitle>
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

      {embedded && previewData && (
        <div className="mt-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{previewData.title} - Preview</h3>
            <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)}>
              Close Preview
            </Button>
          </div>
          <div className="bg-white rounded border p-4 max-h-96 overflow-y-auto">
            {previewData.sections?.map((section: any, idx: number) => (
              <div key={idx} className="mb-4">
                {section.title && <h4 className="font-medium text-gray-800 mb-2">{section.title}</h4>}
                {section.type === 'table' && section.data && (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        {section.columns?.map((col: string, i: number) => (
                          <th key={i} className="text-left py-1.5 px-2 border text-xs font-medium">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.data.slice(0, 20).map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {section.columns?.map((col: string, j: number) => (
                            <td key={j} className="py-1 px-2 border text-xs">{row[col] ?? '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {section.type === 'summary' && section.items && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {section.items.map((item: any, i: number) => (
                      <div key={i} className="bg-gray-50 p-2 rounded text-center">
                        <div className="text-lg font-bold">{item.value}</div>
                        <div className="text-xs text-gray-500">{item.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(!previewData.sections || previewData.sections.length === 0) && (
              <p className="text-sm text-gray-500">Preview data is being generated...</p>
            )}
          </div>
        </div>
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
