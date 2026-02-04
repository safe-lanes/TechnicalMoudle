import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Bell,
  Shield,
  Settings,
  Users,
  Activity,
  BarChart3,
  Eye,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Download
} from "lucide-react";
import { pdfReportGenerator, formatDate } from "@/lib/pdfReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";

interface AdminReport {
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
  reportType: 'alerts' | 'approvals' | 'admin';
}

interface AlertsApprovalsAdminReportsProps {
  onBack: () => void;
}

const AlertsApprovalsAdminReports: React.FC<AlertsApprovalsAdminReportsProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const { vesselId } = useVessel();

  const { data: workOrders = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/work-orders'],
  });

  const { data: defects = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/defects', vesselId],
    enabled: !!vesselId && vesselId !== 'all',
  });

  const reports: AdminReport[] = [
    {
      id: "alerts-notifications",
      name: "System Alerts & Notifications",
      description: "Comprehensive tracking of all system alerts, notifications, and critical warnings",
      purpose: "Monitor system health & alert response (Admin)",
      frequency: "Daily",
      fields: ["Alert Type", "Priority", "Module", "Status", "Time"],
      outputs: ["PDF", "Excel"],
      icon: Bell,
      priority: "high",
      estimatedTime: "1-2 min",
      reportType: "alerts"
    },
    {
      id: "pending-approvals",
      name: "Pending Approvals Report",
      description: "All items awaiting approval across work orders, defects, and changes",
      purpose: "Track approval workflow (Office/Superintendent)",
      frequency: "Daily",
      fields: ["Item Type", "ID", "Description", "Submitted", "Awaiting"],
      outputs: ["PDF", "Dashboard"],
      icon: Clock,
      priority: "high",
      estimatedTime: "< 1 min",
      reportType: "approvals"
    },
    {
      id: "approval-history",
      name: "Approval History Log",
      description: "Audit trail of all approvals and rejections",
      purpose: "Compliance & audit trail (Office/Auditors)",
      frequency: "Monthly",
      fields: ["Item", "Approver", "Action", "Date", "Comments"],
      outputs: ["PDF", "Excel"],
      icon: CheckCircle,
      priority: "medium",
      estimatedTime: "2-3 min",
      reportType: "approvals"
    },
    {
      id: "user-activity",
      name: "User Activity Report",
      description: "User login history, actions taken, and session information",
      purpose: "Security monitoring (IT Admin)",
      frequency: "Weekly",
      fields: ["User", "Role", "Last Login", "Actions", "Sessions"],
      outputs: ["PDF", "Excel"],
      icon: Users,
      priority: "medium",
      estimatedTime: "2-3 min",
      reportType: "admin"
    },
    {
      id: "system-performance",
      name: "System Performance Report",
      description: "PMS module performance metrics and usage statistics",
      purpose: "System optimization (IT Admin)",
      frequency: "Monthly",
      fields: ["Module", "Usage Count", "Avg Response", "Errors"],
      outputs: ["PDF", "Dashboard"],
      icon: Activity,
      priority: "low",
      estimatedTime: "3-5 min",
      reportType: "admin"
    },
    {
      id: "overdue-alerts",
      name: "Overdue Items Alert Report",
      description: "All overdue work orders, defects, and certificates",
      purpose: "Prioritization & escalation (Management)",
      frequency: "Daily",
      fields: ["Type", "ID", "Description", "Days Overdue", "Priority"],
      outputs: ["PDF", "Dashboard"],
      icon: AlertTriangle,
      priority: "high",
      estimatedTime: "< 1 min",
      reportType: "alerts"
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || report.reportType === selectedType;
    return matchesSearch && matchesType;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const generateAlertsPDF = async (reportId: string) => {
    const vesselName = vessels.find(v => v.id === vesselId)?.name || vesselId || 'All Vessels';
    const now = new Date();

    switch (reportId) {
      case 'alerts-notifications': {
        const columns = [
          { header: 'Alert Type', field: 'type', width: 35 },
          { header: 'Description', field: 'description', width: 60 },
          { header: 'Priority', field: 'priority', width: 25 },
          { header: 'Status', field: 'status', width: 25 }
        ];

        const alerts: any[] = [];
        
        workOrders.filter((wo: any) => wo.status === 'Overdue' || (wo.dueDate && new Date(wo.dueDate) < now && wo.status !== 'Completed'))
          .forEach((wo: any) => alerts.push({
            type: 'Overdue Work Order',
            description: wo.workOrderNumber || wo.title || wo.id,
            priority: 'High',
            status: 'Active'
          }));

        defects.filter((d: any) => d.status === 'Open')
          .forEach((d: any) => alerts.push({
            type: 'Open Defect',
            description: d.defectNumber || d.title || d.id,
            priority: d.priority || 'Medium',
            status: 'Active'
          }));

        const summary = [
          { label: 'Total Alerts', value: alerts.length },
          { label: 'High Priority', value: alerts.filter(a => a.priority === 'High').length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'System Alerts & Notifications', subtitle: 'Active alerts and warnings', vessel: vesselName },
          columns,
          alerts.length > 0 ? alerts : [{ type: 'No Alerts', description: 'All systems normal', priority: '-', status: 'OK' }],
          summary
        );
        break;
      }

      case 'pending-approvals': {
        const columns = [
          { header: 'Type', field: 'type', width: 35 },
          { header: 'ID', field: 'id', width: 40 },
          { header: 'Description', field: 'description', width: 55 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const pendingItems: any[] = [];
        
        workOrders.filter((wo: any) => wo.status === 'Pending Approval')
          .forEach((wo: any) => pendingItems.push({
            type: 'Work Order',
            id: wo.workOrderNumber || wo.id,
            description: wo.title || wo.jobTitle || '-',
            status: 'Awaiting Approval'
          }));

        defects.filter((d: any) => d.status === 'Pending Approval')
          .forEach((d: any) => pendingItems.push({
            type: 'Defect',
            id: d.defectNumber || d.id,
            description: d.title || d.description || '-',
            status: 'Awaiting Approval'
          }));

        const summary = [
          { label: 'Pending Items', value: pendingItems.length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Pending Approvals Report', subtitle: 'Items awaiting approval', vessel: vesselName },
          columns,
          pendingItems.length > 0 ? pendingItems : [{ type: 'None', id: '-', description: 'No pending approvals', status: 'Clear' }],
          summary
        );
        break;
      }

      case 'approval-history':
      case 'user-activity':
      case 'system-performance': {
        const columns = [
          { header: 'Item', field: 'item', width: 50 },
          { header: 'Details', field: 'details', width: 70 },
          { header: 'Status', field: 'status', width: 30 }
        ];

        const reportTitles: Record<string, string> = {
          'approval-history': 'Approval History Log',
          'user-activity': 'User Activity Report',
          'system-performance': 'System Performance Report'
        };

        pdfReportGenerator.generateReport(
          { title: reportTitles[reportId], subtitle: 'System administration report', vessel: vesselName },
          columns,
          [{ item: 'Report Generated', details: formatDate(new Date().toISOString()), status: 'OK' }]
        );
        break;
      }

      case 'overdue-alerts': {
        const columns = [
          { header: 'Type', field: 'type', width: 35 },
          { header: 'ID', field: 'id', width: 40 },
          { header: 'Description', field: 'description', width: 50 },
          { header: 'Days Overdue', field: 'daysOverdue', width: 30 },
          { header: 'Priority', field: 'priority', width: 25 }
        ];

        const overdueItems: any[] = [];
        
        workOrders.filter((wo: any) => {
          if (!wo.dueDate || wo.status === 'Completed') return false;
          return new Date(wo.dueDate) < now;
        }).forEach((wo: any) => {
          const daysOverdue = Math.floor((now.getTime() - new Date(wo.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          overdueItems.push({
            type: 'Work Order',
            id: wo.workOrderNumber || wo.id,
            description: wo.title || wo.jobTitle || '-',
            daysOverdue,
            priority: wo.priority || 'Normal'
          });
        });

        const summary = [
          { label: 'Overdue Items', value: overdueItems.length },
          { label: 'Critical', value: overdueItems.filter(i => i.daysOverdue > 30).length }
        ];

        pdfReportGenerator.generateReport(
          { title: 'Overdue Items Alert Report', subtitle: 'All overdue items requiring attention', vessel: vesselName },
          columns,
          overdueItems.length > 0 ? overdueItems : [{ type: 'None', id: '-', description: 'No overdue items', daysOverdue: 0, priority: '-' }],
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

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      toast({ title: "Generating Report", description: `Creating ${format} report...` });

      if (format === 'PDF') {
        await generateAlertsPDF(reportId);
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

  const overdueWOs = workOrders.filter((wo: any) => {
    if (!wo.dueDate || wo.status === 'Completed') return false;
    return new Date(wo.dueDate) < new Date();
  }).length;

  const pendingApprovals = workOrders.filter((wo: any) => wo.status === 'Pending Approval').length + 
                          defects.filter((d: any) => d.status === 'Pending Approval').length;

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
            <h1 className="text-2xl font-bold text-gray-900">Alerts, Approvals & Admin</h1>
            <p className="text-sm text-gray-500">6 reports for system administration</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search admin reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-admin-reports"
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-48" data-testid="select-type-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="alerts">Alerts</SelectItem>
              <SelectItem value="approvals">Approvals</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-red-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Overdue Items
            </CardDescription>
            <CardTitle className="text-3xl text-red-600">{overdueWOs}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-yellow-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-yellow-500" />
              Pending Approvals
            </CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{pendingApprovals}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Bell className="w-4 h-4 text-blue-500" />
              Total Alerts
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">{overdueWOs + defects.filter((d: any) => d.status === 'Open').length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-indigo-500 bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <FileText className="w-4 h-4 text-indigo-500" />
              Reports
            </CardDescription>
            <CardTitle className="text-3xl text-indigo-600">6</CardTitle>
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
                data-testid={`admin-report-row-${report.id}`}
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
          <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}
    </div>
  );
};

export default AlertsApprovalsAdminReports;
