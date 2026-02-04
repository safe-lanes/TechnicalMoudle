import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  FileText,
  AlertCircle,
  CheckCircle,
  Package,
  Shield,
  Eye,
  Loader2,
  Download
} from 'lucide-react';
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";

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
}

const IhmReports: React.FC<IhmReportsProps> = ({ onBack, globalFilters }) => {
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

  const { data: spares = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/spares', effectiveVesselId],
    enabled: !!effectiveVesselId && effectiveVesselId !== 'all',
  });

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
    },
    {
      id: "ihm-compliance-summary",
      name: "IHM Compliance Summary",
      description: "Overall IHM compliance status and documentation completeness",
      purpose: "Regulatory audit preparation (Office/Auditors)",
      frequency: "Monthly",
      fields: ["Category", "Known Status", "Unknown Status", "With IHM", "Without IHM", "Compliance %"],
      outputs: ["PDF", "Dashboard"],
      icon: Shield,
      priority: "high",
      estimatedTime: "2-3 min"
    }
  ];

  const filteredReports = reports.filter(report => {
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
    const vesselName = vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'All Vessels';

    const ihmSpares = spares.filter((s: any) => s.ihm && s.ihm !== 'Unknown');

    switch (reportId) {
      case 'ihm-inventory-status': {
        const columns = [
          { header: 'Part Code', field: 'partCode', width: 30 },
          { header: 'Part Name', field: 'partName', width: 55 },
          { header: 'Component', field: 'componentName', width: 45 },
          { header: 'IHM Status', field: 'ihmStatus', width: 30 },
          { header: 'Evidence', field: 'evidence', width: 30 }
        ];

        const data = spares.map((s: any) => ({
          partCode: s.partCode || '-',
          partName: s.partName || '-',
          componentName: s.componentName || '-',
          ihmStatus: s.ihm || 'Unknown',
          evidence: s.ihmEvidenceType || 'None'
        }));

        const summary = [
          { label: 'Total Items', value: data.length },
          { label: 'With IHM', value: data.filter((d: any) => d.ihmStatus === 'Present').length },
          { label: 'Without IHM', value: data.filter((d: any) => d.ihmStatus === 'Not Present').length },
          { label: 'Unknown', value: data.filter((d: any) => d.ihmStatus === 'Unknown').length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'IHM Inventory Status Report', subtitle: 'Hazardous materials inventory', vessel: vesselName },
          columns,
          data,
          summary
        );
        break;
      }

      case 'ihm-compliance-summary': {
        const withIhm = spares.filter((s: any) => s.ihm === 'Present').length;
        const withoutIhm = spares.filter((s: any) => s.ihm === 'Not Present').length;
        const unknown = spares.filter((s: any) => !s.ihm || s.ihm === 'Unknown').length;
        const total = spares.length;

        const columns = [
          { header: 'Category', field: 'category', width: 50 },
          { header: 'Count', field: 'count', width: 30 },
          { header: 'Percentage', field: 'percentage', width: 35 }
        ];

        const data = [
          { category: 'Items with IHM Present', count: withIhm, percentage: total > 0 ? `${Math.round(withIhm/total*100)}%` : '0%' },
          { category: 'Items without IHM', count: withoutIhm, percentage: total > 0 ? `${Math.round(withoutIhm/total*100)}%` : '0%' },
          { category: 'Unknown Status', count: unknown, percentage: total > 0 ? `${Math.round(unknown/total*100)}%` : '0%' }
        ];

        const knownStatus = withIhm + withoutIhm;
        const complianceRate = total > 0 ? Math.round(knownStatus / total * 100) : 100;

        const summary = [
          { label: 'Compliance Rate', value: `${complianceRate}%` },
          { label: 'Total Items', value: total },
          { label: 'Known Status', value: knownStatus },
          { label: 'Unknown', value: unknown }
        ];

        pdfReportGenerator.generateReport(
          { title: 'IHM Compliance Summary', subtitle: 'Hazardous materials compliance status', vessel: vesselName },
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

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel') => {
    const reportKey = `${reportId}-${format}`;
    
    if (generatingReports.has(reportKey)) return;

    if (spares.length === 0) {
      toast({ title: "No Data Available", description: "No IHM inventory data found for the selected vessel.", variant: "destructive" });
      return;
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateIhmPDF(reportId);
        toast({ title: "Report Generated", description: `${format} report downloaded successfully!` });
      } else {
        toast({ title: "Excel Export", description: "Excel export coming soon." });
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

  const ihmPresent = spares.filter((s: any) => s.ihm === 'Present').length;
  const ihmNotPresent = spares.filter((s: any) => s.ihm === 'Not Present').length;
  const ihmUnknown = spares.filter((s: any) => !s.ihm || s.ihm === 'Unknown').length;

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
            <h1 className="text-2xl font-bold text-gray-900">IHM (Inventory of Hazardous Materials)</h1>
            <p className="text-sm text-gray-500">2 reports for hazardous materials tracking</p>
          </div>
        </div>

        <CategoryFilters
          filters={categoryFilters}
          onFiltersChange={setCategoryFilters}
          searchPlaceholder="Search IHM reports..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-gray-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Package className="w-4 h-4 text-gray-500" />
              Total Items
            </CardDescription>
            <CardTitle className="text-3xl">{spares.length}</CardTitle>
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
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria</p>
        </div>
      )}
    </div>
  );
};

export default IhmReports;
