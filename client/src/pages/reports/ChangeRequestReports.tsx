import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  GitPullRequest,
  ClipboardList,
  TrendingUp,
  Clock,
  CheckCircle,
  Eye,
  Loader2,
  FileText,
  Download
} from "lucide-react";
import { pdfReportGenerator, formatDate } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import CategoryFilters, { CategoryFilterValues } from "@/components/reports/CategoryFilters";

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
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
}

const ChangeRequestReports: React.FC<ChangeRequestReportsProps> = ({ onBack, globalFilters }) => {
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

  const { data: workOrders = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/work-orders', effectiveVesselId],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/jobs', effectiveVesselId],
  });

  const reports: ChangeRequestReport[] = [
    {
      id: "change-requests-status",
      name: "Change Requests Status & Tracking",
      description: "Comprehensive tracking of all PMS change requests including workflow status and approval progress",
      purpose: "Monitor change request pipeline & track approvals (Office/Superintendent)",
      frequency: "Weekly",
      fields: ["Request ID", "Title", "Type", "Status", "Priority", "Date"],
      outputs: ["PDF", "Excel"],
      icon: GitPullRequest,
      priority: "high",
      estimatedTime: "2-3 min"
    },
    {
      id: "change-analytics",
      name: "Change Request Analytics",
      description: "Statistical analysis of change requests including trends, cycle times, and approval rates",
      purpose: "Process improvement & trend analysis (Management)",
      frequency: "Monthly",
      fields: ["Period", "Total Requests", "Approved", "Rejected", "Avg Cycle Time"],
      outputs: ["PDF", "Dashboard"],
      icon: TrendingUp,
      priority: "medium",
      estimatedTime: "3-5 min"
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

  const generateChangeRequestPDF = async (reportId: string) => {
    const vesselName = vessels.find(v => v.id === effectiveVesselId)?.name || effectiveVesselId || 'All Vessels';

    switch (reportId) {
      case 'change-requests-status': {
        const columns = [
          { header: 'Type', field: 'type', width: 30 },
          { header: 'ID', field: 'id', width: 40 },
          { header: 'Title', field: 'title', width: 60 },
          { header: 'Status', field: 'status', width: 30 },
          { header: 'Date', field: 'date', width: 30 }
        ];

        const changes: any[] = [];
        
        workOrders
          .filter((wo: any) => wo.type === 'Unplanned' || wo.workOrderNumber?.startsWith('UWO'))
          .forEach((wo: any) => changes.push({
            type: 'Unplanned WO',
            id: wo.workOrderNumber || wo.id,
            title: wo.title || wo.jobTitle || '-',
            status: wo.status || 'Open',
            date: formatDate(wo.createdAt || wo.dueDate)
          }));

        jobs
          .filter((j: any) => j.status === 'Draft' || j.status === 'Pending')
          .forEach((j: any) => changes.push({
            type: 'Job Change',
            id: j.jobCode || j.id,
            title: j.title || j.name || '-',
            status: j.status || 'Pending',
            date: formatDate(j.createdAt)
          }));

        const summary = [
          { label: 'Total Changes', value: changes.length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Change Requests Status', subtitle: 'All change requests and modifications', vessel: vesselName },
          columns,
          changes.length > 0 ? changes : [{ type: 'None', id: '-', title: 'No change requests', status: '-', date: '-' }],
          summary
        );
        break;
      }

      case 'change-analytics': {
        const columns = [
          { header: 'Metric', field: 'metric', width: 60 },
          { header: 'Value', field: 'value', width: 40 },
          { header: 'Notes', field: 'notes', width: 60 }
        ];

        const unplannedWOs = workOrders.filter((wo: any) => 
          wo.type === 'Unplanned' || wo.workOrderNumber?.startsWith('UWO')
        ).length;

        const completedWOs = workOrders.filter((wo: any) => wo.status === 'Completed').length;

        const data = [
          { metric: 'Total Unplanned Work Orders', value: unplannedWOs, notes: 'Current period' },
          { metric: 'Completed Work Orders', value: completedWOs, notes: 'All statuses' },
          { metric: 'Total Jobs', value: jobs.length, notes: 'Active job templates' },
          { metric: 'Completion Rate', value: workOrders.length > 0 ? `${Math.round(completedWOs/workOrders.length*100)}%` : 'N/A', notes: 'Based on total WOs' }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Change Request Analytics', subtitle: 'Statistical analysis and trends', vessel: vesselName },
          columns,
          data
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

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateChangeRequestPDF(reportId);
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

  const unplannedWOs = workOrders.filter((wo: any) => 
    wo.type === 'Unplanned' || wo.workOrderNumber?.startsWith('UWO')
  ).length;

  const pendingChanges = workOrders.filter((wo: any) => wo.status === 'Pending').length;

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
            <h1 className="text-2xl font-bold text-gray-900">Change Requests</h1>
            <p className="text-sm text-gray-500">2 reports for change tracking</p>
          </div>
        </div>

        <CategoryFilters
          filters={categoryFilters}
          onFiltersChange={setCategoryFilters}
          searchPlaceholder="Search change request reports..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-cyan-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <GitPullRequest className="w-4 h-4 text-cyan-500" />
              Unplanned WOs
            </CardDescription>
            <CardTitle className="text-3xl">{unplannedWOs}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-yellow-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-yellow-500" />
              Pending
            </CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{pendingChanges}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              Total Jobs
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">{jobs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-purple-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              Reports
            </CardDescription>
            <CardTitle className="text-3xl text-purple-600">2</CardTitle>
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
                data-testid={`change-report-row-${report.id}`}
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
          <GitPullRequest className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria</p>
        </div>
      )}
    </div>
  );
};

export default ChangeRequestReports;
