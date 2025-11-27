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
  GitPullRequest,
  ClipboardList,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Loader2
} from "lucide-react";
import { reportGenerator } from "@/lib/reportGenerator";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";

interface ChangeRequestReport {
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
  reportType: 'tracking' | 'analytics';
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();

  const reports: ChangeRequestReport[] = [
    {
      id: "change-requests-status",
      name: "Change Requests Status & Tracking Report",
      description: "Comprehensive tracking of all PMS change requests including workflow status, approval progress, and implementation timeline",
      purpose: "Monitor change request pipeline & track approvals (Office/Superintendent)",
      frequency: "Weekly",
      fields: ["Request ID", "Title", "Type", "Status", "Priority", "Submitted Date", "Approver", "Target Component", "Impact Assessment", "Timeline"],
      filters: ["Vessel", "Status", "Priority", "Change Type", "Submitted Date", "Approver"],
      outputs: ["PDF", "Excel", "Dashboard"],
      icon: GitPullRequest,
      priority: "high",
      lastGenerated: "1 day ago",
      estimatedTime: "2-3 min",
      reportType: "tracking"
    },
    {
      id: "change-requests-analytics",
      name: "Change Requests Analytics & Trends Report",
      description: "Analytical overview of change request patterns, approval rates, implementation success, and system modification trends",
      purpose: "Analyze PMS modification patterns & improvement opportunities (Management/QA)",
      frequency: "Monthly",
      fields: ["Request Volume", "Approval Rate", "Average Processing Time", "Change Categories", "Component Impact", "Success Rate", "Trending Issues"],
      filters: ["Vessel", "Time Period", "Change Category", "Status", "Component Type"],
      outputs: ["PDF", "Excel"],
      icon: TrendingUp,
      priority: "medium",
      lastGenerated: "3 days ago",
      estimatedTime: "4-5 min",
      reportType: "analytics"
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
      case 'tracking': return 'bg-blue-100 text-blue-800';
      case 'analytics': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeStats = () => {
    const tracking = reports.filter(r => r.reportType === 'tracking').length;
    const analytics = reports.filter(r => r.reportType === 'analytics').length;
    const highPriority = reports.filter(r => r.priority === 'high').length;
    
    return { tracking, analytics, highPriority };
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

      // Use the maintenance report generator - will create specific change request generator later
      const blob = await reportGenerator.generateMaintenanceReport(reportId, format, filters);
      const report = reports.find(r => r.id === reportId);
      const filename = reportGenerator.generateFilename(
        report?.name || 'change-request-report', 
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
              <div className="p-2 rounded-lg bg-indigo-500 text-white">
                <GitPullRequest className="h-5 w-5" />
              </div>
              Modify PMS - Change Requests
            </h1>
            <p className="text-gray-600">2 specialized reports for PMS change request management, tracking, and analytics</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search change request reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-change-request-reports"
            />
          </div>
          
          <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
            <SelectTrigger className="w-48" data-testid="select-frequency-filter">
              <SelectValue placeholder="Filter by frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
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
              <SelectItem value="tracking">Tracking</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-800" data-testid="text-change-request-total-reports">2</p>
              </div>
              <GitPullRequest className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-change-request-high-priority">{stats.highPriority}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tracking Reports</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-change-request-tracking-count">{stats.tracking}</p>
              </div>
              <ClipboardList className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Analytics Reports</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="text-change-request-analytics-count">{stats.analytics}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow" data-testid={`change-request-report-card-${report.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
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
                        <Badge key={index} className="text-xs bg-indigo-100 text-indigo-700">
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
          <GitPullRequest className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters</p>
        </div>
      )}

      {/* Change Request Integration Notice */}
      <div className="mt-8 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div className="flex items-start gap-3">
          <ClipboardList className="h-5 w-5 text-indigo-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-indigo-900">Change Request Reports Integration</h4>
            <p className="text-sm text-indigo-800 mt-1">
              These reports integrate with the existing PMS change request system, providing comprehensive tracking and analytics 
              for all modification requests across components, work orders, spares, and stores management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangeRequestReports;