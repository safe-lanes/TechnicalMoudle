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
  Package,
  AlertTriangle,
  TrendingDown,
  FileText,
  Eye,
  Loader2,
  Download
} from "lucide-react";
import { pdfReportGenerator, formatDate } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";
import LowStockAlertReport from "./LowStockAlertReport";
import CriticalSparesReport from "./CriticalSparesReport";

interface SparesReport {
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

interface SparesReportsProps {
  onBack: () => void;
  globalFilters?: {
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
}

const SparesReports: React.FC<SparesReportsProps> = ({ onBack, globalFilters }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: globalFilters?.vessel || "all",
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [activeDetailReport, setActiveDetailReport] = useState<string | null>(null);
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

  const { data: spares = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/spares', effectiveVesselId],
    queryFn: async () => {
      if (effectiveVesselId && effectiveVesselId !== 'all') {
        const res = await fetch(`/technical/api/spares/${effectiveVesselId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch spares');
        return res.json();
      }
      const res = await fetch('/technical/api/spares', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch spares');
      return res.json();
    },
  });

  const { data: spareHistory = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/spares', effectiveVesselId, 'history'],
    enabled: !!effectiveVesselId && effectiveVesselId !== 'all',
  });

  const reports: SparesReport[] = [
    {
      id: "spares-low-stock",
      name: "Low Stock Alert Report",
      description: "Critical and low stock items requiring immediate attention and ordering",
      purpose: "Prevent stockouts & maintain availability (Chief Eng/Office)",
      frequency: "Daily/Weekly",
      fields: ["Part Code/Name", "Current ROB", "Minimum Level", "Days Below Min", "Last Consumption", "Lead Time", "Supplier"],
      filters: ["Vessel", "Dept", "Stock Status", "Criticality", "Supplier"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: AlertTriangle,
      priority: "high",
      lastGenerated: "1 hour ago",
      estimatedTime: "< 1 min"
    },
    {
      id: "spares-consumption-analysis",
      name: "Consumption Pattern Analysis",
      description: "Historical consumption trends and forecasting for inventory optimization",
      purpose: "Optimize inventory levels & ordering (Office)",
      frequency: "Monthly",
      fields: ["Part", "Avg Monthly Consumption", "Trend", "Seasonal Patterns", "Usage Variance", "Forecast Next 3M"],
      filters: ["Vessel", "Dept", "Time Period", "Part Category", "High Movers"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: TrendingDown,
      priority: "medium",
      lastGenerated: "2 days ago",
      estimatedTime: "3-5 min"
    },
    {
      id: "spares-critical-parts",
      name: "Critical Spares Report",
      description: "Status of critical and essential spare parts inventory",
      purpose: "Ensure critical equipment supportability (Office/Vessel)",
      frequency: "Weekly",
      fields: ["Part Code", "Part Name", "Equipment", "Criticality", "ROB", "Min Required", "Status"],
      filters: ["Vessel", "Criticality Level", "Stock Status"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: AlertTriangle,
      priority: "high",
      lastGenerated: "4 hours ago",
      estimatedTime: "< 1 min"
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

  const getStockStatus = (rob: number, min: number): string => {
    if (rob < min) return 'Low';
    if (rob === min) return 'At Min';
    return 'OK';
  };

  const generateSparesPDF = async (reportId: string) => {
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');

    switch (reportId) {
      case 'spares-low-stock': {
        const res = await fetch(`/technical/api/reports/low-stock-alert/${effectiveVesselId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch low stock alert data');
        const apiData = await res.json();

        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Part Code', field: 'partCode', width: 30 },
          { header: 'Part Name', field: 'partName', width: 50 },
          { header: 'Component', field: 'componentName', width: 45 },
          { header: 'Current Qty', field: 'currentQty', width: 20 },
          { header: 'Min Qty', field: 'minQty', width: 18 },
          { header: 'Shortage', field: 'shortage', width: 20 },
          { header: 'Status', field: 'status', width: 25 },
        ];

        const data = (apiData.items || []).map((i: any, idx: number) => ({
          sno: idx + 1,
          partCode: i.partCode,
          partName: i.partName,
          componentName: i.componentName,
          currentQty: i.currentQty,
          minQty: i.minQty,
          shortage: i.shortage,
          status: i.status,
        }));

        const summary = [
          { label: 'Total Low Stock Items', value: apiData.summary?.totalLowStock || data.length },
          { label: 'Critical', value: apiData.summary?.criticalCount || 0 },
          { label: 'At Minimum', value: apiData.summary?.atMinCount || 0 },
        ];

        pdfReportGenerator.generateReport(
          { title: 'Low Stock Alert Report', subtitle: 'Items requiring immediate attention', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }


      case 'spares-critical-parts': {
        const previewRes = await fetch(`/technical/api/reports/critical-spares/preview?vesselId=${effectiveVesselId}`, { credentials: 'include' });
        if (!previewRes.ok) throw new Error('Failed to fetch critical spares data');
        const previewData = await previewRes.json();

        const columns = [
          { header: 'S.No', field: 'sNo', width: 10 },
          { header: 'Part Code', field: 'partCode', width: 28 },
          { header: 'Part Name', field: 'partName', width: 45 },
          { header: 'ROB', field: 'rob', width: 12 },
          { header: 'Min Stock', field: 'minStock', width: 15 },
          { header: 'Status', field: 'stockStatus', width: 18 },
          { header: 'Shortage', field: 'shortageQty', width: 15 },
          { header: 'Criticality', field: 'criticalityLevel', width: 18 },
          { header: 'Critical Equip', field: 'criticalEquip', width: 20 },
          { header: 'Remarks', field: 'remarks', width: 45 },
        ];

        const data = (previewData.data || []).map((i: any, idx: number) => ({
          sNo: idx + 1,
          partCode: i.partCode,
          partName: i.partName,
          rob: i.rob,
          minStock: i.minStock ?? '-',
          stockStatus: i.stockStatus,
          shortageQty: i.shortageQty,
          criticalityLevel: i.criticalityLevel,
          criticalEquip: i.linkedToCriticalEquipment ? 'YES' : 'NO',
          remarks: i.remarks,
        }));

        const summary = [
          { label: 'Total Spares', value: previewData.reportMeta?.totalSpares || data.length },
          { label: 'Critical Equipment Spares', value: previewData.summary?.byCriticality?.CRITICAL || 0 },
          { label: 'Out of Stock', value: previewData.summary?.byStatus?.ZERO || 0 },
          { label: 'Low Stock', value: previewData.summary?.byStatus?.LOW || 0 },
          { label: 'Total Shortage', value: `${previewData.summary?.totalShortage || 0} units` },
        ];

        pdfReportGenerator.generateReport(
          { title: 'Critical Spares Report', subtitle: 'Status of Critical and Essential Spare Parts Inventory', vessel: vesselName, orientation: 'landscape' },
          columns,
          data,
          summary
        );
        break;
      }

      case 'spares-consumption-analysis': {
        const apiRes = await fetch(`/technical/api/reports/consumption-analysis/${effectiveVesselId}`, { credentials: 'include' });
        if (!apiRes.ok) throw new Error('Failed to fetch consumption analysis data');
        const apiData = await apiRes.json();

        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const formatDateDD = (iso: string) => {
          const d = new Date(iso);
          const day = String(d.getUTCDate()).padStart(2, '0');
          const mon = months[d.getUTCMonth()];
          const yr = d.getUTCFullYear();
          return `${day}-${mon}-${yr}`;
        };

        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Part Code', field: 'partCode', width: 28 },
          { header: 'Part Name', field: 'partName', width: 45 },
          { header: 'Component', field: 'componentName', width: 40 },
          { header: 'Total Consumed', field: 'totalConsumed', width: 25 },
          { header: 'Consumption Events', field: 'consumptionEvents', width: 28 },
          { header: 'Current ROB', field: 'currentRob', width: 22 },
          { header: 'Min Stock', field: 'minStock', width: 18 },
          { header: 'Status', field: 'status', width: 18 },
          { header: 'Last Consumed', field: 'lastConsumed', width: 25 },
        ];

        const data = (apiData.items || []).map((i: any, idx: number) => ({
          sno: idx + 1,
          partCode: i.partCode,
          partName: i.partName,
          componentName: i.componentName,
          totalConsumed: i.totalConsumed,
          consumptionEvents: i.consumptionEvents,
          currentRob: i.currentRob,
          minStock: i.minStock,
          status: i.status,
          lastConsumed: formatDateDD(i.lastConsumed),
        }));

        const summary = [
          { label: 'Total Items', value: apiData.summary?.totalItems || data.length },
          { label: 'Total Consumed', value: apiData.summary?.totalConsumed || 0 },
          { label: 'Total Events', value: apiData.summary?.totalEvents || 0 },
          { label: 'Critical Items', value: apiData.summary?.criticalItems || 0 },
        ];

        pdfReportGenerator.generateReport(
          { title: 'Consumption Pattern Analysis', subtitle: 'Spare parts consumption patterns and trends', vessel: vesselName, orientation: 'landscape' },
          columns,
          data,
          summary
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

    if (spares.length === 0) {
      toast({
        title: "No Data Available",
        description: "No spares inventory data found for the selected vessel.",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      
      toast({
        title: "Generating Report",
        description: `Creating ${format} report...`,
      });

      if (format === 'PDF') {
        await generateSparesPDF(reportId);
        toast({
          title: "Report Generated",
          description: `${format} report downloaded successfully!`,
        });
      } else if (format === 'Excel' && reportId === 'spares-low-stock') {
        const body: Record<string, string> = {};
        const response = await fetch(`/technical/api/reports/low-stock-alert/${effectiveVesselId}/excel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('Failed to generate Excel');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `low-stock-alert-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: "Report Generated", description: "Excel report downloaded successfully!" });
      } else if (format === 'Excel' && reportId === 'spares-critical-parts') {
        const filters: Record<string, any> = {};
        const response = await fetch('/technical/api/reports/critical-spares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ vesselId: effectiveVesselId, filters }),
        });
        if (!response.ok) throw new Error('Failed to generate Excel');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `critical-spares-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: "Report Generated", description: "Excel report downloaded successfully!" });
      } else if (format === 'Excel' && reportId === 'spares-consumption-analysis') {
        const response = await fetch(`/technical/api/reports/consumption-analysis/${effectiveVesselId}/excel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });
        if (!response.ok) throw new Error('Failed to generate Excel');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `consumption-analysis-${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: "Report Generated", description: "Excel report downloaded successfully!" });
      } else {
        toast({
          title: "Excel Export",
          description: "Excel export coming soon. PDF is currently available.",
        });
      }
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Generation Failed",
        description: `Failed to generate report. Please try again.`,
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

  const lowStockCount = spares.filter((s: any) => (s.rob || 0) < (s.min || 0)).length;
  const highPriorityCount = reports.filter(r => r.priority === 'high').length;

  if (activeDetailReport === 'spares-low-stock') {
    return (
      <LowStockAlertReport
        onBack={() => setActiveDetailReport(null)}
        vesselId={effectiveVesselId}
      />
    );
  }

  if (activeDetailReport === 'spares-critical-parts') {
    return (
      <CriticalSparesReport
        onBack={() => setActiveDetailReport(null)}
        vesselId={effectiveVesselId}
      />
    );
  }

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
            <h1 className="text-2xl font-bold text-gray-900">Inventory - Spares</h1>
            <p className="text-sm text-gray-500">3 reports for spare parts inventory management</p>
          </div>
        </div>

        <CategoryFilters
          filters={categoryFilters}
          onFiltersChange={setCategoryFilters}
          searchPlaceholder="Search spares reports..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-orange-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Package className="w-4 h-4 text-orange-500" />
              Total Spares
            </CardDescription>
            <CardTitle className="text-3xl">{spares.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-red-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Low Stock
            </CardDescription>
            <CardTitle className="text-3xl text-red-600">{lowStockCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <FileText className="w-4 h-4 text-blue-500" />
              Reports Available
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">{reports.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-purple-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-purple-500" />
              High Priority
            </CardDescription>
            <CardTitle className="text-3xl text-purple-600">{highPriorityCount}</CardTitle>
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
                data-testid={`spares-report-row-${report.id}`}
                onClick={() => {
                  if (report.id === 'spares-low-stock' || report.id === 'spares-critical-parts') {
                    setActiveDetailReport(report.id);
                  }
                }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        if (report.id === 'spares-low-stock' || report.id === 'spares-critical-parts') {
                          setActiveDetailReport(report.id);
                        } else {
                          handleGenerateReport(report.id, 'PDF');
                        }
                      }}
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
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default SparesReports;
