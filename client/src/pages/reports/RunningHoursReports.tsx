import { useState } from "react";
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
  Download
} from "lucide-react";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
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
}

const RunningHoursReports: React.FC<RunningHoursReportsProps> = ({ onBack, globalFilters }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: globalFilters?.vessel || "all",
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId: contextVesselId } = useVessel();

  const effectiveVesselId = (categoryFilters.vessel && categoryFilters.vessel !== 'all') 
    ? categoryFilters.vessel 
    : contextVesselId;

  const { data: components = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/components', effectiveVesselId],
    enabled: !!effectiveVesselId && effectiveVesselId !== 'all',
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
    {
      id: "rh-maintenance-triggers",
      name: "RH-Based Maintenance Triggers",
      description: "Equipment approaching running hours-based maintenance thresholds",
      purpose: "Plan RH-based maintenance (Chief Eng)",
      frequency: "Daily/Weekly",
      fields: ["Component", "Current RH", "Next Due RH", "Remaining", "Job"],
      outputs: ["PDF", "Dashboard"],
      icon: Gauge,
      priority: "high",
      estimatedTime: "1-2 min"
    },
    {
      id: "rh-condition-monitoring",
      name: "Condition Monitoring Trends",
      description: "Track equipment condition indicators over time",
      purpose: "Predictive maintenance planning (Office)",
      frequency: "Monthly",
      fields: ["Component", "Condition Score", "Trend", "Last Reading", "Notes"],
      outputs: ["PDF", "Excel"],
      icon: Activity,
      priority: "medium",
      estimatedTime: "3-5 min"
    }
  ];

  const filteredReports = reports.filter(report => {
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

  const generateRunningHoursPDF = async (reportId: string) => {
    // Check if a vessel is selected
    if (!effectiveVesselId || effectiveVesselId === 'all') {
      throw new Error('Please select a specific vessel to generate the PDF report. "All Vessels" is not supported for PDF exports.');
    }
    
    const vesselName = vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel';

    switch (reportId) {
      case 'rh-utilization-summary': {
        // Fetch from API
        const params = new URLSearchParams({ vesselId: effectiveVesselId });
        if (categoryFilters.dateRange?.from) {
          params.append('startDate', categoryFilters.dateRange.from.toISOString().split('T')[0]);
        }
        if (categoryFilters.dateRange?.to) {
          params.append('endDate', categoryFilters.dateRange.to.toISOString().split('T')[0]);
        }
        
        console.log('[PDF] Fetching equipment utilization data for vessel:', effectiveVesselId);
        const response = await fetch(`/technical/api/reports/equipment-utilization-summary?${params}`);
        const result = await response.json();
        
        if (!response.ok || result.error) {
          console.error('[PDF] API error:', result.error);
          throw new Error(result.error || `Failed to fetch data (status ${response.status})`);
        }
        
        if (!result.success || !result.data) {
          console.error('[PDF] No data in response:', result);
          throw new Error('No equipment utilization data returned. Please ensure the vessel has components with running hours.');
        }
        
        const utilizationData = result.data;
        const summary = result.summary;
        console.log('[PDF] Generating PDF with', utilizationData.length, 'equipment items');
        
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
        
        try {
          pdfReportGenerator.generateReport(
            { 
              title: 'Equipment Utilization Summary', 
              subtitle: `Running hours analysis for ${summary.periodDays} days (${summary.periodStart} to ${summary.periodEnd})`, 
              vessel: vesselName 
            },
            columns,
            utilizationData,
            summaryItems
          );
          console.log('[PDF] PDF generated successfully');
        } catch (pdfError) {
          console.error('[PDF] Error generating PDF:', pdfError);
          throw pdfError;
        }
        break;
      }

      case 'rh-anomaly-detection': {
        // Fetch from API
        const params = new URLSearchParams({ vesselId: effectiveVesselId || '' });
        if (categoryFilters.dateRange?.from) {
          params.append('startDate', categoryFilters.dateRange.from.toISOString().split('T')[0]);
        }
        if (categoryFilters.dateRange?.to) {
          params.append('endDate', categoryFilters.dateRange.to.toISOString().split('T')[0]);
        }
        
        console.log('[PDF] Fetching anomaly detection data for vessel:', effectiveVesselId);
        const response = await fetch(`/technical/api/reports/running-hours-anomaly-detection?${params}`);
        const result = await response.json();
        
        if (!response.ok || result.error) {
          console.error('[PDF] API error:', result.error);
          throw new Error(result.error || `Failed to fetch data (status ${response.status})`);
        }
        
        const anomalies = result.anomalies || [];
        const summaryData = result.summary || {};
        
        const columns = [
          { header: 'Component Code', field: 'componentCode', width: 35 },
          { header: 'Component Name', field: 'componentName', width: 55 },
          { header: 'Category', field: 'category', width: 35 },
          { header: 'Previous RH', field: 'previousRh', width: 28 },
          { header: 'New RH', field: 'newRh', width: 25 },
          { header: 'Delta', field: 'deltaRh', width: 22 },
          { header: 'Anomaly Type', field: 'anomalyType', width: 35 },
          { header: 'Severity', field: 'severity', width: 25 },
          { header: 'Description', field: 'description', width: 70 }
        ];
        
        const summaryItems = [
          { label: 'Total Anomalies', value: summaryData.totalAnomalies || 0 },
          { label: 'Critical', value: summaryData.criticalCount || 0 },
          { label: 'Warning', value: summaryData.warningCount || 0 },
          { label: 'Info', value: summaryData.infoCount || 0 },
          { label: 'Logs Analyzed', value: summaryData.totalLogsAnalyzed || 0 }
        ];
        
        const formattedData = anomalies.map((a: any) => ({
          ...a,
          previousRh: Number(a.previousRh).toFixed(1),
          newRh: Number(a.newRh).toFixed(1),
          deltaRh: Number(a.deltaRh).toFixed(1)
        }));
        
        console.log('[PDF] Generating anomaly detection PDF with', formattedData.length, 'anomalies');
        
        try {
          pdfReportGenerator.generateReport(
            { 
              title: 'Running Hours Anomaly Detection', 
              subtitle: `Anomalies detected from ${summaryData.periodStart?.split('T')[0] || 'N/A'} to ${summaryData.periodEnd?.split('T')[0] || 'N/A'}`, 
              vessel: vesselName 
            },
            columns,
            formattedData,
            summaryItems
          );
          console.log('[PDF] Anomaly detection PDF generated successfully');
        } catch (pdfError) {
          console.error('[PDF] Error generating anomaly PDF:', pdfError);
          throw pdfError;
        }
        break;
      }

      case 'rh-maintenance-triggers': {
        // Use local component data for this report (API not yet implemented)
        const rhComponents = components.filter((c: any) => 
          c.runningHours !== undefined && c.runningHours !== null
        );
        
        const columns = [
          { header: 'Code', field: 'code', width: 30 },
          { header: 'Component', field: 'name', width: 55 },
          { header: 'Current RH', field: 'runningHours', width: 30 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const data = rhComponents.map((c: any) => ({
          code: c.componentCode || c.code || '-',
          name: c.name || '-',
          runningHours: c.runningHours || 0,
          status: 'OK'
        }));

        const summary = [
          { label: 'Components with RH', value: data.length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'RH-Based Maintenance Triggers', subtitle: 'Equipment approaching maintenance', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'rh-condition-monitoring': {
        // Use local component data for this report (API not yet implemented)
        const rhComponents = components.filter((c: any) => 
          c.runningHours !== undefined && c.runningHours !== null
        );
        
        const columns = [
          { header: 'Code', field: 'code', width: 30 },
          { header: 'Component', field: 'name', width: 60 },
          { header: 'Running Hours', field: 'runningHours', width: 35 },
          { header: 'Condition', field: 'condition', width: 30 }
        ];

        const data = rhComponents.map((c: any) => ({
          code: c.componentCode || c.code || '-',
          name: c.name || '-',
          runningHours: c.runningHours || 0,
          condition: 'Good'
        }));

        pdfReportGenerator.generateReport(
          { title: 'Condition Monitoring Trends', subtitle: 'Equipment condition report', vessel: vesselName },
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
        await generateRunningHoursPDF(reportId);
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
    <div className="p-6 bg-white min-h-screen">
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
            <p className="text-sm text-gray-500">4 reports for equipment monitoring</p>
          </div>
        </div>

        <CategoryFilters
          filters={categoryFilters}
          onFiltersChange={setCategoryFilters}
          searchPlaceholder="Search running hours reports..."
        />
      </div>

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
            <CardTitle className="text-3xl text-purple-600">4</CardTitle>
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
                      onClick={() => handleGenerateReport(report.id, 'PDF')}
                      disabled={generatingReports.has(`${report.id}-PDF`)}
                      data-testid={`button-preview-${report.id}`}
                    >
                      {generatingReports.has(`${report.id}-PDF`) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
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
    </div>
  );
};

export default RunningHoursReports;
