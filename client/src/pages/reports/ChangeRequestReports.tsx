import { useState } from "react";
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
  GitPullRequest,
  ClipboardList,
  TrendingUp,
  Clock,
  CheckCircle,
  Eye,
  Loader2
} from "lucide-react";
import { pdfReportGenerator, formatDate } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";

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
}

const ChangeRequestReports: React.FC<ChangeRequestReportsProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId } = useVessel();

  const { data: workOrders = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/work-orders'],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/jobs', vesselId],
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

  const generateChangeRequestPDF = async (reportId: string) => {
    const vesselName = vessels.find(v => v.id === vesselId)?.name || vesselId || 'All Vessels';

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
              <div className="p-2 rounded-lg bg-cyan-500 text-white">
                <GitPullRequest className="h-5 w-5" />
              </div>
              Change Requests
            </h1>
            <p className="text-gray-600">2 reports for change tracking</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search change request reports..."
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
                <p className="text-sm text-gray-600">Unplanned WOs</p>
                <p className="text-2xl font-bold text-gray-800">{unplannedWOs}</p>
              </div>
              <GitPullRequest className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingChanges}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-blue-600">{jobs.length}</p>
              </div>
              <ClipboardList className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reports</p>
                <p className="text-2xl font-bold text-purple-600">2</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
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
                    <div className="p-2 rounded-lg bg-cyan-100 text-cyan-600">
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

export default ChangeRequestReports;
