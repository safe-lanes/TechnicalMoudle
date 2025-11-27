import React, { useState } from "react";
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
  Clock
} from "lucide-react";
import { reportGenerator } from "@/lib/reportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";

interface AdminReport {
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
  reportType: 'alerts' | 'approvals' | 'admin' | 'monitoring' | 'security' | 'analytics';
}

interface AlertsApprovalsAdminReportsProps {
  onBack: () => void;
  globalFilters?: {
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
}

const AlertsApprovalsAdminReports: React.FC<AlertsApprovalsAdminReportsProps> = ({ onBack, globalFilters }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();

  const reports: AdminReport[] = [
    {
      id: "alerts-notifications",
      name: "System Alerts & Notifications Report",
      description: "Comprehensive tracking of all system alerts, notifications, and critical warnings across PMS modules",
      purpose: "Monitor system health & alert response (IT Admin/Management)",
      frequency: "Daily",
      fields: ["Alert Type", "Priority", "Module", "Trigger Time", "Status", "Response Time", "Affected Users", "Resolution"],
      filters: ["Alert Type", "Priority", "Module", "Status", "Date Range"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Bell,
      priority: "high",
      lastGenerated: "6 hours ago",
      estimatedTime: "2-3 min",
      reportType: "alerts"
    },
    {
      id: "approval-workflows",
      name: "Approval Workflows & Processing Report",
      description: "Detailed tracking of approval workflows across all PMS modules including pending, approved, and rejected items",
      purpose: "Monitor approval efficiency & bottlenecks (Management/Supervisors)",
      frequency: "Weekly",
      fields: ["Workflow Type", "Request ID", "Submitted By", "Current Approver", "Days Pending", "Status", "Processing Time"],
      filters: ["Workflow Type", "Status", "Approver", "Department", "Priority"],
      outputs: ["PDF", "Excel"],
      icon: CheckCircle,
      priority: "high",
      lastGenerated: "2 days ago",
      estimatedTime: "3-4 min",
      reportType: "approvals"
    },
    {
      id: "user-activity-audit",
      name: "User Activity & Audit Trail Report",
      description: "Complete audit trail of user activities, login patterns, and system usage across all PMS modules",
      purpose: "Security monitoring & compliance auditing (Security Admin/Management)",
      frequency: "Monthly",
      fields: ["User ID", "Activity Type", "Module", "Timestamp", "IP Address", "Device", "Success/Failure", "Session Duration"],
      filters: ["User", "Activity Type", "Module", "Date Range", "Success Status"],
      outputs: ["PDF", "Excel"],
      icon: Users,
      priority: "medium",
      lastGenerated: "5 days ago",
      estimatedTime: "4-5 min",
      reportType: "security"
    },
    {
      id: "system-performance",
      name: "System Performance & Usage Analytics",
      description: "System performance metrics, module usage statistics, and operational efficiency indicators",
      purpose: "Optimize system performance & resource allocation (IT Admin/Management)",
      frequency: "Weekly",
      fields: ["Module", "Usage Count", "Response Time", "Error Rate", "Peak Hours", "Resource Usage", "Performance Score"],
      filters: ["Module", "Date Range", "Performance Metric", "Usage Type"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Activity,
      priority: "medium",
      lastGenerated: "1 day ago",
      estimatedTime: "3-4 min",
      reportType: "monitoring"
    },
    {
      id: "administrative-overview",
      name: "Administrative Overview & Control Report",
      description: "High-level administrative overview including system configuration, user management, and operational control metrics",
      purpose: "Executive oversight & administrative control (Management/IT Director)",
      frequency: "Monthly",
      fields: ["Total Users", "Active Modules", "System Health", "Backup Status", "License Usage", "Compliance Status", "Critical Issues"],
      filters: ["System Component", "Status", "Date Range", "Department"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: Settings,
      priority: "high",
      lastGenerated: "1 week ago",
      estimatedTime: "5-6 min",
      reportType: "admin"
    },
    {
      id: "compliance-security",
      name: "Compliance & Security Status Report",
      description: "Comprehensive security posture and regulatory compliance status across all PMS modules and operations",
      purpose: "Ensure regulatory compliance & security standards (Security Officer/QA)",
      frequency: "Monthly",
      fields: ["Compliance Area", "Status", "Last Audit", "Non-Conformities", "Risk Level", "Corrective Actions", "Deadline"],
      filters: ["Compliance Area", "Status", "Risk Level", "Department"],
      outputs: ["PDF", "Excel"],
      icon: Shield,
      priority: "high",
      lastGenerated: "3 days ago",
      estimatedTime: "4-5 min",
      reportType: "security"
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFrequency = selectedFrequency === "all" || 
                           report.frequency.toLowerCase().includes(selectedFrequency.toLowerCase());
    
    const matchesType = selectedType === "all" || report.reportType === selectedType;
    
    return matchesSearch && matchesFrequency && matchesType;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'alerts': return 'bg-red-100 text-red-800';
      case 'approvals': return 'bg-green-100 text-green-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'monitoring': return 'bg-purple-100 text-purple-800';
      case 'security': return 'bg-orange-100 text-orange-800';
      case 'analytics': return 'bg-cyan-100 text-cyan-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeStats = () => {
    const alerts = reports.filter(r => r.reportType === 'alerts').length;
    const approvals = reports.filter(r => r.reportType === 'approvals').length;
    const admin = reports.filter(r => r.reportType === 'admin').length;
    const monitoring = reports.filter(r => r.reportType === 'monitoring').length;
    const security = reports.filter(r => r.reportType === 'security').length;
    const highPriority = reports.filter(r => r.priority === 'high').length;
    
    return { alerts, approvals, admin, monitoring, security, highPriority };
  };

  const stats = getTypeStats();

  const handleGenerateReport = async (reportId: string, format: 'PDF' | 'Excel' | 'CSV') => {
    const reportKey = `${reportId}-${format}`;
    
    if (generatingReports.has(reportKey)) {
      return; // Already generating this report
    }

    try {
      setGeneratingReports(prev => new Set(prev).add(reportKey));
      
      toast({
        title: "Generating Report",
        description: `Creating ${format} report for ${reports.find(r => r.id === reportId)?.name}...`,
      });

      // Get current filters - use globalFilters vessel or first available vessel
      const vesselName = globalFilters?.vessel || vessels[0]?.name || "Unknown Vessel";
      const vesselCode = vesselName.replace(/\s+/g, '_');
      const filters = {
        vessel: vesselName,
        frequency: selectedFrequency !== "all" ? selectedFrequency : undefined,
        type: selectedType !== "all" ? selectedType : undefined,
        search: searchQuery || undefined,
      };

      // Use the maintenance report generator - will create specific admin generator later
      const blob = await reportGenerator.generateMaintenanceReport(reportId, format, filters);
      const report = reports.find(r => r.id === reportId);
      const filename = reportGenerator.generateFilename(
        report?.name || 'admin-report', 
        format, 
        vesselCode
      );
      
      await reportGenerator.downloadReport(blob, filename);
      
      toast({
        title: "Report Generated",
        description: `${format} report downloaded successfully!`,
        variant: "default",
      });
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Generation Failed",
        description: `Failed to generate ${format} report. Please try again.`,
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

  const handlePreviewReport = (reportId: string) => {
    // For now, generate a PDF preview
    handleGenerateReport(reportId, 'PDF');
  };

  return (
    <div className="p-6 bg-[#fafafa] min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button 
            variant="outline" 
            onClick={onBack}
            className="flex items-center gap-2"
            data-testid="button-back-to-reports"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Button>
          <div className="h-6 border-l border-gray-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500 text-white">
                <Shield className="h-5 w-5" />
              </div>
              Alerts, Approvals & Admin
            </h1>
            <p className="text-gray-600">6 specialized reports for system administration, approval workflows, and operational oversight</p>
          </div>
        </div>

        {/* Search and Filters */}
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
          
          <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
            <SelectTrigger className="w-48" data-testid="select-frequency-filter">
              <SelectValue placeholder="Filter by frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-48" data-testid="select-type-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="alerts">Alerts</SelectItem>
              <SelectItem value="approvals">Approvals</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="monitoring">Monitoring</SelectItem>
              <SelectItem value="security">Security</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-800" data-testid="text-admin-total-reports">6</p>
              </div>
              <Shield className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-admin-high-priority">{stats.highPriority}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Alerts</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-admin-alerts-count">{stats.alerts}</p>
              </div>
              <Bell className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approvals</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-admin-approvals-count">{stats.approvals}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Security</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="text-admin-security-count">{stats.security}</p>
              </div>
              <Shield className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monitoring</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="text-admin-monitoring-count">{stats.monitoring}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow" data-testid={`admin-report-card-${report.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge className={getPriorityColor(report.priority)} variant="secondary">
                          {report.priority.toUpperCase()}
                        </Badge>
                        <Badge className={getTypeColor(report.reportType)} variant="secondary">
                          {report.reportType.toUpperCase()}
                        </Badge>
                      </div>
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

                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Key Fields:</p>
                    <div className="flex flex-wrap gap-1">
                      {report.fields.slice(0, 3).map((field, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                      {report.fields.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{report.fields.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Outputs:</p>
                    <div className="flex gap-1">
                      {report.outputs.map((output, index) => (
                        <Badge key={index} className="text-xs bg-orange-100 text-orange-700">
                          {output}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {report.lastGenerated && (
                  <p className="text-xs text-gray-500">Last generated: {report.lastGenerated}</p>
                )}

                <div className="flex gap-2 pt-3 border-t">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handlePreviewReport(report.id)}
                    className="flex items-center gap-2"
                    data-testid={`button-preview-${report.id}`}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  
                  <div className="flex gap-1">
                    {report.outputs.includes('PDF') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGenerateReport(report.id, 'PDF')}
                        className="bg-red-600 hover:bg-red-700 text-white px-3"
                        disabled={generatingReports.has(`${report.id}-PDF`)}
                        data-testid={`button-pdf-${report.id}`}
                      >
                        {generatingReports.has(`${report.id}-PDF`) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'PDF'
                        )}
                      </Button>
                    )}
                    {report.outputs.includes('Excel') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGenerateReport(report.id, 'Excel')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3"
                        disabled={generatingReports.has(`${report.id}-Excel`)}
                        data-testid={`button-excel-${report.id}`}
                      >
                        {generatingReports.has(`${report.id}-Excel`) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Excel'
                        )}
                      </Button>
                    )}
                    {report.outputs.includes('Dashboard') && (
                      <Button 
                        size="sm" 
                        onClick={() => {
                          toast({
                            title: "Dashboard View",
                            description: "Dashboard view will be implemented in the next phase",
                          });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3"
                        data-testid={`button-dashboard-${report.id}`}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}

      {/* Admin Integration Notice */}
      <div className="mt-8 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-orange-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-orange-900">Administrative Reports Integration</h4>
            <p className="text-sm text-orange-800 mt-1">
              These reports provide comprehensive administrative oversight including system monitoring, user management, 
              approval workflows, security compliance, and operational control across all PMS modules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertsApprovalsAdminReports;