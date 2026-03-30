import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  FileText,
  AlertCircle,
  CheckCircle,
  Package,
  Eye,
  Loader2,
  Download,
  Calendar as CalendarIcon
} from 'lucide-react';
import { format } from "date-fns";
import { pdfReportGenerator, formatReportDateRange } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";
import IhmInventoryStatusReport from "./IhmInventoryStatusReport";

interface IhmReport {
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

interface IhmReportsProps {
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

const IhmReports: React.FC<IhmReportsProps> = ({ onBack, globalFilters, embedded, selectedReportId, actionTrigger }) => {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValues>({
    searchQuery: "",
    vessel: globalFilters?.vessel || "all",
    dateRange: globalFilters?.dateRange || { from: null, to: null }
  });
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [viewingReport, setViewingReport] = useState<string | null>(null);
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
      setViewingReport(selectedReportId);
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

  const { data: ihmData } = useQuery<any>({
    queryKey: ['/technical/api/reports/ihm-inventory-status', effectiveVesselId, 'summary'],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', pageSize: '1' });
      if (effectiveVesselId && effectiveVesselId !== 'all') {
        params.set('vesselId', effectiveVesselId);
      }
      const res = await fetch(`/technical/api/reports/ihm-inventory-status?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch IHM summary');
      return res.json();
    },
  });

  const ihmSummary = ihmData?.summary || { totalItems: 0, ihmPresent: 0, noIhm: 0, unknown: 0 };

  const reports: IhmReport[] = [
    {
      id: "ihm-inventory-status",
      name: "IHM Inventory Status Report",
      description: "Complete inventory of hazardous materials with presence status and evidence documentation",
      purpose: "EU Ship Recycling Regulation compliance (All stakeholders)",
      frequency: "Quarterly",
      fields: ["Component", "Material", "IHM Status", "Evidence Type", "Location", "Quantity"],
      outputs: ["PDF", "Excel"],
      icon: Package,
      priority: "high",
      estimatedTime: "3-5 min"
    }
  ];

  const filteredReports = reports.filter(report => {
    if (embedded && selectedReportId) return report.id === selectedReportId;
    return report.name.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase()) ||
           report.description.toLowerCase().includes(categoryFilters.searchQuery.toLowerCase());
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const generateIhmPDF = async (reportId: string) => {
    const vesselName = effectiveVesselId === 'all' ? 'All Vessels' : (vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'Unknown Vessel');

    switch (reportId) {
      case 'ihm-inventory-status': {
        const res = await fetch(`/technical/api/reports/ihm-inventory-status?vesselId=${effectiveVesselId}&page=1&pageSize=10000&sortBy=itemCode&sortOrder=asc`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch data for PDF');
        const allData = await res.json();

        if (allData.items.length === 0) {
          toast({ title: "No Data", description: "No items to export.", variant: "destructive" });
          return;
        }

        const columns = [
          { header: 'S.No', field: 'sno', width: 12 },
          { header: 'Item Code', field: 'itemCode', width: 25 },
          { header: 'Item Name', field: 'itemName', width: 45 },
          { header: 'Item Type', field: 'itemType', width: 20 },
          { header: 'Component / Category', field: 'componentOrCategory', width: 35 },
          { header: 'IHM Status', field: 'ihmStatus', width: 22 },
          { header: 'Evidence Type', field: 'evidenceType', width: 25 },
          { header: 'Current ROB', field: 'currentROB', width: 20 },
          { header: 'Location', field: 'location', width: 25 },
          { header: 'UOM', field: 'uom', width: 15 },
        ];

        const data = allData.items.map((item: any, idx: number) => ({
          sno: idx + 1,
          itemCode: item.itemCode || '-',
          itemName: item.itemName || '-',
          itemType: item.itemType === 'spare' ? 'Spare' : (item.storeCategory || 'Store'),
          componentOrCategory: item.componentOrCategory || '-',
          ihmStatus: item.ihmStatus === 'present' ? 'Present' : item.ihmStatus === 'not_present' ? 'Not Present' : 'Unknown',
          evidenceType: item.evidenceType || '-',
          currentROB: item.currentROB ?? '-',
          location: item.location || '-',
          uom: item.uom || '-',
        }));

        const summary = [
          { label: 'Total Items', value: allData.summary.totalItems },
          { label: 'IHM Present', value: allData.summary.ihmPresent },
          { label: 'No IHM', value: allData.summary.noIhm },
          { label: 'Unknown', value: allData.summary.unknown }
        ];

        pdfReportGenerator.generateReport(
          { title: 'IHM Inventory Status Report', subtitle: 'Confirmed hazardous materials present on board', vessel: vesselName, dateRange: formatReportDateRange(categoryFilters.dateRange?.from, categoryFilters.dateRange?.to) },
          columns,
          data,
          summary
        );
        break;
      }

      default:
        toast({ title: "Report Not Available", description: "This report is not yet implemented", variant: "destructive" });
    }
  };

  const generateIhmExcel = async (reportId: string) => {
    if (reportId !== 'ihm-inventory-status') {
      toast({ title: "Excel Export", description: "Excel export is not available for this report.", variant: "destructive" });
      return;
    }

    const res = await fetch('/technical/api/reports/ihm-inventory-status/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ vesselId: effectiveVesselId }),
    });
    if (!res.ok) throw new Error('Failed to generate Excel');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ihm-inventory-status-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel') => {
    const reportKey = `${reportId}-${format}`;
    
    if (generatingReports.has(reportKey)) return;

    if (!effectiveVesselId || effectiveVesselId === 'all') {
      toast({ title: "Select a Vessel", description: "Please select a specific vessel to generate this report.", variant: "destructive" });
      return;
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateIhmPDF(reportId);
      } else {
        await generateIhmExcel(reportId);
      }
      toast({ title: "Report Generated", description: `${format} report downloaded successfully!` });
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

  const ihmPresent = ihmSummary.ihmPresent;
  const ihmNotPresent = ihmSummary.noIhm;
  const ihmUnknown = ihmSummary.unknown;

  useEffect(() => {
    if (embedded && selectedReportId) {
      setViewingReport(selectedReportId);
    }
  }, [embedded, selectedReportId]);

  if (viewingReport === 'ihm-inventory-status') {
    return (
      <IhmInventoryStatusReport
        onBack={() => setViewingReport(embedded ? selectedReportId : null)}
        vesselId={effectiveVesselId || undefined}
      />
    );
  }

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
              <h1 className="text-2xl font-bold text-gray-900">IHM (Inventory of Hazardous Materials)</h1>
              <p className="text-sm text-gray-500">1 report for hazardous materials tracking</p>
            </div>
          </div>

          <CategoryFilters
            filters={categoryFilters}
            onFiltersChange={setCategoryFilters}
            searchPlaceholder="Search IHM reports..."
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
            <Card className="border-l-4 border-l-gray-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Package className="w-4 h-4 text-gray-500" />
                  Total Items
                </CardDescription>
                <CardTitle className="text-3xl">{ihmSummary.totalItems}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-red-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  IHM Present
                </CardDescription>
                <CardTitle className="text-3xl text-red-600">{ihmPresent}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-green-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  No IHM
                </CardDescription>
                <CardTitle className="text-3xl text-green-600">{ihmNotPresent}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-yellow-500 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <FileText className="w-4 h-4 text-yellow-500" />
                  Unknown
                </CardDescription>
                <CardTitle className="text-3xl text-yellow-600">{ihmUnknown}</CardTitle>
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
                    data-testid={`ihm-report-row-${report.id}`}
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
                        {report.id === 'ihm-inventory-status' ? (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            title="View Interactive Report"
                            onClick={() => setViewingReport(report.id)}
                            data-testid={`button-preview-${report.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
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
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          title="Download PDF"
                          onClick={() => handleGenerateReport(report.id, 'PDF')}
                          disabled={generatingReports.has(`${report.id}-PDF`)}
                          data-testid={`button-pdf-${report.id}`}
                        >
                          {generatingReports.has(`${report.id}-PDF`) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
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
                            {generatingReports.has(`${report.id}-Excel`) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
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
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
              <p className="text-gray-500">Try adjusting your search criteria</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IhmReports;
