import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  FileText,
  AlertCircle,
  CheckCircle,
  Package,
  Shield,
  Eye,
  Loader2
} from 'lucide-react';
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";

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
}

const IhmReports: React.FC<IhmReportsProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId } = useVessel();

  const { data: spares = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/spares', vesselId],
    enabled: !!vesselId && vesselId !== 'all',
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
    return report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const generateIhmPDF = async (reportId: string) => {
    const vesselName = vessels.find(v => v.id === vesselId)?.name || vesselId || 'All Vessels';

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
    <div className="p-6 bg-[#fafafa] min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Button>
          <div className="h-6 border-l border-gray-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500 text-white">
                <AlertCircle className="h-5 w-5" />
              </div>
              IHM (Inventory of Hazardous Materials)
            </h1>
            <p className="text-gray-600">2 reports for hazardous materials tracking</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search IHM reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-800">{spares.length}</p>
              </div>
              <Package className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">IHM Present</p>
                <p className="text-2xl font-bold text-red-600">{ihmPresent}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">No IHM</p>
                <p className="text-2xl font-bold text-green-600">{ihmNotPresent}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unknown</p>
                <p className="text-2xl font-bold text-yellow-600">{ihmUnknown}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 text-red-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <Badge className={getPriorityColor(report.priority)} variant="secondary">
                        {report.priority.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{report.frequency}</p>
                    <p>{report.estimatedTime}</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <p className="text-gray-700 text-sm mb-2">{report.description}</p>
                  <p className="text-xs text-gray-500"><strong>Purpose:</strong> {report.purpose}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Key Fields:</p>
                  <div className="flex flex-wrap gap-1">
                    {report.fields.slice(0, 4).map((field, index) => (
                      <Badge key={index} variant="outline" className="text-xs">{field}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <Button size="sm" variant="outline" onClick={() => handleGenerateReport(report.id, 'PDF')} className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      onClick={() => handleGenerateReport(report.id, 'PDF')}
                      className="bg-red-600 hover:bg-red-700 text-white px-3"
                      disabled={generatingReports.has(`${report.id}-PDF`)}
                    >
                      {generatingReports.has(`${report.id}-PDF`) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'PDF'}
                    </Button>
                    {report.outputs.includes('Excel') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGenerateReport(report.id, 'Excel')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3"
                        disabled={generatingReports.has(`${report.id}-Excel`)}
                      >
                        {generatingReports.has(`${report.id}-Excel`) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excel'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default IhmReports;
